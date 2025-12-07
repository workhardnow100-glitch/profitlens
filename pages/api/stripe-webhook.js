// pages/api/stripe-webhook.js
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
      case "checkout.session.completed": {
        const session = event.data.object;
        const email = session.customer_email;

        if (!email) {
          console.warn("⚠️ No customer_email found in session");
          return res.status(400).json({ error: "Missing email" });
        }

        // ✅ Check if user exists in app_users
        const { data: existingUser } = await supabaseAdmin
          .from("app_users")
          .select("id, client_id")
          .eq("email", email)
          .single();

        let userId, clientId;

        if (!existingUser) {
          // ✅ Create new client first
          const { data: newClient, error: clientError } = await supabaseAdmin
            .from("clients")
            .insert([{ name: `${email}'s client` }])
            .select("id")
            .single();

          if (clientError || !newClient) {
            console.error("❌ Failed to create client:", clientError?.message);
            return res.status(500).json({ error: "Client creation failed" });
          }

          clientId = newClient.id;

          // ✅ Create new user linked to client
          const { data: newUser, error: createError } = await supabaseAdmin
            .from("app_users")
            .insert([{
              email,
              role: "client",
              subscription_status: "basic", // or "pro" depending on plan
              client_id: clientId,
            }])
            .select("id")
            .single();

          if (createError || !newUser) {
            console.error("❌ Failed to create user:", createError?.message);
            return res.status(500).json({ error: "User creation failed" });
          }

          userId = newUser.id;

          await supabaseAdmin.from("subscriptions").insert([{
            user_id: userId,
            status: "basic", // or "pro"
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
          }]);

          await sendEmail({
            to: email,
            subject: "Welcome to ProfitLens",
            html: `
              <h1>Welcome aboard!</h1>
              <p>Your cockpit is ready. Click below to log in securely:</p>
              <a href="${process.env.NEXTAUTH_URL}/api/auth/signin?email=${email}">Launch Dashboard</a>
            `,
          });

          console.log(`🚀 New user created and welcomed: ${email}`);
        } else {
          userId = existingUser.id;
          clientId = existingUser.client_id;

          await supabaseAdmin
            .from("subscriptions")
            .upsert([{
              user_id: userId,
              status: "basic", // or "pro"
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
            }], { onConflict: ["user_id"] });

          // ✅ Sync subscription status to app_users
          await supabaseAdmin
            .from("app_users")
            .update({ subscription_status: "basic" }) // or "pro"
            .eq("id", userId);

          console.log(`🔒 Subscription activated for existing user: ${email}`);
        }

        // Optional: audit log
        await supabaseAdmin.from("audit").insert([{
          client_id: clientId,
          user: email,
          action: "STRIPE_CHECKOUT_COMPLETED",
          details: `Subscription ${session.subscription} activated`,
          timestamp: new Date().toISOString(),
        }]);

        break;
      }

      default:
        console.log(`📭 Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ Webhook processing failed:", err);
    res.status(500).json({ error: "Webhook handling failed" });
  }
}
