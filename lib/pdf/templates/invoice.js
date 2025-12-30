/**
 * Build an invoice PDF using PDFKit.
 *
 * @param {PDFKit.PDFDocument} doc
 * @param {{
 *   invoice: any;
 *   externalClient: any;
 *   lineItems: any[];
 *   payments: any[];
 *   paymentLinkUrl?: string | null;
 * }} params
 */
export function buildInvoicePdf(
  doc,
  { invoice, externalClient, lineItems, payments, paymentLinkUrl }
) {
  const leftMargin = 40;
  const rightMargin = 550;

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toISOString().slice(0, 10);
  };

  const money = (n) => `£${Number(n || 0).toFixed(2)}`;

  // ---------- Header ----------
  doc.fontSize(20).font("Helvetica-Bold").text("INVOICE", leftMargin, 40);

  doc
    .fontSize(10)
    .font("Helvetica")
    .text(`Invoice No: ${invoice.invoice_number || ""}`, leftMargin, 70)
    .text(`Issue Date: ${formatDate(invoice.issue_date)}`, leftMargin, 85)
    .text(`Due Date: ${formatDate(invoice.due_date)}`, leftMargin, 100)
    .text(`Status: ${invoice.status || ""}`, leftMargin, 115);

  // ---------- External Client details ----------
  const clientName =
    externalClient?.contact_name ||
    externalClient?.business_name ||
    externalClient?.trading_name ||
    "Customer";

  doc.fontSize(12).font("Helvetica-Bold").text("Bill To:", rightMargin - 200, 70);

  doc.fontSize(10).font("Helvetica").text(clientName, rightMargin - 200, 85);

  if (externalClient?.address_line1) doc.text(externalClient.address_line1);
  if (externalClient?.address_line2) doc.text(externalClient.address_line2);
  if (externalClient?.city) doc.text(externalClient.city);
  if (externalClient?.postcode) doc.text(externalClient.postcode);
  if (externalClient?.country) doc.text(externalClient.country);

  if (externalClient?.contact_email)
    doc.text(`Email: ${externalClient.contact_email}`);
  if (externalClient?.contact_phone)
    doc.text(`Phone: ${externalClient.contact_phone}`);
  if (externalClient?.company_number)
    doc.text(`Company No: ${externalClient.company_number}`);
  if (externalClient?.vat_number)
    doc.text(`VAT No: ${externalClient.vat_number}`);

  // ---------- Payment link ----------
  let yCursor = 170;
  if (paymentLinkUrl) {
    doc
      .moveTo(leftMargin, yCursor - 10)
      .lineTo(rightMargin, yCursor - 10)
      .strokeColor("#cccccc")
      .stroke();

    doc
      .fontSize(11)
      .fillColor("#000000")
      .font("Helvetica-Bold")
      .text("Online Payment", leftMargin, yCursor);

    yCursor += 18;

    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#0000ff")
      .text(paymentLinkUrl, leftMargin, yCursor, {
        link: paymentLinkUrl,
        underline: true,
        width: rightMargin - leftMargin,
      });

    yCursor += 30;
    doc.fillColor("#000000");
  }

  // ---------- Line items header ----------
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text("Description", leftMargin, yCursor)
    .text("Qty", 300, yCursor, { width: 40, align: "right" })
    .text("Unit", 350, yCursor, { width: 60, align: "right" })
    .text("VAT", 410, yCursor, { width: 40, align: "right" })
    .text("Total", 460, yCursor, { width: 80, align: "right" });

  yCursor += 18;

  doc
    .moveTo(leftMargin, yCursor - 5)
    .lineTo(rightMargin, yCursor - 5)
    .strokeColor("#000000")
    .stroke();

  doc.font("Helvetica").fontSize(10);

  // ---------- Line items rows ----------
  lineItems.forEach((li) => {
    const qty = Number(li.quantity || 0);
    const unit = Number(li.unit_price || 0);
    const vatRate = Number(li.vat_rate || 0);
    const lineNet = qty * unit;
    const lineVat = lineNet * (vatRate / 100);
    const lineGross = lineNet + lineVat;

    if (yCursor > 720) {
      doc.addPage();
      yCursor = 60;
    }

    doc
      .text(li.description || "", leftMargin, yCursor, {
        width: 240,
        continued: false,
      })
      .text(qty.toString(), 300, yCursor, {
        width: 40,
        align: "right",
      })
      .text(money(unit), 350, yCursor, {
        width: 60,
        align: "right",
      })
      .text(`${vatRate}%`, 410, yCursor, {
        width: 40,
        align: "right",
      })
      .text(money(lineGross), 460, yCursor, {
        width: 80,
        align: "right",
      });

    yCursor += 18;
  });

  // ---------- Totals ----------
  yCursor += 10;
  doc.moveTo(leftMargin, yCursor).lineTo(rightMargin, yCursor).stroke();

  yCursor += 10;

  const net = Number(invoice.net_amount || 0);
  const vat = Number(invoice.tax_amount || 0);
  const gross = Number(invoice.gross_amount || 0);

  const summaryX = 360;

  doc
    .font("Helvetica")
    .fontSize(10)
    .text("Subtotal", summaryX, yCursor, { width: 80, align: "right" })
    .text(money(net), 460, yCursor, { width: 80, align: "right" });

  yCursor += 16;
  doc
    .text("VAT", summaryX, yCursor, { width: 80, align: "right" })
    .text(money(vat), 460, yCursor, { width: 80, align: "right" });

  yCursor += 16;
  doc
    .font("Helvetica-Bold")
    .text("Total", summaryX, yCursor, { width: 80, align: "right" })
    .text(money(gross), 460, yCursor, { width: 80, align: "right" });

  // ---------- Notes / payment instructions ----------
  yCursor += 40;
  doc.font("Helvetica-Bold").fontSize(11).text("Notes / Payment Instructions", leftMargin, yCursor);

  yCursor += 16;
  doc.font("Helvetica").fontSize(9);

  const notes =
    invoice.payment_instructions ||
    invoice.notes_to_client ||
    "Thank you for your business.";

  doc.text(notes, leftMargin, yCursor, {
    width: rightMargin - leftMargin,
  });

  // ---------- Footer ----------
  doc
    .fontSize(8)
    .fillColor("#666666")
    .text("Generated by ProfitLens", leftMargin, 800, { align: "left" });
}
