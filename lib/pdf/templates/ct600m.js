// lib/pdf/templates/ct600m.js
import fs from "fs";
import path from "path";
import { createPdfBuffer, storePdfAndRecord } from "../engine";

export async function generateCt600mPdf({
  clientId,
  year,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  companyDetails = {},
  royalties = {},
  disclosures = {},
}) {
  const logoPath = path.join(process.cwd(), "lib/pdf/assets/logo.jpg");
  const logoExists = fs.existsSync(logoPath);

  const buffer = await createPdfBuffer((doc) => {
    const margin = 40;

    doc
      .strokeColor("#CCCCCC")
      .lineWidth(1)
      .rect(margin / 2, margin / 2, doc.page.width - margin, doc.page.height - margin)
      .stroke();

    doc.fillColor("black");

    if (logoExists) {
      const logoWidth = 60;
      const logoX = doc.page.width - margin - logoWidth;
      const logoY = margin;
      doc.image(logoPath, logoX, logoY, { width: logoWidth });
    }

    doc.y = Math.max(doc.y, margin + 90);

    doc
      .fontSize(22)
      .text("CT600M – Cross-Border Royalties", { align: "center" })
      .moveDown(1.5);

    const boxX = margin;
    const boxY = doc.y;
    const boxWidth = doc.page.width - margin * 2;

    doc.y = boxY + 10;
    doc.fontSize(12);

    const headerFields = [
      ["Business Name", companyDetails.business_name || companyDetails.name],
      ["Trading Name", companyDetails.trading_name],
      ["Company Number", companyDetails.company_number],
      ["UTR Number", companyDetails.utr_number],
      ["Registered Address", companyDetails.registered_address || companyDetails.address],
      ["Postcode", companyDetails.postcode],
      ["Client ID", clientId],
      ["Tax Year", year],
      ["Period Start", periodStart],
      ["Period End", periodEnd],
    ];

    headerFields.forEach(([label, value]) => {
      if (value) doc.text(`${label}: ${value}`);
    });

    const boxBottomY = doc.y + 10;
    const boxHeight = boxBottomY - boxY;

    doc
      .strokeColor("#999999")
      .lineWidth(1)
      .rect(boxX, boxY, boxWidth, boxHeight)
      .stroke();

    doc.moveDown(2);

    const {
      totalRoyaltiesPaid,
      totalRoyaltiesReceived,
      withholdingTaxPaid,
      treatyReliefClaimed,
      overviewNotes,
      payments = [],
      receipts = [],
    } = royalties;

    // 1. Overview
    doc.fontSize(16).text("1. Overview", { underline: true }).moveDown(0.8);

    if (
      totalRoyaltiesPaid !== undefined ||
      totalRoyaltiesReceived !== undefined ||
      withholdingTaxPaid !== undefined
    ) {
      if (totalRoyaltiesPaid !== undefined)
        doc.fontSize(12).text(`Total Royalties Paid: ${totalRoyaltiesPaid}`);
      if (totalRoyaltiesReceived !== undefined)
        doc.text(`Total Royalties Received: ${totalRoyaltiesReceived}`);
      if (withholdingTaxPaid !== undefined)
        doc.text(`Withholding Tax Paid: ${withholdingTaxPaid}`);
      if (treatyReliefClaimed !== undefined)
        doc.text(`Treaty Relief Claimed: ${treatyReliefClaimed}`);
    } else {
      doc.fontSize(12).text("No cross-border royalty activity recorded.");
    }

    if (overviewNotes) {
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Overview notes: ${overviewNotes}`);
    }

    doc.moveDown(1.5);

    // 2. Royalties paid
    doc.fontSize(16).text("2. Royalties Paid", { underline: true }).moveDown(0.8);

    if (Array.isArray(payments) && payments.length > 0) {
      payments.forEach((item, index) => {
        const {
          country,
          recipient,
          grossAmount,
          withholdingTax,
          treatyRate,
          description,
        } = item;

        doc.fontSize(13).text(`2.${index + 1} Payment ${index + 1}`).moveDown(0.4);

        if (country) doc.fontSize(12).text(`Country: ${country}`);
        if (recipient) doc.text(`Recipient: ${recipient}`);
        if (grossAmount !== undefined) doc.text(`Gross Amount: ${grossAmount}`);
        if (withholdingTax !== undefined) doc.text(`Withholding Tax: ${withholdingTax}`);
        if (treatyRate !== undefined) doc.text(`Treaty Rate: ${treatyRate}`);
        if (description) {
          doc.moveDown(0.2);
          doc.text(`Description: ${description}`);
        }

        doc.moveDown(0.8);
      });
    } else {
      doc.fontSize(12).text("No individual royalty payments recorded.");
    }

    doc.moveDown(1.5);

    // 3. Royalties received
    doc.fontSize(16).text("3. Royalties Received", { underline: true }).moveDown(0.8);

    if (Array.isArray(receipts) && receipts.length > 0) {
      receipts.forEach((item, index) => {
        const {
          country,
          payer,
          grossAmount,
          withholdingTax,
          treatyRate,
          description,
        } = item;

        doc.fontSize(13).text(`3.${index + 1} Receipt ${index + 1}`).moveDown(0.4);

        if (country) doc.fontSize(12).text(`Country: ${country}`);
        if (payer) doc.text(`Payer: ${payer}`);
        if (grossAmount !== undefined) doc.text(`Gross Amount: ${grossAmount}`);
        if (withholdingTax !== undefined) doc.text(`Withholding Tax: ${withholdingTax}`);
        if (treatyRate !== undefined) doc.text(`Treaty Rate: ${treatyRate}`);
        if (description) {
          doc.moveDown(0.2);
          doc.text(`Description: ${description}`);
        }

        doc.moveDown(0.8);
      });
    } else {
      doc.fontSize(12).text("No individual royalty receipts recorded.");
    }

    doc.moveDown(1.5);

    // 4. Additional disclosures
    doc.fontSize(16).text("4. Additional Disclosures", { underline: true }).moveDown(0.8);

    if (disclosures && Object.keys(disclosures).length > 0) {
      Object.entries(disclosures).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.fontSize(12).text("No additional disclosures provided for CT600M.");
    }

    // Footer
    doc.moveDown(3);
    doc.fontSize(10).fillColor("gray").text("ProfitLens Technologies Ltd", { align: "center" });
    doc
      .fontSize(8)
      .fillColor("gray")
      .text(
        "ProfitLens provides estimates only. Always verify figures before filing with HMRC.",
        { align: "center" }
      );
  });

  return await storePdfAndRecord({
    clientId,
    type: "ct600m",
    periodStart,
    periodEnd,
    year,
    filename,
    createdBy,
    metadata: {
      companyDetails,
      royalties,
      disclosures,
    },
    buffer,
  });
}
