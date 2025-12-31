// pages/api/payments/stripe-webhook.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { sendInvoiceEmail } from "../../../lib/emails/sendInvoiceEmail";

export const config = {
  api: {
    bodyParser: false,
  },
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

async function buffer(readable: any) {
  const chunks: any[] = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["stripe-signature"] as string;
  const buf = await buffer(req);

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const invoiceId = session.metadata?.invoice_id;

    if (invoiceId) {
      // 1. Mark invoice as paid
      const { data: invoice, error: updateError } = await supabaseAdmin
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", invoiceId)
        .select()
        .single();

      if (updateError) {
        console.error("Failed to mark invoice paid:", updateError);
      }

      // 2. Load customer + owner for email
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

      // 3. Send payment receipt email
      try {
        await sendInvoiceEmail({
          invoice,
          customer,
          owner,
        });
      } catch (emailErr) {
        console.error("Failed to send payment receipt email:", emailErr);
      }

      // 4. Insert payment record + platform fee
      try {
        const paymentIntentId = session.payment_intent as string;
        const amountPaid = session.amount_total || 0; // pence

        // Platform fee (2% example)
        const platformFee = Math.round(amountPaid * 0.02);

        await supabaseAdmin.from("payments").insert({
          invoice_id: invoice.id,
          user_id: invoice.user_id,
          client_id: invoice.client_id,
          amount: amountPaid,
          stripe_payment_intent: paymentIntentId,
          platform_fee_amount: platformFee,
        });
      } catch (paymentErr) {
        console.error("Failed to insert payment record:", paymentErr);
      }
    }
  }

  res.status(200).json({ received: true });
}
