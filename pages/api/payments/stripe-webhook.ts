// pages/api/payments/stripe-webhook.ts /// webhook for external clients // pages/api/payments/stripe-webhook.ts
// -------------------------------------------------------------
// PURPOSE:
// This is the INVOICE PAYMENT WEBHOOK.
//
// It handles payments made by EXTERNAL CLIENTS via Stripe
// (Payment Links, Checkout Sessions, Payment Intents, Charges).
//
// Responsibilities:
// - Mark invoices as paid
// - Create ledger transactions
// - Create invoice_payments entries
// - Send receipt emails
// - Handle payment failures
// - Ensure idempotency
//
// IMPORTANT:
// This webhook does NOT handle Stripe Connect onboarding,
// payouts, balance transactions, webhook health, or updates
// to payment_settings. Those belong in a separate webhook.
// -------------------------------------------------------------

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
// Helper: Process a successful invoice payment (idempotent)
// -------------------------------------------------------------
async function processInvoicePayment(
  amountPence: number,
  metadata: { invoiceId: string | null; userId: string | null; clientId: string | null }
) {
  const { invoiceId, userId, clientId } = metadata;

  if (!invoiceId || !userId) {
    console.error("❌ Missing metadata — cannot match invoice");
    return;
  }

  // Fetch invoice
  const { data: invoice } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .single();

  if (!invoice) {
    console.error("❌ Invoice not found:", invoiceId);
    return;
  }

  // Idempotency check
  const { data: existing } = await supabaseAdmin
    .from("invoice_payments")
    .select("id")
    .eq("invoice_id", invoiceId)
    .maybeSingle();

  if (existing) {
    console.log("⏭️ Payment already processed — skipping");
    return;
  }

  const amountPaid = amountPence / 100;

  // 1. Mark invoice as paid
  await supabaseAdmin
    .from("invoices")
    .update({
      status: "paid",
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId);

  // 2. Create transaction
  const { data: transaction, error: txError } = await supabaseAdmin
    .from("transactions")
    .insert({
      user_id: userId,
      client_id: clientId,
      amount: amountPaid,
      type: "income",
      description: `Invoice ${invoice.invoice_number} payment`,
      date: new Date().toISOString(),
      includedinct: true,
      includedinsa: true,
      includedinvat: true,
    })
    .select()
    .single();

  if (txError) {
    console.error("❌ Failed to create transaction:", txError);
    return;
  }

  // 3. Create invoice_payments entry
  await supabaseAdmin.from("invoice_payments").insert({
    invoice_id: invoiceId,
    transaction_id: transaction.id,
    amount: amountPaid,
    match_confidence: "high",
    source: "stripe",
  });

  // 4. Send receipt email
  try {
    const { data: customer } = await supabaseAdmin
      .from("external_clients")
      .select("*")
      .eq("id", invoice.client_id)
      .maybeSingle();

    const { data: owner } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", invoice.user_id)
      .maybeSingle();

    await sendInvoiceEmail({ invoice, customer, owner });
  } catch (err) {
    console.error("⚠️ Failed to send receipt email:", err);
  }

  console.log("✅ Invoice payment processed:", invoiceId);
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
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    console.error("❌ Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      // ---------------------------------------------------------
      // Payment Link → Checkout Session completed
      // ---------------------------------------------------------
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = extractMetadata(session);
        const amount = session.amount_total ?? 0;
        await processInvoicePayment(amount, metadata);
        break;
      }

      // ---------------------------------------------------------
      // Payment Intent succeeded (backup)
      // ---------------------------------------------------------
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const metadata = extractMetadata(intent);
        const amount = intent.amount_received ?? intent.amount ?? 0;
        await processInvoicePayment(amount, metadata);
        break;
      }

      // ---------------------------------------------------------
      // Charge succeeded (final fallback)
      // ---------------------------------------------------------
      case "charge.succeeded": {
        const charge = event.data.object as Stripe.Charge;
        const metadata = extractMetadata(charge);
        const amount = charge.amount ?? 0;
        await processInvoicePayment(amount, metadata);
        break;
      }

      // ---------------------------------------------------------
      // Payment failed
      // ---------------------------------------------------------
      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = intent.metadata?.invoice_id;

        if (invoiceId) {
          await supabaseAdmin
            .from("invoices")
            .update({
              payment_status: "failed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", invoiceId);
        }

        break;
      }

      default:
        console.log("ℹ️ Unhandled event:", event.type);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ Webhook handler error:", err);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}
