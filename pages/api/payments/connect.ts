// pages/api/payments/connect.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { requireRole } from "../../../lib/rbac";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // RBAC: Only the FOUNDER can initiate Stripe Connect onboarding
  const guard = await requireRole(req, res, ["FOUNDER"]);
  if (!guard.ok) return;

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
