// lib/pdf/templates/ct600n.js
import fs from "fs";
import path from "path";
import { createPdfBuffer, storePdfAndRecord } from "../engine";

export async function generateCt600nPdf({
  clientId,
  year,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  companyDetails = {},
  niRate = {},
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
      .text("CT600N – Northern Ireland Rate", { align: "center" })
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
      niTradingProfits,
      niNonTradingProfits,
      niAdjustments,
      niTaxRate,
      niTaxDue,
      overviewNotes,
      allocations = [],
    } = niRate;

    // 1. Overview
    doc.fontSize(16).text("1. Overview", { underline: true }).moveDown(0.8);

    if (
      niTradingProfits !== undefined ||
      niNonTradingProfits !== undefined ||
      niTaxRate !== undefined ||
      niTaxDue !== undefined
    ) {
      if (niTradingProfits !== undefined)
        doc.fontSize(12).text(`NI Trading Profits: ${niTradingProfits}`);
      if (niNonTradingProfits !== undefined)
        doc.text(`NI Non-Trading Profits: ${niNonTradingProfits}`);
      if (niTaxRate !== undefined) doc.text(`NI Corporation Tax Rate: ${niTaxRate}`);
      if (niTaxDue !== undefined) doc.text(`NI Corporation Tax Due: ${niTaxDue}`);
    } else {
      doc.fontSize(12).text("No Northern Ireland rate computations recorded.");
    }

    if (overviewNotes) {
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Overview notes: ${overviewNotes}`);
    }

    doc.moveDown(1.5);

    // 2. Adjustments
    doc.fontSize(16).text("2. Adjustments", { underline: true }).moveDown(0.8);

    if (niAdjustments && Object.keys(niAdjustments).length > 0) {
      Object.entries(niAdjustments).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.fontSize(12).text("No specific NI adjustments recorded.");
    }

    doc.moveDown(1.5);

    // 3. Profit allocation
    doc.fontSize(16).text("3. Profit Allocation", { underline: true }).moveDown(0.8);

    if (Array.isArray(allocations) && allocations.length > 0) {
      allocations.forEach((item, index) => {
        const {
          description,
          niPortion,
          restOfUKPortion,
        } = item;

        doc.fontSize(13).text(`3.${index + 1} Allocation ${index + 1}`).moveDown(0.4);

        if (description) doc.fontSize(12).text(`Description: ${description}`);
        if (niPortion !== undefined) doc.text(`NI Portion: ${niPortion}`);
        if (restOfUKPortion !== undefined) doc.text(`Rest of UK Portion: ${restOfUKPortion}`);

        doc.moveDown(0.8);
      });
    } else {
      doc.fontSize(12).text("No detailed profit allocations recorded.");
    }

    doc.moveDown(1.5);

    // 4. Additional disclosures
    doc.fontSize(16).text("4. Additional Disclosures", { underline: true }).moveDown(0.8);

    if (disclosures && Object.keys(disclosures).length > 0) {
      Object.entries(disclosures).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.fontSize(12).text("No additional disclosures provided for CT600N.");
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
    type: "ct600n",
    periodStart,
    periodEnd,
    year,
    filename,
    createdBy,
    metadata: {
      companyDetails,
      niRate,
      disclosures,
    },
    buffer,
  });
}
