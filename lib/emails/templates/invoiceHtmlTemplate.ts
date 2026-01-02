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
  const totalFormatted = (invoice.total / 100).toFixed(2);

  // ⭐ Use Stripe Payment Link (automatically generated)
  const payUrl = invoice.stripe_payment_link_url;

  return `
  <div style="background:#f5f7fa; padding:40px 0; font-family:Arial, sans-serif;">
    <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">

      <!-- Header -->
      <div style="background:#111827; padding:24px; text-align:center;">
        ${logo ? `<img src="${logo}" alt="${businessName} Logo" style="max-height:60px; margin-bottom:12px;" />` : ""}
        <h1 style="color:#ffffff; margin:0; font-size:24px; font-weight:600;">
          Invoice from ${businessName}
        </h1>
      </div>

      <!-- Sender Block -->
      <div style="padding:24px; border-bottom:1px solid #e5e7eb; font-size:14px; color:#374151;">
        <strong style="font-size:16px;">${businessName}</strong><br>
        ${tradingName ? `${tradingName}<br>` : ""}
        ${address ? `${address}<br>` : ""}
        ${postcode ? `${postcode}<br>` : ""}
        ${companyNumber ? `${companyNumber}<br>` : ""}
        ${vatNumber ? `${vatNumber}<br>` : ""}
        ${email ? `Email: ${email}<br>` : ""}
        ${phone ? `Phone: ${phone}<br>` : ""}
        ${website ? `${website}<br>` : ""}
      </div>

      <!-- Body -->
      <div style="padding:32px; color:#374151; font-size:16px; line-height:1.6;">
        <p style="margin-top:0;">Hi ${customerName},</p>

        <p>
          You have received a new invoice from <strong>${businessName}</strong>.
          Please review the details below and complete payment using the secure link.
        </p>

        <!-- Invoice Summary Card -->
        <div style="
          background:#f9fafb;
          border:1px solid #e5e7eb;
          border-radius:10px;
          padding:20px;
          margin:24px 0;
        ">
          <p style="margin:0 0 8px 0;"><strong>Invoice ID:</strong> ${invoice.id}</p>
          <p style="margin:0 0 8px 0;"><strong>Total Amount:</strong> £${totalFormatted}</p>
          <p style="margin:0;"><strong>Status:</strong> ${invoice.status}</p>
        </div>

        <!-- Pay Button -->
        <div style="text-align:center; margin:32px 0;">
          <a href="${payUrl}"
            style="
              background:#2563eb;
              color:#ffffff;
              padding:14px 28px;
              border-radius:8px;
              text-decoration:none;
              font-size:16px;
              font-weight:600;
              display:inline-block;
            ">
            Pay Invoice
          </a>
        </div>

        <p>
          If you have any questions about this invoice, feel free to reply directly to this email.
        </p>

        <p style="margin-bottom:0;">
          Thank you,<br>
          <strong>${businessName}</strong>
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#f3f4f6; padding:16px; text-align:center; font-size:12px; color:#6b7280;">
        <p style="margin:0;">
          This invoice was sent via <strong>ProfitLens</strong> — the unified cockpit for business, tax, and payments.
        </p>
      </div>

    </div>
  </div>
  `;
}
