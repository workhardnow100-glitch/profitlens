import { supabaseAdmin } from "../supabase-admin";
import { createPdfBuffer, storePdfAndRecord } from "../pdf/engine";
import { buildInvoicePdf } from "../pdf/templates/invoice";
import { sendMail } from "../email/smtp";
import { buildInvoiceEmail } from "../email/templates/invoiceEmail";

// -------------------------------------------------------------
// 1. Generate next invoice number
// -------------------------------------------------------------
async function generateNextInvoiceNumber(userId: string) {
  const { data: settings } = await supabaseAdmin
    .from("user_invoice_settings")
    .select("default_invoice_prefix")
    .eq("user_id", userId)
    .maybeSingle();

  const prefix = settings?.default_invoice_prefix?.trim() || "INV-";

  const { data: lastInvoice } = await supabaseAdmin
    .from("invoices")
    .select("invoice_number")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastInvoice?.invoice_number) return `${prefix}1`;

  const match = lastInvoice.invoice_number.match(/(\d+)$/);
  const lastNumber = match ? parseInt(match[1], 10) : 0;

  return `${prefix}${lastNumber + 1}`;
}

// -------------------------------------------------------------
// 2. Compute totals
// -------------------------------------------------------------
function computeTotals(items: any[]) {
  let net = 0;
  let tax = 0;

  for (const item of items) {
    const lineNet = item.quantity * item.unit_price;
    const lineTax = (lineNet * (item.vat_rate || 0)) / 100;
    net += lineNet;
    tax += lineTax;
  }

  return {
    net_amount: net,
    tax_amount: tax,
    gross_amount: net + tax,
  };
}

// -------------------------------------------------------------
// 3. MAIN FUNCTION — CREATE FULL REAL INVOICE
// -------------------------------------------------------------
export async function createInvoiceFromSchedule(schedule: any) {
  const {
    user_id,                     // platform user (sender)
    client_id,                   // external client (recipient)
    template_line_items,
    template_payment_instructions,
    template_payment_terms,
    template_notes,
    id: scheduleId,
  } = schedule;

  const todayISO = new Date().toISOString().split("T")[0];

  // -------------------------------------------------------------
  // A) Fetch sender business profile (CORRECT LOOKUP)
  // -------------------------------------------------------------
  const { data: senderClient, error: senderErr } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("owner_id", user_id)     // <-- THIS IS THE CORRECT RELATIONSHIP
    .single();

  if (senderErr || !senderClient) {
    console.error("Sender business fetch error:", senderErr);
    throw new Error("Business not found for recurring invoice");
  }

 // Fetch subscription from app_users (correct table)
const { data: appUser, error: appUserErr } = await supabaseAdmin
  .from("app_users")
  .select("subscription_status")
  .eq("id", user_id)
  .single();

if (appUserErr || !appUser) {
  console.error("Failed to fetch subscription:", appUserErr);
  throw new Error("Unable to verify subscription");
}

const isSubscribed = ["basic", "pro", "trialing"].includes(
  appUser.subscription_status
);

if (!isSubscribed) {
  throw new Error("Subscription inactive — cannot generate invoice");
}


  // -------------------------------------------------------------
  // B) Fetch external client (recipient)
  // -------------------------------------------------------------
  const { data: externalClient, error: extErr } = await supabaseAdmin
    .from("external_clients")
    .select("*")
    .eq("id", client_id)
    .eq("owner_id", user_id)
    .single();

  if (extErr || !externalClient) {
    console.error("External client fetch error:", extErr);
    throw new Error("External client not found for recurring invoice");
  }

  if (!externalClient.contact_email) {
    throw new Error("External client has no email address");
  }

  // -------------------------------------------------------------
  // C) Validate line items
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // D) Compute totals
  // -------------------------------------------------------------
  const totals = computeTotals(template_line_items);

  // -------------------------------------------------------------
  // E) Generate invoice number
  // -------------------------------------------------------------
  const invoiceNumber = await generateNextInvoiceNumber(user_id);

  // -------------------------------------------------------------
  // F) Create invoice row
  // -------------------------------------------------------------
  const { data: invoice, error: invoiceErr } = await supabaseAdmin
    .from("invoices")
    .insert({
      user_id,
      client_id,
      invoice_number: invoiceNumber,
      status: "sent",
      issue_date: todayISO,
      due_date: todayISO,
      currency: "GBP",
      net_amount: totals.net_amount,
      tax_amount: totals.tax_amount,
      gross_amount: totals.gross_amount,
      payment_terms: template_payment_terms || "Payment due on receipt",
      payment_instructions: template_payment_instructions
        ? { text: template_payment_instructions }
        : {},
      notes_to_client: template_notes || "",
      created_from_schedule_id: scheduleId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (invoiceErr || !invoice) {
    console.error("Error creating invoice from schedule:", invoiceErr);
    throw new Error("Failed to create invoice from schedule");
  }

  // -------------------------------------------------------------
  // G) Insert line items
  // -------------------------------------------------------------
  const lineItemsToInsert = template_line_items.map((item: any, index: number) => ({
    invoice_id: invoice.id,
    description: item.description || "",
    quantity: item.quantity,
    unit_price: item.unit_price,
    vat_rate: item.vat_rate || 0,
    line_total:
      item.quantity * item.unit_price * (1 + (item.vat_rate || 0) / 100),
    position: index,
  }));

  await supabaseAdmin.from("invoice_line_items").insert(lineItemsToInsert);

  // -------------------------------------------------------------
  // H) Payments (none for new invoice)
  // -------------------------------------------------------------
  const payments: any[] = [];

  // -------------------------------------------------------------
  // I) Generate PDF
  // -------------------------------------------------------------
  let pdfBuffer: Buffer | null = null;

  try {
    pdfBuffer = await createPdfBuffer((doc) =>
      buildInvoicePdf(doc, {
        invoice,
        externalClient,
        senderClient,
        lineItems: template_line_items,
        payments,
        paymentLinkUrl: invoice.stripe_payment_link_url || null,
      })
    );
  } catch (err) {
    console.error("PDF generation failed:", err);
  }

  // -------------------------------------------------------------
  // J) Store PDF
  // -------------------------------------------------------------
  if (pdfBuffer) {
    try {
      const filename = `invoice-${invoice.invoice_number}.pdf`;

      await storePdfAndRecord({
        clientId: invoice.client_id,
        type: "invoice",
        periodStart: invoice.issue_date,
        periodEnd: invoice.due_date,
        year: new Date(invoice.issue_date).getFullYear(),
        taxYear: null,
        filename,
        createdBy: invoice.user_id,
        metadata: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          createdFromScheduleId: scheduleId,
        },
        buffer: pdfBuffer,
      });
    } catch (err) {
      console.error("Failed to store PDF:", err);
    }
  }

  // -------------------------------------------------------------
  // K) Build email content
  // -------------------------------------------------------------
  const { subject, html, text } = buildInvoiceEmail({
    invoice,
    externalClient,
    senderClient,
    paymentLinkUrl: invoice.stripe_payment_link_url || null,
  });

  // -------------------------------------------------------------
  // L) Send email
  // -------------------------------------------------------------
  try {
    const filename = `invoice-${invoice.invoice_number}.pdf`;

    await sendMail({
      to: externalClient.contact_email,
      subject,
      html,
      text,
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

    await supabaseAdmin.from("invoice_email_events").insert([
      {
        invoice_id: invoice.id,
        external_client_id: invoice.client_id,
        user_id: invoice.user_id,
        to_email: externalClient.contact_email,
        subject,
        status: "sent",
        metadata: {
          invoice_number: invoice.invoice_number,
          created_from_schedule_id: scheduleId,
        },
      },
    ]);
  } catch (err) {
    console.error("Failed to send recurring invoice email:", err);
  }

  // -------------------------------------------------------------
  // M) Return invoice for Run‑Now + cron
  // -------------------------------------------------------------
  return invoice;
}
