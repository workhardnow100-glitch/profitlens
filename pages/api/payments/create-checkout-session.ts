// pages/api/payments/create-checkout-session.ts
// -------------------------------------------------------------
// PURPOSE:
// Creates a Stripe Checkout Session for EXTERNAL CLIENTS to pay
// an invoice. Applies dynamic platform fees and routes funds to
// the user's connected Stripe account.
// -------------------------------------------------------------

import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { requireRole } from "../../../lib/rbac";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // RBAC: Users, Accountants, and Founder can create checkout sessions
  const guard = await requireRole(req, res, ["FOUNDER", "ACCOUNTANT", "USER"]);
  if (!guard.ok) return;

  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { invoiceId } = req.body;
  if (!invoiceId)
    return res.status(400).json({ error: "Missing invoiceId" });

  // -------------------------------------------------------------
  // 1. Fetch invoice
  // -------------------------------------------------------------
  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from("invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (invoiceError || !invoice)
    return res.status(404).json({ error: "Invoice not found" });

  // -------------------------------------------------------------
  // 2. Access control: ensure user can access this invoice
  // -------------------------------------------------------------
  if (
    guard.role === "USER" &&
    invoice.user_id !== guard.userId
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (
    guard.role === "ACCOUNTANT" &&
    guard.accessibleClients &&
    !guard.accessibleClients.includes(invoice.client_id)
  ) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // -------------------------------------------------------------
  // 3. Fetch external client (for email)
  // -------------------------------------------------------------
  const { data: externalClient } = await supabaseAdmin
    .from("external_clients")
    .select("*")
    .eq("id", invoice.client_id)
    .maybeSingle();

  // -------------------------------------------------------------
  // 4. Load payment_settings for the invoice owner
  // -------------------------------------------------------------
  const { data: settings, error: settingsError } = await supabaseAdmin
    .from("payment_settings")
    .select("*")
    .eq("user_id", invoice.user_id)
    .maybeSingle();

  if (settingsError || !settings)
    return res.status(400).json({ error: "Payment settings not found" });

  // -------------------------------------------------------------
  // 5. Validate Stripe Connect onboarding
  // -------------------------------------------------------------
  if (!settings.stripe_account_id || settings.stripe_status !== "verified") {
    return res.status(400).json({
      error: "Stripe Connect account not fully onboarded",
    });
  }

  // -------------------------------------------------------------
  // 6. Calculate platform fee
  // -------------------------------------------------------------
  const subtotal = invoice.total; // already in pence

  let fee = Math.round(
    subtotal * (settings.platform_fee_percent / 100)
  );

  if (settings.platform_fee_min !== null)
    fee = Math.max(fee, settings.platform_fee_min);

  if (settings.platform_fee_max !== null)
    fee = Math.min(fee, settings.platform_fee_max);

  // -------------------------------------------------------------
  // 7. Create Checkout Session
  // -------------------------------------------------------------
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
            unit_amount: subtotal,
          },
          quantity: 1,
        },
      ],

      metadata: {
        invoice_id: invoiceId,
        user_id: invoice.user_id,
        client_id: invoice.client_id,
      },

      payment_intent_data: {
        metadata: {
          invoice_id: invoiceId,
          user_id: invoice.user_id,
          client_id: invoice.client_id,
        },
        application_fee_amount: fee,
        transfer_data: {
          destination: settings.stripe_account_id,
        },
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe Checkout error:", err);
    return res.status(500).json({ error: "Stripe session creation failed" });
  }
}
