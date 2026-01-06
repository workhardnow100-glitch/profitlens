// pages/api/payments/create-checkout-session.ts // pages/api/payments/create-checkout-session.ts
// -------------------------------------------------------------
// PURPOSE:
// This endpoint creates a Stripe Checkout Session for EXTERNAL
// CLIENTS to pay an invoice.
//
// Responsibilities:
// - Fetch invoice + external client
// - Create Stripe Checkout Session
// - Attach metadata (invoice_id, user_id)
// - Apply platform fee (via application_fee_amount)
// - Return the Checkout URL to the frontend
//
// IMPORTANT:
// This endpoint does NOT process payments. All payment success
// and failure handling is done in the invoice payment webhook
// (stripe-webhook.ts).
//
// This endpoint also does NOT handle Stripe Connect onboarding,
// payouts, or webhook health.
// -------------------------------------------------------------

import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../lib/supabase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { invoiceId } = req.body;
  if (!invoiceId)
    return res.status(400).json({ error: "Missing invoiceId" });

  // Fetch invoice
  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (error || !invoice)
    return res.status(404).json({ error: "Invoice not found" });

  // Optional: fetch external client for email
  const { data: externalClient } = await supabaseAdmin
    .from("external_clients")
    .select("*")
    .eq("id", invoice.client_id)
    .maybeSingle();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/invoice/${invoiceId}?status=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/invoice/${invoiceId}?status=cancelled`,

      customer_email: externalClient?.email || undefined,

      billing_address_collection: "required",
      allow_promotion_codes: false,
      automatic_tax: { enabled: false },

      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Invoice ${invoice.invoice_number || invoiceId}`,
            },
            unit_amount: invoice.total,
          },
          quantity: 1,
        },
      ],

      metadata: {
        invoice_id: invoiceId,
        user_id: invoice.user_id,
      },

      payment_intent_data: {
        metadata: {
          invoice_id: invoiceId,
          user_id: invoice.user_id,
        },
        application_fee_amount: Math.round(invoice.total * 0.02), // 2% platform fee
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe Checkout error:", err);
    return res.status(500).json({ error: "Stripe session creation failed" });
  }
}
