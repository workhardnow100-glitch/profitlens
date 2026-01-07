import { supabaseAdmin } from "../supabase-admin";
import { mailer } from "../mailer";
import { generateInvoiceHtml } from "./templates/invoiceHtmlTemplate";

interface SendInvoiceEmailProps {
  invoice: any;
  customer: any;
  owner: any;
}

export async function sendInvoiceEmail({ invoice, customer, owner }: SendInvoiceEmailProps) {
  const now = new Date().toISOString();

  // ⭐ Validate customer email
  const customerEmail = customer?.email?.trim();
  if (!customerEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customerEmail)) {
    console.error("Invalid customer email:", customerEmail);

    await supabaseAdmin.from("invoices").update({
      email_status: "failed",
      updated_at: now,
    }).eq("id", invoice.id);

    await supabaseAdmin.from("audit").insert([
      {
        client_id: invoice.client_id,
        user_id: invoice.user_id,
        action: "INVOICE_EMAIL_FAILED",
        details: `Invalid customer email for invoice ${invoice.id}`,
        timestamp: now,
      },
    ]);

    return;
  }

  // ⭐ Determine sender identity safely
  const senderEmail =
    owner?.email?.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner.email)
      ? owner.email
      : "no-reply@profitlens.app";

  const senderName =
    owner?.business_name?.trim() ||
    owner?.name?.trim() ||
    "ProfitLens";

  // ⭐ Generate HTML safely
  let html: string;
  try {
    html = generateInvoiceHtml({
      invoice,
      customer,
      owner,
    });
  } catch (err) {
    console.error("Invoice HTML generation failed:", err);

    await supabaseAdmin.from("invoices").update({
      email_status: "failed",
      updated_at: now,
    }).eq("id", invoice.id);

    await supabaseAdmin.from("audit").insert([
      {
        client_id: invoice.client_id,
        user_id: invoice.user_id,
        action: "INVOICE_EMAIL_FAILED",
        details: `HTML generation failed for invoice ${invoice.id}`,
        timestamp: now,
      },
    ]);

    return;
  }

  // ⭐ Attempt to send email
  try {
    await mailer.sendMail({
      from: { name: senderName, address: senderEmail },
      to: customerEmail,
      subject: `Invoice from ${senderName}`,
      html,
    });

    console.log(`Invoice email sent to ${customerEmail} for invoice ${invoice.id}`);

    await supabaseAdmin.from("invoices").update({
      email_status: "sent",
      updated_at: now,
    }).eq("id", invoice.id);

    await supabaseAdmin.from("audit").insert([
      {
        client_id: invoice.client_id,
        user_id: invoice.user_id,
        action: "INVOICE_EMAIL_SENT",
        details: `Invoice ${invoice.id} sent to ${customerEmail}`,
        timestamp: now,
      },
    ]);

  } catch (err) {
    console.error("Failed to send invoice email:", err);

    await supabaseAdmin.from("invoices").update({
      email_status: "failed",
      updated_at: now,
    }).eq("id", invoice.id);

    await supabaseAdmin.from("audit").insert([
      {
        client_id: invoice.client_id,
        user_id: invoice.user_id,
        action: "INVOICE_EMAIL_FAILED",
        details: `SendMail error for invoice ${invoice.id}: ${err?.message || err}`,
        timestamp: now,
      },
    ]);
  }
}
