// pages/api/payments/settings.ts
// -------------------------------------------------------------
// PURPOSE:
// This endpoint loads ALL Payment Settings data for the cockpit.
//
// It aggregates data from:
// - payment_settings (Stripe Connect status, bank details, fees)
// - payment_payouts (last payout info)
// - payment_webhook_log (webhook health)
// - payment_methods (JSONB inside payment_settings)
//
// This endpoint DOES NOT:
// - Call Stripe directly (webhook keeps DB in sync)
// - Modify any settings (other endpoints handle updates)
//
// It returns the exact shape expected by the Payment Settings UI.
// -------------------------------------------------------------

// pages/api/payments/settings.ts
// -------------------------------------------------------------
// PURPOSE:
// Loads all Payment Settings data for the cockpit.
// -------------------------------------------------------------

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { requireRole } from "../../../lib/rbac";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // RBAC: Only the FOUNDER or the USER themselves can view payment settings
  const guard = await requireRole(req, res, ["FOUNDER", "USER"]);
  if (!guard.ok) return;

  const userId = guard.userId;

  // -------------------------------------------------------------
  // 1. Ensure payment_settings row exists
  // -------------------------------------------------------------
  let { data: settings } = await supabaseAdmin
    .from("payment_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!settings) {
    const { data: newSettings } = await supabaseAdmin
      .from("payment_settings")
      .insert({ user_id: userId })
      .select("*")
      .single();

    settings = newSettings;
  }

  // -------------------------------------------------------------
  // 2. Load last payout
  // -------------------------------------------------------------
  const { data: lastPayout } = await supabaseAdmin
    .from("payment_payouts")
    .select("amount, arrival_date")
    .eq("user_id", userId)
    .order("arrival_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  // -------------------------------------------------------------
  // 3. Load webhook health
  // -------------------------------------------------------------
  const { data: logs } = await supabaseAdmin
    .from("payment_webhook_log")
    .select("received_at, error")
    .order("received_at", { ascending: false })
    .limit(50);

  const lastEventAt = logs?.find((l: any) => !l.error)?.received_at || null;
  const lastErrorAt = logs?.find((l: any) => l.error)?.received_at || null;
  const errorCount = logs?.filter((l: any) => l.error).length || 0;

  // -------------------------------------------------------------
  // 4. Build response for UI
  // -------------------------------------------------------------
  const response = {
    stripeAccountId: settings.stripe_account_id || null,
    stripeStatus: settings.stripe_status || "not_connected",
    payoutsEnabled: settings.payouts_enabled || false,

    bankLast4: settings.bank_last4 || null,
    bankSortCode: settings.bank_sort_code || null,
    payoutSchedule: settings.payout_schedule || null,

    nextPayoutDate: settings.next_payout_date || null,
    lastPayoutAmount: lastPayout?.amount || null,
    lastPayoutDate: lastPayout?.arrival_date || null,

    platformFeePercent: settings.platform_fee_percent,
    platformFeeMin: settings.platform_fee_min,
    platformFeeMax: settings.platform_fee_max,

    paymentMethods: settings.payment_methods || {
      card: true,
      applePay: true,
      googlePay: true,
      bankTransfer: true,
      payByLink: true,
    },

    webhook: {
      lastEventAt,
      lastErrorAt,
      errorCount,
    },
  };

  return res.status(200).json(response);
}
