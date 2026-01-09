// pages/api/payments/stripe-connect-webhook.ts
// -------------------------------------------------------------
// PURPOSE:
// This is the STRIPE CONNECT + PAYOUTS WEBHOOK.
//
// It handles Stripe events related to:
// - Connected account onboarding (account.updated)
// - Payouts (payout.paid, payout.failed)
// - Balance updates (balance.available)
// - Webhook health + logging
//
// Responsibilities:
// - Update payment_settings with onboarding + payout status
// - Store bank details (last4, sort code) when available
// - Store payout schedule + next payout date
// - Insert payout records into payment_payouts
// - Insert balance transactions into payment_balance_items
// - Log all webhook events into payment_webhook_log
// - Update webhook health summary fields
//
// IMPORTANT:
// This webhook does NOT handle:
// - Invoice payments from external clients
// - ProfitLens subscription billing
// Those are handled by separate webhooks.
// -------------------------------------------------------------
/**
 * ============================================================
 * File: pages/api/payments/stripe-connect-webhook.ts
 * Purpose:
 *   STRIPE CONNECT + PAYOUTS WEBHOOK
 *
 *   Handles Stripe events related to:
 *     - Connected account onboarding (account.updated)
 *     - Payouts (payout.paid, payout.failed)
 *     - Balance updates (balance.available)
 *     - Webhook health + logging
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: POST only.
 *   - Authentication:
 *       • Verified exclusively via Stripe webhook signature.
 *       • No user/session context is trusted here.
 *   - Stripe verification:
 *       • Uses STRIPE_CONNECT_WEBHOOK_SECRET to validate signature.
 *       • Rejects on any mismatch.
 *   - Data handling:
 *       • Updates:
 *           – payment_settings
 *           – payment_payouts
 *           – payment_balance_items
 *           – payment_webhook_log
 *       • All writes use supabaseAdmin (service role) under strict control.
 *   - RLS Alignment:
 *       • payment_settings, payment_payouts, payment_balance_items
 *         are protected by RLS for normal users.
 *       • Webhook bypasses RLS using service role (correct).
 *
 * Change Control:
 *   - Any change to:
 *       • payout semantics
 *       • payment_settings schema
 *       • Stripe Connect onboarding metadata
 *     MUST be reflected in:
 *       • onboarding UI
 *       • payout reporting UI
 *       • accountant dashboards
 * ============================================================
 */

import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
 
});

// -------------------------------------------------------------
// Helper: Read raw body for signature verification
// -------------------------------------------------------------
async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// -------------------------------------------------------------
// Helper: Log webhook event
// -------------------------------------------------------------
async function logEvent(type: string, payload: any, error: string | null = null) {
  await supabaseAdmin.from("payment_webhook_log").insert({
    event_type: type,
    payload,
    error,
    received_at: new Date().toISOString(),
  });
}

// -------------------------------------------------------------
// MAIN WEBHOOK HANDLER
// -------------------------------------------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const signature = req.headers["stripe-signature"] as string;
  const rawBody = await getRawBody(req);

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_CONNECT_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    console.error("❌ Connect webhook signature failed:", err.message);
    await logEvent("signature_error", {}, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const type = event.type;

    switch (type) {
      // ---------------------------------------------------------
      // CONNECT ACCOUNT UPDATED (onboarding, payouts, verification)
      // ---------------------------------------------------------
      case "account.updated": {
        const account = event.data.object as Stripe.Account;

        const userId = account.metadata?.user_id;
        if (!userId) break;

        const payoutsEnabled = account.payouts_enabled ?? false;
        const chargesEnabled = account.charges_enabled ?? false;

        const externalBank = account.external_accounts?.data?.[0] ?? null;

        const bankLast4 =
          externalBank && externalBank.object === "bank_account"
            ? externalBank.last4
            : null;

        const bankSortCode =
          externalBank && externalBank.object === "bank_account"
            ? externalBank.routing_number
            : null;

        const payoutSchedule = account.settings?.payouts?.schedule?.interval ?? null;

        await supabaseAdmin
          .from("payment_settings")
          .update({
            stripe_status: chargesEnabled ? "verified" : "pending",
            payouts_enabled: payoutsEnabled,
            bank_last4: bankLast4,
            bank_sort_code: bankSortCode,
            payout_schedule: payoutSchedule,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        break;
      }

      // ---------------------------------------------------------
      // PAYOUT PAID
      // ---------------------------------------------------------
      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        const userId = payout.metadata?.user_id;
        if (!userId) break;

        await supabaseAdmin.from("payment_payouts").insert({
          user_id: userId,
          amount: payout.amount / 100,
          arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
          status: "paid",
        });

        await supabaseAdmin
          .from("payment_settings")
          .update({
            last_payout_amount: payout.amount / 100,
            last_payout_date: new Date(payout.arrival_date * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        break;
      }

      // ---------------------------------------------------------
      // PAYOUT FAILED
      // ---------------------------------------------------------
      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        const userId = payout.metadata?.user_id;
        if (!userId) break;

        await supabaseAdmin.from("payment_payouts").insert({
          user_id: userId,
          amount: payout.amount / 100,
          arrival_date: new Date(payout.arrival_date * 1000).toISOString(),
          status: "failed",
        });

        break;
      }

      // ---------------------------------------------------------
      // BALANCE AVAILABLE (ledger sync)
      // ---------------------------------------------------------
      case "balance.available": {
        const balance = event.data.object as Stripe.Balance;

        for (const entry of balance.available) {
          await supabaseAdmin.from("payment_balance_items").insert({
            amount: entry.amount / 100,
            currency: entry.currency,
            source_type: entry.source_types?.card ? "card" : "other",
            created_at: new Date().toISOString(),
          });
        }

        break;
      }

      default:
        console.log("ℹ️ Unhandled Connect event:", type);
    }

    await logEvent(type, event.data.object, null);
    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error("❌ Connect webhook handler error:", err);
    await logEvent(event.type, event.data.object, err.message);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}
