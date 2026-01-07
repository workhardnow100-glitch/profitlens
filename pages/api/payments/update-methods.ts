// pages/api/payments/update-methods.ts
// -------------------------------------------------------------
// PURPOSE:
// Updates the user's accepted payment methods in payment_settings.
//
// Responsibilities:
// - Validate authenticated user
// - Accept boolean toggles for each payment method
// - Update the JSONB payment_methods object
//
// IMPORTANT:
// This endpoint does NOT:
// - Process payments
// - Handle platform fees
// - Handle Stripe Connect onboarding or payouts
// -------------------------------------------------------------

// pages/api/payments/update-methods.ts
// -------------------------------------------------------------
// PURPOSE:
// Updates the user's accepted payment methods in payment_settings.
// -------------------------------------------------------------

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { requireRole } from "../../../lib/rbac";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // RBAC: Only FOUNDER or USER can update their own payment methods
  const guard = await requireRole(req, res, ["FOUNDER", "USER"]);
  if (!guard.ok) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let { card, applePay, googlePay, bankTransfer, payByLink } = req.body;

    // -------------------------------------------------------------
    // Validate booleans
    // -------------------------------------------------------------
    const validateBool = (v: any) => typeof v === "boolean";

    if (
      !validateBool(card) ||
      !validateBool(applePay) ||
      !validateBool(googlePay) ||
      !validateBool(bankTransfer) ||
      !validateBool(payByLink)
    ) {
      return res.status(400).json({ error: "Invalid payment method values" });
    }

    // -------------------------------------------------------------
    // Update DB
    // -------------------------------------------------------------
    const { error } = await supabaseAdmin
      .from("payment_settings")
      .update({
        payment_methods: {
          card,
          applePay,
          googlePay,
          bankTransfer,
          payByLink,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", guard.userId);

    if (error) {
      console.error("update-methods error:", error);
      return res.status(500).json({ error: "Failed to save payment methods" });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("UPDATE METHODS ERROR:", err);
    return res.status(500).json({ error: "Failed to update payment methods" });
  }
}
