import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { invoiceId } = req.body;
    const userId = session.user.id as string;

    if (!invoiceId) {
      return res.status(400).json({ error: "Missing invoiceId" });
    }

    //
    // 1) Fetch invoice
    //
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("user_id", userId)
      .single();

    if (invoiceError || !invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    //
    // 2) Fetch EXTERNAL CLIENT (correct FK: client_id)
    //
    const { data: externalClient, error: externalClientError } =
      await supabaseAdmin
        .from("external_clients")
        .select("*")
        .eq("id", invoice.client_id)   // FIXED
        .eq("owner_id", userId)
        .single();

    if (externalClientError || !externalClient) {
      return res.status(400).json({ error: "External client not found" });
    }

    if (!externalClient.contact_email) {
      return res.status(400).json({ error: "External client has no email address" });
    }

    //
    // 3) Create Stripe Checkout session
    //
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoiceId}?paid=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoiceId}?cancelled=1`,
      customer_email: externalClient.contact_email,
      metadata: {
        invoice_id: invoiceId,
        user_id: userId,
      },
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
            },
            unit_amount: Math.round(Number(invoice.gross_amount) * 100),
          },
          quantity: 1,
        },
      ],
    });

    //
    // 4) Store payment link + session ID
    //
    await supabaseAdmin
      .from("invoices")
      .update({
        stripe_checkout_session_id: checkoutSession.id,
        stripe_payment_link_url: checkoutSession.url,
        payment_status: "unpaid",
      })
      .eq("id", invoiceId);

    return res.status(200).json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (err) {
    console.error("Stripe error:", err);
    return res.status(500).json({ error: "Failed to create payment link" });
  }
}
