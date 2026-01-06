// pages/api/payments/update-fees.ts
// -------------------------------------------------------------
// PURPOSE:
// Updates the platform fee configuration for the founder/admin.
//
// Responsibilities:
// - Validate authenticated user
// - Restrict access to FOUNDER or ADMIN only
// - Update platform_fee_percent, platform_fee_min, platform_fee_max
// - Ensure values are numeric and safe
//
// IMPORTANT:
// This endpoint does NOT:
// - Calculate fees (done in create-checkout-session)
// - Process payments
// - Handle Stripe Connect onboarding
// -------------------------------------------------------------

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  // -------------------------------------------------------------
  // Founder/Admin only
  // -------------------------------------------------------------
  if (session.user.role !== "FOUNDER" && session.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let {
      platformFeePercent,
      platformFeeMin,
      platformFeeMax
    } = req.body;

    // -------------------------------------------------------------
    // Validate numeric inputs
    // -------------------------------------------------------------
    platformFeePercent = Number(platformFeePercent);
    platformFeeMin = platformFeeMin !== null ? Number(platformFeeMin) : null;
    platformFeeMax = platformFeeMax !== null ? Number(platformFeeMax) : null;

    if (isNaN(platformFeePercent)) {
      return res.status(400).json({ error: "Invalid platformFeePercent" });
    }

    if (platformFeeMin !== null && isNaN(platformFeeMin)) {
      return res.status(400).json({ error: "Invalid platformFeeMin" });
    }

    if (platformFeeMax !== null && isNaN(platformFeeMax)) {
      return res.status(400).json({ error: "Invalid platformFeeMax" });
    }

    // -------------------------------------------------------------
    // Update DB
    // -------------------------------------------------------------
    const { error } = await supabaseAdmin
      .from("payment_settings")
      .update({
        platform_fee_percent: platformFeePercent,
        platform_fee_min: platformFeeMin,
        platform_fee_max: platformFeeMax,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", session.user.id);

    if (error) {
      console.error("update-fees error:", error);
      return res.status(500).json({ error: "Failed to save platform fees" });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("UPDATE FEES ERROR:", err);
    return res.status(500).json({ error: "Failed to update platform fees" });
  }
}
