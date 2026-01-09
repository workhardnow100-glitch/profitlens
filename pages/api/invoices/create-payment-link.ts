// pages/api/invoices/create-payment-link.ts
// PURPOSE:
//   Create a Stripe Checkout session for an invoice.
//
// MONEY MODEL (CRITICAL):
//   • invoice.gross_amount is stored in PENCE.
//   • Stripe expects unit_amount in PENCE.
//   • The previous version multiplied by 100, causing 100× overcharging.
//   • This fix removes the multiplication and uses the pence value directly.

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { requireRole } from "../../../lib/rbac";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const guard = await requireRole(req, res, ["FOUNDER", "ACCOUNTANT", "USER"]);
  if (!guard.ok) return;

  const { userId, role, accessibleClients } = guard;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { invoiceId } = req.body;

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
      .single();

    if (invoiceError || !invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    //
    // ACCESS CONTROL
    //
    if (role === "USER" && invoice.user_id !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (role === "ACCOUNTANT" && !accessibleClients.includes(invoice.client_id)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    //
    // 2) Fetch EXTERNAL CLIENT
    //
    const { data: externalClient, error: externalClientError } =
      await supabaseAdmin
        .from("external_clients")
        .select("*")
        .eq("id", invoice.client_id)
        .eq("owner_id", invoice.user_id)
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
        user_id: invoice.user_id,
      },
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
            },
            // ⭐ FIXED: invoice.gross_amount is already in pence
            unit_amount: Number(invoice.gross_amount),
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
