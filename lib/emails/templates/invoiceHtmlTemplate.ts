// lib/email/templates/invoiceHtmlTemplate.ts
// PURPOSE:
//   Generates the HTML body for manual invoice emails.
//
// MONEY MODEL (CRITICAL):
//   • invoice amounts are stored in PENCE (net_amount, tax_amount, gross_amount).
//   • This template MUST convert pence → pounds exactly once.
//   • The previous version incorrectly used invoice.total (non‑existent),
//     causing incorrect totals in manual invoice emails.

function esc(v) {
  return String(v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateInvoiceHtml({ invoice, customer, owner }) {
  const businessName = owner?.business_name || owner?.name || "Your Business";
  const tradingName = owner?.trading_name ? `Trading as: ${owner.trading_name}` : "";
  const address = owner?.registered_address || owner?.address || "";
  const postcode = owner?.postcode || "";
  const companyNumber = owner?.company_number ? `Company No: ${owner.company_number}` : "";
  const vatNumber = owner?.vat_number ? `VAT No: ${owner.vat_number}` : "";
  const email = owner?.email || "";
  const phone = owner?.phone || "";
  const website = owner?.website ? `Website: ${owner.website}` : "";
  const logo = owner?.logo_url || null;

  const customerName = customer?.name || "Customer";

  // ⭐ FIXED: Convert pence → pounds using gross_amount
  const totalFormatted = (Number(invoice.gross_amount || 0) / 100).toFixed(2);

  const payUrl = invoice.stripe_payment_link_url || null;

  return `
  <div style="background:#f5f7fa; padding:40px 0; font-family:Arial, sans-serif;">
    <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">

      <div style="background:#111827; padding:24px; text-align:center;">
        ${logo ? `<img src="${esc(logo)}" alt="${esc(businessName)} Logo" style="max-height:60px; margin-bottom:12px;" />` : `<div style="height:40px;"></div>`}
        <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:600;">
          Invoice from ${esc(businessName)}
        </h1>
      </div>

      <div style="padding:24px; border-bottom:1px solid #e5e7eb; font-size:14px; color:#374151;">
        <strong style="font-size:16px;">${esc(businessName)}</strong><br>
        ${tradingName ? `${esc(tradingName)}<br>` : ""}
        ${address ? `${esc(address)}<br>` : ""}
        ${postcode ? `${esc(postcode)}<br>` : ""}
        ${companyNumber ? `${esc(companyNumber)}<br>` : ""}
        ${vatNumber ? `${esc(vatNumber)}<br>` : ""}
        ${email ? `Email: ${esc(email)}<br>` : ""}
        ${phone ? `Phone: ${esc(phone)}<br>` : ""}
        ${website ? `${esc(website)}<br>` : ""}
      </div>

      <div style="padding:32px; color:#374151; font-size:16px; line-height:1.6;">
        <p style="margin-top:0;">Hi ${esc(customerName)},</p>

        <p>
          You have received a new invoice from <strong>${esc(businessName)}</strong>.
          Please review the details below and complete payment using the secure link.
        </p>

        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:20px; margin:24px 0;">
          <p><strong>Invoice ID:</strong> ${esc(invoice.id)}</p>
          <p><strong>Total Amount:</strong> £${esc(totalFormatted)}</p>
          <p><strong>Status:</strong> ${esc(invoice.status)}</p>
        </div>

        ${
          payUrl
            ? `
        <div style="text-align:center; margin:32px 0;">
          <a href="${esc(payUrl)}"
            style="background:#2563eb; color:#ffffff; padding:14px 28px; border-radius:8px; text-decoration:none; font-size:16px; font-weight:600; display:inline-block;">
            Pay Invoice
          </a>
        </div>`
            : `
        <p style="color:#b91c1c; font-weight:600;">
          No payment link available. Please contact the sender.
        </p>`
        }

        <p>If you have any questions about this invoice, feel free to reply directly to this email.</p>

        <p style="margin-bottom:0;">
          Thank you,<br>
          <strong>${esc(businessName)}</strong>
        </p>
      </div>

      <div style="background:#f3f4f6; padding:16px; text-align:center; font-size:12px; color:#6b7280;">
        <p style="margin:0;">
          This invoice was sent via <strong>ProfitLens</strong> — the unified cockpit for business, tax, and payments.
        </p>
      </div>

    </div>
  </div>
  `;
}
