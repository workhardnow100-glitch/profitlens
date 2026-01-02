// pages/api/invoices/[id]/send.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { createPdfBuffer } from "../../../../lib/pdf/engine";
import { buildInvoicePdf } from "../../../../lib/pdf/templates/invoice";
import { sendMail } from "../../../../lib/email/smtp";
import { buildInvoiceEmail } from "../../../../lib/email/templates/invoiceEmail";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const userId = session.user.id as string;
  const invoiceId = req.query.id as string;

  if (req.method !== "POST") {
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
      .eq("user_id", userId)
      .single();

    if (invoiceError || !invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    //
    // 2) Fetch EXTERNAL CLIENT (recipient)
    //
    const { data: externalClient, error: externalClientError } = await supabaseAdmin
      .from("external_clients")
      .select("*")
      .eq("id", invoice.client_id)
      .eq("owner_id", userId)
      .single();

    if (externalClientError || !externalClient) {
      return res.status(400).json({ error: "External client not found or missing" });
    }

    if (!externalClient.contact_email) {
      return res.status(400).json({ error: "External client has no email address" });
    }

    //
    // 3) Fetch SENDER BUSINESS PROFILE
    //
    const { data: senderClient, error: senderError } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("owner_id", userId)
      .single();

    if (senderError || !senderClient) {
      console.error("Sender client fetch error:", senderError);
      return res.status(500).json({ error: "Failed to fetch sender business profile" });
    }

    //
    // 4) Fetch line items
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
    // 5) Fetch payments
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
    // 6) Build PDF buffer
    //
    const pdfBuffer = await createPdfBuffer((doc) =>
      buildInvoicePdf(doc, {
        invoice,
        externalClient,
        senderClient, // <-- NEW
        lineItems: lineItems || [],
        payments: payments || [],
        paymentLinkUrl,
      })
    );

    const filename = `invoice-${invoice.invoice_number || invoice.id}.pdf`;

    //
    // 7) Build email content
    //
    const { subject, html, text } = buildInvoiceEmail({
      invoice,
      externalClient,
      senderClient, // <-- NEW
      paymentLinkUrl,
    });

    //
    // 8) Send email
    //
    await sendMail({
      to: externalClient.contact_email,
      subject,
      html,
      text,
      attachments: [
        {
          filename,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    //
    // 9) Audit log
    //
    try {
      await supabaseAdmin.from("invoice_email_events").insert([
        {
          invoice_id: invoiceId,
          external_client_id: invoice.client_id,
          user_id: userId,
          to_email: externalClient.contact_email,
          subject,
          status: "sent",
          metadata: {
            invoice_number: invoice.invoice_number,
            payment_link_used: !!paymentLinkUrl,
          },
        },
      ]);
    } catch (auditErr) {
      console.error("Failed to record invoice_email_events:", auditErr);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Invoice send error:", err);
    return res.status(500).json({ error: "Failed to send invoice email" });
  }
}
