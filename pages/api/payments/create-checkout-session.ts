// pages/api/payments/create-checkout-session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../lib/supabase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { invoiceId } = req.body;
  if (!invoiceId) return res.status(400).json({ error: "Missing invoiceId" });

  const { data: invoice, error } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (error || !invoice) return res.status(404).json({ error: "Invoice not found" });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/invoice/${invoiceId}?status=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pay/invoice/${invoiceId}?status=cancelled`,
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Invoice ${invoiceId}`,
          },
          unit_amount: invoice.total, // already in pence
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoice_id: invoiceId,
      user_id: invoice.user_id,
    },
  });

  return res.status(200).json({ url: session.url });
}
