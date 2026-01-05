// pages/api/payments/connect.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
// import stripe from "../../../lib/stripe"; // when you're ready

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 🔹 TEMPORARY MOCK IMPLEMENTATION
    // Later:
    // 1. Look up or create a Stripe connected account for this client
    // 2. Create an account link via stripe.accountLinks.create(...)
    // 3. Return the onboarding URL

    const mockOnboardingUrl = "https://dashboard.stripe.com/test/connect";

    return res.status(200).json({ url: mockOnboardingUrl });
  } catch (err: any) {
    console.error("CONNECT STRIPE ERROR:", err);
    return res.status(500).json({ error: "Failed to start Stripe Connect" });
  }
}
