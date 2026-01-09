// pages/api/stripe-webhook.js /// subcription webhook // pages/api/stripe-webhook.js
// -------------------------------------------------------------
// PURPOSE:
// This is the PROFITLENS SUBSCRIPTION WEBHOOK.
//
// It handles Stripe events related to ProfitLens' own billing:
// - New user subscriptions (basic/pro)
// - Subscription upgrades/downgrades
// - Subscription cancellations
// - Customer detail updates
//
// Responsibilities:
// - Create new app_users + clients on first subscription
// - Upsert subscriptions table
// - Sync subscription_status to app_users
// - Store Stripe customer + subscription IDs
// - Send welcome emails
// - Write audit logs
//
// IMPORTANT:
// This webhook does NOT handle:
// - Invoice payments from external clients
// - Stripe Connect onboarding
// - Payouts
// - Balance transactions
// - Webhook health
// - payment_settings updates
//
// Those belong to separate webhooks.
// -------------------------------------------------------------
/**
 * ============================================================
 * File: pages/api/stripe-webhook.js
 * Purpose:
 *   ProfitLens core subscription webhook.
 *
 *   Handles Stripe events related to ProfitLens' own billing:
 *     - New user subscriptions (basic/pro)
 *     - Subscription upgrades/downgrades
 *     - Subscription cancellations
 *     - Customer detail updates
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: POST only.
 *   - Authentication:
 *       • Verified exclusively via Stripe webhook signature.
 *       • No user/session context is trusted here.
 *   - Stripe verification:
 *       • Uses STRIPE_WEBHOOK_SECRET to validate the signature.
 *       • Rejects on any signature mismatch.
 *   - Data handling:
 *       • Creates/updates:
 *           – public.app_users
 *           – public.clients
 *           – public.subscriptions
 *       • Syncs subscription_status into app_users.
 *   - Audit logging:
 *       • Writes STRIPE_CHECKOUT_COMPLETED events into public.audit.
 *   - RLS Alignment:
 *       • app_users, clients, subscriptions, audit are protected by RLS.
 *       • This webhook uses supabaseAdmin (service role) to bypass RLS
 *         for controlled, server-side writes.
 *
 * Change Control:
 *   - Any change to:
 *       • subscription_status semantics
 *       • plan mapping (basic/pro)
 *       • app_users / subscriptions schema
 *     MUST be reflected in:
 *       • frontend subscription gating
 *       • lib/rbac.ts (if role semantics change)
 * ============================================================
 */

import { buffer } from "micro";
import Stripe from "stripe";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { sendEmail } from "../../lib/email";

export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["stripe-signature"];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      // ✅ Checkout completed
      case "checkout.session.completed": {
        const session = await stripe.checkout.sessions.retrieve(
          event.data.object.id,
          { expand: ["line_items"] }
        );

        const email = session.customer_email;
        if (!email) {
          console.warn("⚠️ No customer_email found in session");
          return res.status(400).json({ error: "Missing email" });
        }

        const customer = await stripe.customers.retrieve(session.customer);

        let plan;
        if (session.metadata && session.metadata.plan) {
          plan = session.metadata.plan;
        } else {
          const priceId = session.line_items.data[0].price.id;
          if (priceId === process.env.STRIPE_BASIC_PRICE_ID) plan = "basic";
          else if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = "pro";
          else plan = "basic";
        }

        const { data: existingUser } = await supabaseAdmin
          .from("app_users")
          .select("id, client_id")
          .eq("email", email)
          .single();

        let userId;
        let clientId;

        if (!existingUser) {
          const { data: newClient, error: clientError } = await supabaseAdmin
            .from("clients")
            .insert([{ name: `${email}'s client` }])
            .select("id")
            .single();

          if (clientError || !newClient) {
            console.error("❌ Failed to create client:", clientError);
            return res.status(500).json({ error: "Client creation failed" });
          }

          clientId = newClient.id;

          const { data: newUser, error: createError } = await supabaseAdmin
            .from("app_users")
            .insert([
              {
                email,
                role: "USER",
                subscription_status: plan,
                client_id: clientId,
              },
            ])
            .select("id")
            .single();

          if (createError || !newUser) {
            console.error("❌ Failed to create user:", createError);
            return res.status(500).json({ error: "User creation failed" });
          }

          userId = newUser.id;

          await supabaseAdmin.from("subscriptions").insert([
            {
              user_id: userId,
              status: plan,
              stripe_customer_id: customer.id,
              stripe_subscription_id: session.subscription,
              email: customer.email,
              customer_name: customer.name,
              customer_phone: customer.phone,
              customer_address: customer.address ? customer.address : null,
              plan,
            },
          ]);

          await sendEmail({
            to: email,
            subject: "Welcome to ProfitLens",
            html: `
              <h1>Welcome aboard!</h1>
              <p>Your cockpit is ready. Click below to log in securely:</p>
              <a href="${process.env.NEXTAUTH_URL}/api/auth/signin?email=${email}">Launch Dashboard</a>
            `,
          });

          console.log(`🚀 New ${plan} user created and welcomed: ${email}`);
        } else {
          userId = existingUser.id;
          clientId = existingUser.client_id;

          await supabaseAdmin
            .from("subscriptions")
            .upsert(
              [
                {
                  user_id: userId,
                  status: plan,
                  stripe_customer_id: customer.id,
                  stripe_subscription_id: session.subscription,
                  email: customer.email,
                  customer_name: customer.name,
                  customer_phone: customer.phone,
                  customer_address: customer.address ? customer.address : null,
                  plan,
                },
              ],
              { onConflict: ["user_id"] }
            );

          await supabaseAdmin
            .from("app_users")
            .update({ subscription_status: plan })
            .eq("id", userId);

          console.log(
            `🔒 Subscription updated to ${plan} for existing user: ${email}`
          );
        }

        await supabaseAdmin.from("audit").insert([
          {
            client_id: clientId,
            actor_email: email,
            action: "STRIPE_CHECKOUT_COMPLETED",
            details: `Subscription ${session.subscription} activated (${plan})`,
            timestamp: new Date().toISOString(),
          },
        ]);

        break;
      }

      // ✅ Customer details updated
      case "customer.updated": {
        const customer = event.data.object;

        await supabaseAdmin
          .from("subscriptions")
          .update({
            email: customer.email,
            customer_name: customer.name,
            customer_phone: customer.phone,
            customer_address: customer.address ? customer.address : null,
          })
          .eq("stripe_customer_id", customer.id);

        console.log(`🔄 Customer updated synced for ${customer.email}`);
        break;
      }

      // ✅ Subscription updated (plan/status changes)
      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: subscription.status,
            plan:
              (subscription.items &&
                subscription.items.data[0] &&
                subscription.items.data[0].price &&
                subscription.items.data[0].price.nickname) ||
              "unknown",
            stripe_subscription_id: subscription.id,
          })
          .eq("stripe_customer_id", customerId);

        console.log(
          `🔄 Subscription updated: ${subscription.id} (${subscription.status})`
        );
        break;
      }

      // ✅ Subscription cancelled
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        await supabaseAdmin
          .from("subscriptions")
          .update({
            status: "canceled",
            stripe_subscription_id: subscription.id,
          })
          .eq("stripe_customer_id", customerId);

        console.log(`❌ Subscription canceled: ${subscription.id}`);
        break;
      }

      default:
        console.log(`📭 Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ Webhook processing failed:", err);
    return res.status(500).json({ error: "Webhook handling failed" });
  }
}
