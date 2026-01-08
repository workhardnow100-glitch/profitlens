import { supabaseAdmin } from "../supabase-admin";
import { createPdfBuffer, storePdfAndRecord } from "../pdf/engine";
import { buildInvoicePdf } from "../pdf/templates/invoice";
import { sendMail } from "../email/smtp";
import { buildInvoiceEmail } from "../email/templates/invoiceEmail";

export async function createInvoiceFromSchedule(schedule: any) {
  const {
    user_id,
    client_id, // external_clients.id
    template_line_items,
    template_payment_instructions,
    template_notes,
    id: scheduleId,
  } = schedule;

  const now = new Date().toISOString();

  //
  // ⭐ 1) Validate BUSINESS (subscription) via clients.owner_id = user_id
  //
  const { data: business, error: businessErr } = await supabaseAdmin
    .from("clients")
    .select("id, subscription_status, business_name")
    .eq("owner_id", user_id)
    .single();

  if (businessErr || !business) {
    throw new Error("Business not found for recurring invoice");
  }

  const isSubscribed = ["basic", "pro", "trialing"].includes(
    business.subscription_status
  );

  if (!isSubscribed) {
    throw new Error("Business subscription inactive — cannot generate invoice");
  }

  //
  // ⭐ 2) Validate EXTERNAL CLIENT (recipient)
  //
  const { data: externalClient, error: extErr } = await supabaseAdmin
    .from("external_clients")
    .select("*")
    .eq("id", client_id)
    .eq("owner_id", user_id)
    .single();

  if (extErr || !externalClient) {
    throw new Error("External client not found for recurring invoice");
  }

  //
  // ⭐ 3) Validate line items
  //
  if (!Array.isArray(template_line_items) || template_line_items.length === 0) {
    throw new Error("Invalid or empty line items in schedule");
  }

  for (const item of template_line_items) {
    if (
      typeof item.quantity !== "number" ||
      typeof item.unit_price !== "number" ||
      item.quantity < 0 ||
      item.unit_price < 0
    ) {
      throw new Error("Invalid line item values");
    }
  }

  //
  // ⭐ 4) Compute total
  //
  const total = computeTotalFromLineItems(template_line_items);

  //
  // ⭐ 5) Create INVOICE row
  //
  const { data: invoice, error: invoiceErr } = await supabaseAdmin
    .from("invoices")
    .insert({
      user_id,
      client_id, // external client id
      line_items: template_line_items, // keep JSON for compatibility
      payment_instructions: template_payment_instructions,
      notes: template_notes,
      total,
      status: "sent",
      created_from_schedule_id: scheduleId,
      created_at: now,
      updated_at: now,
      email_status: "pending",
    })
    .select()
    .single();

  if (invoiceErr || !invoice) {
    console.error("Error creating invoice from schedule:", invoiceErr);
    throw new Error("Failed to create invoice from schedule");
  }

  //
  // ⭐ 6) Insert line items into invoice_line_items
  //
  try {
    const lineItemsToInsert = template_line_items.map((item: any, index: number) => ({
      invoice_id: invoice.id,
      description: item.description || "",
      quantity: item.quantity,
      unit_price: item.unit_price,
      vat_rate: item.vat_rate || 0,
      position: index,
    }));

    if (lineItemsToInsert.length > 0) {
      const { error: lineInsertErr } = await supabaseAdmin
        .from("invoice_line_items")
        .insert(lineItemsToInsert);

      if (lineInsertErr) {
        console.error("Failed to insert invoice_line_items for recurring invoice:", lineInsertErr);
      }
    }
  } catch (lineErr) {
    console.error("Unexpected error inserting invoice_line_items:", lineErr);
  }

  //
  // ⭐ 7) Fetch payments (for PDF + email parity)
  //
  const { data: payments, error: payError } = await supabaseAdmin
    .from("invoice_payments")
    .select("*, transactions(*)")
    .eq("invoice_id", invoice.id);

  if (payError) {
    console.error("Payments fetch error for recurring invoice:", payError);
  }

  const paymentLinkUrl = invoice.stripe_payment_link_url || null;

  //
  // ⭐ 8) Fetch SENDER BUSINESS PROFILE (same as /[id]/pdf.ts and /[id]/send.ts)
  //
  const { data: senderClient, error: senderError } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("owner_id", invoice.user_id)
    .single();

  if (senderError || !senderClient) {
    console.error("Sender client fetch error for recurring invoice:", senderError);
  }

  //
  // ⭐ 9) Build PDF buffer (same as /[id]/pdf.ts)
  //
  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = (await createPdfBuffer((doc) =>
      buildInvoicePdf(doc, {
        invoice,
        externalClient,
        senderClient,
        lineItems: template_line_items || [],
        payments: payments || [],
        paymentLinkUrl,
      })
    )) as Buffer;
  } catch (pdfErr) {
    console.error("Failed to build PDF buffer for recurring invoice:", pdfErr);
  }

  //
  // ⭐ 10) Store PDF in bucket + pdf_documents (if buffer exists)
  //
  if (pdfBuffer) {
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
        createdBy: invoice.user_id,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          status: invoice.status,
          createdFromScheduleId: scheduleId,
        },
        buffer: pdfBuffer,
      });
    } catch (storeErr) {
      console.error("Failed to store recurring invoice PDF:", storeErr);
    }
  }

  //
  // ⭐ 11) Build email content (same as /[id]/send.ts)
  //
  let emailSubject: string | undefined;
  let emailHtml: string | undefined;
  let emailText: string | undefined;

  try {
    const emailContent = buildInvoiceEmail({
      invoice,
      externalClient,
      senderClient,
      paymentLinkUrl,
    });

    emailSubject = emailContent.subject;
    emailHtml = emailContent.html;
    emailText = emailContent.text;
  } catch (emailBuildErr) {
    console.error("Failed to build recurring invoice email content:", emailBuildErr);
  }

  //
  // ⭐ 12) Send email with PDF attachment (if we have both)
  //
  if (emailSubject && emailHtml && externalClient.contact_email) {
    try {
      const filename = `invoice-${invoice.invoice_number || invoice.id}.pdf`;

      await sendMail({
        to: externalClient.contact_email,
        subject: emailSubject,
        html: emailHtml,
        text: emailText,
        attachments: pdfBuffer
          ? [
              {
                filename,
                content: pdfBuffer,
                contentType: "application/pdf",
              },
            ]
          : [],
      });

      await supabaseAdmin
        .from("invoices")
        .update({ email_status: "sent", updated_at: now })
        .eq("id", invoice.id);

      try {
        await supabaseAdmin.from("invoice_email_events").insert([
          {
            invoice_id: invoice.id,
            external_client_id: invoice.client_id,
            user_id: invoice.user_id,
            to_email: externalClient.contact_email,
            subject: emailSubject,
            status: "sent",
            metadata: {
              invoice_number: invoice.invoice_number,
              payment_link_used: !!paymentLinkUrl,
              created_from_schedule_id: scheduleId,
            },
          },
        ]);
      } catch (auditErr) {
        console.error("Failed to record invoice_email_events for recurring invoice:", auditErr);
      }
    } catch (sendErr) {
      console.error("Failed to send recurring invoice email:", sendErr);

      await supabaseAdmin
        .from("invoices")
        .update({ email_status: "failed", updated_at: now })
        .eq("id", invoice.id);

      try {
        await supabaseAdmin.from("invoice_email_events").insert([
          {
            invoice_id: invoice.id,
            external_client_id: invoice.client_id,
            user_id: invoice.user_id,
            to_email: externalClient.contact_email,
            subject: emailSubject,
            status: "failed",
            metadata: {
              invoice_number: invoice.invoice_number,
              payment_link_used: !!paymentLinkUrl,
              created_from_schedule_id: scheduleId,
              error: (sendErr as any)?.message || sendErr,
            },
          },
        ]);
      } catch (auditErr) {
        console.error("Failed to record failed invoice_email_events for recurring invoice:", auditErr);
      }
    }
  } else {
    console.error(
      "Skipping recurring invoice email: missing subject/html or external client email",
      { emailSubject, hasHtml: !!emailHtml, contactEmail: externalClient.contact_email }
    );
  }

  return invoice;
}

function computeTotalFromLineItems(items: any[]) {
  if (!items) return 0;
  return items.reduce((sum, item) => {
    const net = item.quantity * item.unit_price;
    const vat = (net * (item.vat_rate || 0)) / 100;
    return sum + net + vat;
  }, 0);
}
