/**
 * Builds the subject, HTML, and text body for an invoice email.
 *
 * @param {{
 *   invoice: any;
 *   externalClient: any;
 *   paymentLinkUrl?: string | null;
 * }} params
 */
export function buildInvoiceEmail({ invoice, externalClient, paymentLinkUrl }) {
  // Determine the best display name for the external client
  const clientName =
    externalClient?.contact_name ||
    externalClient?.business_name ||
    externalClient?.trading_name ||
    "Customer";

  const issueDate = invoice.issue_date
    ? new Date(invoice.issue_date).toISOString().slice(0, 10)
    : "";

  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toISOString().slice(0, 10)
    : "";

  const amount = Number(invoice.gross_amount || 0).toFixed(2);

  const subject = `Invoice ${invoice.invoice_number} from ProfitLens Billing`;

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

      <p>
        If you have any questions about this invoice, please reply to this email.
      </p>

      <p>Best regards,<br/>ProfitLens Billing</p>
    </div>
  `;

  const text = `
Hi ${clientName},

Please find attached your invoice ${invoice.invoice_number} for £${amount}.

Issue date: ${issueDate}
Due date: ${dueDate}

${paymentSectionText}If you have any questions about this invoice, please reply to this email.

Best regards,
ProfitLens Billing
`.trim();

  return { subject, html, text };
}
