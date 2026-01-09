// pages/api/payments/stripe-webhook.ts
// -------------------------------------------------------------
// PURPOSE:
// INVOICE PAYMENT WEBHOOK for EXTERNAL CLIENTS.
//
// Handles payments made by external clients via Stripe
// (Payment Links, Checkout Sessions, Payment Intents, Charges).
//
// Responsibilities:
// - Verify Stripe signature
// - Prevent replay attacks (event ID dedupe)
// - Mark invoices as paid
// - Create ledger transactions
// - Create invoice_payments entries
// - (Hook) Write audit logs
// - Send receipt emails
//
// NOTE:
// Stripe Connect onboarding, payouts, balance transactions,
// and payment_settings updates belong in a separate webhook.
// -------------------------------------------------------------
/**
 * ============================================================
 * File: pages/api/payments/stripe-webhook.ts
 * Purpose:
 *   INVOICE PAYMENT WEBHOOK for EXTERNAL CLIENTS.
 *
 *   Handles payments made by external clients via Stripe
 *   (Payment Links, Checkout Sessions, Payment Intents, Charges).
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: POST only.
 *   - Authentication:
 *       • Verified exclusively via Stripe webhook signature.
 *       • No user/session context is trusted here.
 *   - Stripe verification:
 *       • Uses STRIPE_WEBHOOK_SECRET to validate the signature.
 *       • Rejects on any signature mismatch.
 *   - Idempotency / replay protection:
 *       • Uses public.stripe_events to dedupe events by event_id.
 *   - Data handling:
 *       • Calls process_invoice_payment RPC to:
 *           – Mark invoices as paid
 *           – Create ledger transactions
 *           – Create invoice_payments entries
 *       • Sends receipt emails to external clients.
 *   - RLS Alignment:
 *       • Uses supabaseAdmin (service role) for controlled writes.
 *       • Business logic is encapsulated in process_invoice_payment RPC.
 *
 * Change Control:
 *   - Any change to:
 *       • invoice payment semantics
 *       • process_invoice_payment RPC signature
 *       • metadata contract (invoice_id, user_id, client_id)
 *     MUST be reflected in:
 *       • invoice creation/payment link generation
 *       • external client payment flows
 * ============================================================
 */

import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { sendInvoiceEmail } from "../../../lib/emails/sendInvoiceEmail";

export const config = {
  api: { bodyParser: false },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  
});

// -------------------------------------------------------------
// Helper: Read raw body for Stripe signature verification
// -------------------------------------------------------------
async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// -------------------------------------------------------------
// Helper: Extract metadata safely from ANY Stripe object
// -------------------------------------------------------------
function extractMetadata(obj: any) {
  return {
    invoiceId: obj?.metadata?.invoice_id ?? null,
    userId: obj?.metadata?.user_id ?? null,
    clientId: obj?.metadata?.client_id ?? null,
  };
}

// -------------------------------------------------------------
// Helper: Record Stripe event for replay protection
// -------------------------------------------------------------
async function recordStripeEvent(eventId: string) {
  const { data: existing, error: selectError } = await supabaseAdmin
    .from("stripe_events")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (selectError) {
    console.error("❌ Failed to check stripe_events:", selectError);
  }

  if (existing) {
    console.log("⏭️ Stripe event already processed:", eventId);
    return false;
  }

  const { error: insertError } = await supabaseAdmin
    .from("stripe_events")
    .insert({ event_id: eventId });

  if (insertError) {
    console.error("❌ Failed to insert stripe_event:", insertError);
  }

  return true;
}

// -------------------------------------------------------------
// Helper: Process a successful invoice payment (RPC + idempotency)
// -------------------------------------------------------------
async function processInvoicePayment(
  amountPence: number,
  metadata: { invoiceId: string | null; userId: string | null; clientId: string | null }
) {
  const { invoiceId, userId, clientId } = metadata;

  if (!invoiceId || !userId) {
    console.error("❌ Missing metadata — cannot match invoice", {
      invoiceId,
      userId,
      clientId,
    });
    return;
  }

  const amountPaid = amountPence / 100;

  const idempotencyKey = `invoice:${invoiceId}:user:${userId}:amount:${amountPaid}`;

  const { error } = await supabaseAdmin.rpc("process_invoice_payment", {
    p_invoice_id: invoiceId,
    p_user_id: userId,
    p_client_id: clientId,
    p_amount: amountPaid,
    p_idempotency_key: idempotencyKey,
    p_source: "stripe",
  });

  if (error) {
    console.error("❌ process_invoice_payment RPC failed:", error);
    return;
  }

  try {
    const { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (!invoice) {
      console.error("❌ Invoice not found after RPC:", invoiceId);
      return;
    }

    const { data: customer } = await supabaseAdmin
      .from("external_clients")
      .select("*")
      .eq("id", invoice.client_id)
      .maybeSingle();

    const { data: owner } = await supabaseAdmin
      .from("app_users")
      .select("*")
      .eq("id", invoice.user_id)
      .maybeSingle();

    await sendInvoiceEmail({ invoice, customer, owner });
  } catch (err) {
    console.error("⚠️ Failed to send receipt email:", err);
  }

  console.log("✅ Invoice payment processed via RPC:", invoiceId);
}

// -------------------------------------------------------------
// MAIN WEBHOOK HANDLER
// -------------------------------------------------------------
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end();

  let event: Stripe.Event;

  try {
    const signature = req.headers["stripe-signature"] as string;
    if (!signature) {
      console.error("❌ Missing Stripe signature header");
      return res.status(400).send("Missing Stripe signature");
    }

    const rawBody = await getRawBody(req);

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    console.error("❌ Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const shouldProcess = await recordStripeEvent(event.id);
  if (!shouldProcess) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = extractMetadata(session);
        const amount = session.amount_total ?? 0;
        await processInvoicePayment(amount, metadata);
        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const metadata = extractMetadata(intent);
        const amount = intent.amount_received ?? intent.amount ?? 0;
        await processInvoicePayment(amount, metadata);
        break;
      }

      case "charge.succeeded": {
        const charge = event.data.object as Stripe.Charge;
        const metadata = extractMetadata(charge);
        const amount = charge.amount ?? 0;
        await processInvoicePayment(amount, metadata);
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = intent.metadata?.invoice_id;

        if (invoiceId) {
          const { error: updateError } = await supabaseAdmin
            .from("invoices")
            .update({
              payment_status: "failed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", invoiceId);

          if (updateError) {
            console.error("❌ Failed to mark invoice as failed:", updateError);
          }
        }

        break;
      }

      default:
        console.log("ℹ️ Unhandled Stripe event type:", event.type);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ Webhook handler error:", err);
    return res.status(200).json({ received: true, error: "internal_error" });
  }
}
