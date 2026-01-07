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

// pages/api/payments/webhook-status.ts
// -------------------------------------------------------------
// PURPOSE:
// Returns webhook health information for the Payment Settings UI.
// -------------------------------------------------------------

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { requireRole } from "../../../lib/rbac";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // RBAC: Only the FOUNDER can view webhook health
  const guard = await requireRole(req, res, ["FOUNDER"]);
  if (!guard.ok) return;

  try {
    // Load the last 50 webhook log entries
    const { data: logs, error } = await supabaseAdmin
      .from("payment_webhook_log")
      .select("*")
      .order("received_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("webhook-status error:", error);
    }

    // Compute summary values
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
