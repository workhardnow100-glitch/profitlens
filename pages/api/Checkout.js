// pages/api/checkout.js
import Stripe from "stripe";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2022-11-15",
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = session.user;
  const role = (user.role || "").toUpperCase();
  const isFounder = role === "ADMIN" || role === "FOUNDER";
  const isAccountant = role === "ACCOUNTANT";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    user.subscriptionStatus
  );

  // ❌ Accountants cannot upgrade subscriptions
  if (isAccountant) {
    return res.status(403).json({ error: "Accountants cannot upgrade subscriptions" });
  }

  // Business owners must be subscribed or trialing to upgrade
  if (!isFounder && !isSubscribedOrTrial) {
    return res.status(403).json({ error: "Upgrade not permitted" });
  }

  const { plan } = req.body;

  const PRICE_IDS = {
    basic: process.env.STRIPE_BASIC_PRICE_ID,
    pro: process.env.STRIPE_PRO_PRICE_ID,
  };

  const priceId = PRICE_IDS[plan];
  if (!priceId) {
    return res.status(400).json({ error: "Invalid plan selected" });
  }

  try {
    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: user.email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/cancel`,
      metadata: {
        client_id: user.clientId,
        user_id: user.id,
        plan,
      },
    });

    // Audit log
    await supabaseAdmin.from("audit").insert([
      {
        client_id: user.clientId,
        actor_email: user.email,
        action: "STRIPE_CHECKOUT_INITIATED",
        details: `Plan selected: ${plan}`,
        timestamp: new Date().toISOString(),
      },
    ]);

    return res.status(200).json({ id: stripeSession.id });
  } catch (err) {
    console.error("Stripe session error:", err.message);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
