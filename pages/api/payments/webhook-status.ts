// pages/api/payments/webhook-status.ts
// -------------------------------------------------------------
// PURPOSE:
// This endpoint is used by the Payment Settings page to display
// webhook health information (last event, last error, error count).
//
// It DOES NOT receive Stripe webhooks.
// It only reads from the payment_webhook_log table and returns
// summary stats for the UI.
//
// This endpoint is purely informational and does not process
// payments, payouts, Connect events, or invoices.
// -------------------------------------------------------------

/**
 * ============================================================
 * File: pages/api/payments/webhook-status.ts
 * Purpose:
 *   Returns webhook health information for the Payment Settings UI.
 *
 *   This endpoint DOES NOT receive Stripe webhooks.
 *   It only reads from public.payment_webhook_log and returns:
 *     - lastEventAt  → timestamp of most recent successful event
 *     - lastErrorAt  → timestamp of most recent error event
 *     - errorCount   → number of errors in the last 50 events
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: GET only.
 *   - Authentication:
 *       • Uses requireRole() to enforce FOUNDER‑only access.
 *   - Data handling:
 *       • Read‑only access to payment_webhook_log.
 *       • No writes, no mutations, no side effects.
 *   - RLS Alignment:
 *       • payment_webhook_log is admin‑only; this endpoint uses
 *         supabaseAdmin (service role) to read it safely.
 *
 * Change Control:
 *   - Any change to:
 *       • webhook logging schema
 *       • payment_webhook_log fields
 *     MUST be reflected in:
 *       • this endpoint
 *       • Payment Settings UI
 * ============================================================
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { requireRole } from "../../../lib/rbac";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ⭐ RBAC: Only the FOUNDER can view webhook health
  const guard = await requireRole(req, res, ["FOUNDER"]);
  if (!guard.ok) return;

  try {
    // ⭐ Load the last 50 webhook log entries
    const { data: logs, error } = await supabaseAdmin
      .from("payment_webhook_log")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("webhook-status error:", error);
    }

    // ⭐ Compute summary values
    const lastEventAt =
      logs?.find((l: any) => !l.error)?.received_at || null;

    const lastErrorAt =
      logs?.find((l: any) => l.error)?.received_at || null;

    const errorCount =
      logs?.filter((l: any) => l.error).length || 0;

    return res.status(200).json({
      lastEventAt,
      lastErrorAt,
      errorCount,
    });
  } catch (err: any) {
    console.error("WEBHOOK STATUS ERROR:", err);
    return res.status(200).json({
      lastEventAt: null,
      lastErrorAt: null,
      errorCount: 0,
    });
  }
}
