/**
 * Builds the subject, HTML, and text body for an invoice email.
 *
 * @param {{
 *   invoice: any;
 *   externalClient: any;
 *   senderClient: any; // <-- ADD THIS
 *   paymentLinkUrl?: string | null;
 * }} params
 */
export function buildInvoiceEmail({ invoice, externalClient, senderClient, paymentLinkUrl }) {
  // Determine the best display name for the external client
  const clientName =
    externalClient?.contact_name ||
    externalClient?.business_name ||
    externalClient?.trading_name ||
    "Customer";

  // Sender (business issuing the invoice)
  const businessName = senderClient?.business_name || senderClient?.name || "Your Business";
  const tradingName = senderClient?.trading_name ? `Trading as: ${senderClient.trading_name}` : "";
  const address = senderClient?.registered_address || senderClient?.address || "";
  const postcode = senderClient?.postcode || "";
  const companyNumber = senderClient?.company_number ? `Company No: ${senderClient.company_number}` : "";
  const vatNumber = senderClient?.vat_number ? `VAT No: ${senderClient.vat_number}` : "";
  const email = senderClient?.email || "";
  const phone = senderClient?.phone || "";
  const website = senderClient?.website ? `Website: ${senderClient.website}` : "";

  const issueDate = invoice.issue_date
    ? new Date(invoice.issue_date).toISOString().slice(0, 10)
    : "";

  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toISOString().slice(0, 10)
    : "";

  const amount = Number(invoice.gross_amount || 0).toFixed(2);

  const subject = `Invoice ${invoice.invoice_number} from ${businessName}`;

  const paymentSectionHtml = paymentLinkUrl
    ? `
      <p>You can pay this invoice securely online using the link below:</p>
      <p>
        <a href="${paymentLinkUrl}" style="color:#2563eb;">
          Pay Invoice Online
        </a>
      </p>
    `
    : `
      <p>Please refer to the payment instructions on the attached invoice PDF.</p>
    `;

  const paymentSectionText = paymentLinkUrl
    ? `You can pay this invoice online:\n${paymentLinkUrl}\n\n`
    : `Please refer to the payment instructions on the attached invoice PDF.\n\n`;

  const html = `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; color: #111827;">
      <p>Hi ${clientName},</p>

      <p>
        Please find attached your invoice <strong>${invoice.invoice_number}</strong>
        for <strong>£${amount}</strong>.
      </p>

      <p>
        <strong>Issue date:</strong> ${issueDate}<br/>
        <strong>Due date:</strong> ${dueDate}
      </p>

      ${paymentSectionHtml}

      <p>If you have any questions about this invoice, please reply to this email.</p>

      <br/>

      <!-- Sender Block -->
      <div style="margin-top:20px; padding:12px; background:#f9fafb; border-left:4px solid #2563eb;">
        <strong>${businessName}</strong><br/>
        ${tradingName ? `${tradingName}<br/>` : ""}
        ${address ? `${address}<br/>` : ""}
        ${postcode ? `${postcode}<br/>` : ""}
        ${companyNumber ? `${companyNumber}<br/>` : ""}
        ${vatNumber ? `${vatNumber}<br/>` : ""}
        ${email ? `Email: ${email}<br/>` : ""}
        ${phone ? `Phone: ${phone}<br/>` : ""}
        ${website ? `${website}<br/>` : ""}
        <br/>
        <em>Sent securely via ProfitLens Billing</em>
      </div>
    </div>
  `;

  const text = `
Hi ${clientName},

Please find attached your invoice ${invoice.invoice_number} for £${amount}.

Issue date: ${issueDate}
Due date: ${dueDate}

${paymentSectionText}

From:
${businessName}
${tradingName ? tradingName + "\n" : ""}
${address ? address + "\n" : ""}
${postcode ? postcode + "\n" : ""}
${companyNumber ? companyNumber + "\n" : ""}
${vatNumber ? vatNumber + "\n" : ""}
${email ? "Email: " + email + "\n" : ""}
${phone ? "Phone: " + phone + "\n" : ""}
${website ? website + "\n" : ""}

Sent securely via ProfitLens Billing
`.trim();

  return { subject, html, text };
}
