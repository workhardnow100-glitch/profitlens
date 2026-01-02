// pages/api/payments/stripe-webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { sendInvoiceEmail } from "../../../lib/emails/sendInvoiceEmail";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {});

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers["stripe-signature"] as string;
    event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const invoiceId = session.metadata?.invoice_id;
        const userId = session.metadata?.user_id;

        if (!invoiceId || !userId) {
          console.error("Missing metadata on session");
          break;
        }

        // Fetch invoice
        const { data: invoice, error: invoiceError } = await supabaseAdmin
          .from("invoices")
          .select("*")
          .eq("id", invoiceId)
          .single();

        if (invoiceError || !invoice) {
          console.error("Invoice not found for webhook:", invoiceError);
          break;
        }

        // Idempotency: if an invoice_payment already exists, skip
        const { data: existingPayment } = await supabaseAdmin
          .from("invoice_payments")
          .select("id")
          .eq("invoice_id", invoiceId)
          .maybeSingle();

        if (existingPayment) {
          console.log("Invoice already has a payment record, skipping duplicate processing");
          break;
        }

        const amountTotalPence = session.amount_total ?? 0;
        const amountPaid = amountTotalPence / 100; // store in pounds for transactions

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

        // 2. Load external client + owner for email + attribution
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

        // 3. Create transaction entry (belongs to business owner, client is external client)
        const { data: transaction, error: txError } = await supabaseAdmin
          .from("transactions")
          .insert({
            user_id: userId,
            client_id: invoice.client_id,
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
          console.error("Failed to create transaction:", txError);
          break;
        }

        // 4. Create invoice_payments entry
        await supabaseAdmin.from("invoice_payments").insert({
          invoice_id: invoiceId,
          transaction_id: transaction.id,
          amount: amountPaid,
          match_confidence: "high",
          source: "auto",
        });

        // 5. Send payment receipt email
        try {
          await sendInvoiceEmail({
            invoice,
            customer,
            owner,
          });
        } catch (emailErr) {
          console.error("Failed to send payment receipt email:", emailErr);
        }

        break;
      }

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
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}
