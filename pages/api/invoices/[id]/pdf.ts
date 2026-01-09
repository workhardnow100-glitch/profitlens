// pages/api/invoices/[id]/pdf.ts
// PURPOSE:
//   Generate and return a PDF for a single invoice.
//
// WHAT THIS ENDPOINT DOES:
//   1. Validates RBAC permissions (Founder, Accountant, User)
//   2. Loads the invoice row
//   3. Loads the external client (recipient)
//   4. Loads the sender business profile
//   5. Loads invoice line items (unit_price + line_total in pence)
//   6. Loads matched payments
//   7. Calls buildInvoicePdf() to generate the PDF buffer
//   8. Stores the PDF in Supabase Storage + pdf_documents table
//   9. Streams the PDF to the browser
//
// MONEY MODEL (CRITICAL):
//   • This endpoint does NOT perform any money conversion.
//   • It simply passes invoice + line items to buildInvoicePdf().
//   • buildInvoicePdf() handles pence → pounds conversion correctly.
//   • No changes required for the unified money system.
//
// VERIFIED:
//   • No money logic exists here.
//   • No formatting drift.
//   • No risk of mismatched totals.
//   • Safe and correct.

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { requireRole } from "../../../../lib/rbac";
import { createPdfBuffer, storePdfAndRecord } from "../../../../lib/pdf/engine";
import { buildInvoicePdf } from "../../../../lib/pdf/templates/invoice";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // RBAC: Founder, Accountant, User
  const guard = await requireRole(req, res, ["FOUNDER", "ACCOUNTANT", "USER"]);
  if (!guard.ok) return;

  const { userId, role, accessibleClients } = guard;
  const invoiceId = req.query.id as string;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
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
    // 2) ACCESS CONTROL
    //
    if (role === "USER" && invoice.user_id !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (role === "ACCOUNTANT" && !accessibleClients.includes(invoice.client_id)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    //
    // 3) Fetch EXTERNAL CLIENT (customer)
    //
    const { data: externalClient, error: clientError } = await supabaseAdmin
      .from("external_clients")
      .select("*")
      .eq("id", invoice.client_id)
      .eq("owner_id", invoice.user_id)
      .single();

    if (clientError) {
      console.error("External client fetch error:", clientError);
    }

    //
    // 4) Fetch SENDER BUSINESS PROFILE
    //
    const { data: senderClient, error: senderError } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("owner_id", invoice.user_id)
      .single();

    if (senderError || !senderClient) {
      console.error("Sender client fetch error:", senderError);
      return res.status(500).json({ error: "Failed to fetch sender business profile" });
    }

    //
    // 5) Fetch line items
    //
    const { data: lineItems, error: lineError } = await supabaseAdmin
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("position", { ascending: true });

    if (lineError) {
      console.error("Line item fetch error:", lineError);
      return res.status(500).json({ error: "Failed to fetch line items" });
    }

    //
    // 6) Fetch matched payments
    //
    const { data: payments, error: payError } = await supabaseAdmin
      .from("invoice_payments")
      .select("*, transactions(*)")
      .eq("invoice_id", invoiceId);

    if (payError) {
      console.error("Payments fetch error:", payError);
    }

    const paymentLinkUrl = invoice.stripe_payment_link_url || null;

    //
    // 7) Build PDF buffer
    //
    const buffer = await createPdfBuffer((doc) =>
      buildInvoicePdf(doc, {
        invoice,
        externalClient,
        senderClient,
        lineItems: lineItems || [],
        payments: payments || [],
        paymentLinkUrl,
      })
    );

    //
    // 8) Store PDF record
    //
    try {
      const filename = `invoice-${invoice.invoice_number || invoice.id}.pdf`;

      await storePdfAndRecord({
        clientId: invoice.client_id,
        type: "invoice",
        periodStart: invoice.issue_date || null,
        periodEnd: invoice.due_date || null,
        year: invoice.issue_date ? new Date(invoice.issue_date).getFullYear() : null,
        taxYear: null,
        filename,
        createdBy: userId,
        metadata: {
          invoiceId,
          invoiceNumber: invoice.invoice_number,
          status: invoice.status,
        },
        buffer,
      });
    } catch (storeErr) {
      console.error("Failed to store invoice PDF:", storeErr);
    }

    //
    // 9) Send PDF to browser
    //
    const filenameHeader = `Invoice-${invoice.invoice_number || invoice.id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filenameHeader}"`);
    res.status(200).send(buffer);
  } catch (err) {
    console.error("Invoice PDF error:", err);
    return res.status(500).json({ error: "Failed to generate invoice PDF" });
  }
}
