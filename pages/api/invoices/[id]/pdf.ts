// pages/api/invoices/[id]/pdf.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { createPdfBuffer, storePdfAndRecord } from "../../../../lib/pdf/engine";
import { buildInvoicePdf } from "../../../../lib/pdf/templates/invoice";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const userId = session.user.id as string;
  const invoiceId = req.query.id as string;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 1) Fetch invoice
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("user_id", userId)
      .single();

    if (invoiceError || !invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // 2) Fetch EXTERNAL CLIENT (correct FK + correct owner field)
    const { data: externalClient, error: clientError } = await supabaseAdmin
      .from("external_clients")
      .select("*")
      .eq("id", invoice.client_id)     // FIXED
      .eq("owner_id", userId)          // FIXED
      .single();

    if (clientError) {
      console.error("External client fetch error:", clientError);
    }

    // 3) Fetch line items
    const { data: lineItems, error: lineError } = await supabaseAdmin
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("position", { ascending: true });

    if (lineError) {
      console.error("Line item fetch error:", lineError);
      return res.status(500).json({ error: "Failed to fetch line items" });
    }

    // 4) Fetch matched payments
    const { data: payments, error: payError } = await supabaseAdmin
      .from("invoice_payments")
      .select("*, transactions(*)")
      .eq("invoice_id", invoiceId);

    if (payError) {
      console.error("Payments fetch error:", payError);
    }

    const paymentLinkUrl = invoice.stripe_payment_link_url || null;

    // 5) Build PDF buffer
    const buffer = await createPdfBuffer((doc) =>
      buildInvoicePdf(doc, {
        invoice,
        externalClient,
        lineItems: lineItems || [],
        payments: payments || [],
        paymentLinkUrl,
      })
    );

    // 6) Store PDF record
    try {
      const filename = `invoice-${invoice.invoice_number || invoice.id}.pdf`;

      await storePdfAndRecord({
        clientId: invoice.client_id,     // FIXED
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

    // 7) Send PDF to browser
    const filenameHeader = `Invoice-${invoice.invoice_number || invoice.id}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filenameHeader}"`);
    res.status(200).send(buffer);
  } catch (err) {
    console.error("Invoice PDF error:", err);
    return res.status(500).json({ error: "Failed to generate invoice PDF" });
  }
}
