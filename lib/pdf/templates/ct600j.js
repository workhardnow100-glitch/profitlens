// lib/pdf/templates/ct600j.js
import fs from "fs";
import path from "path";
import { createPdfBuffer, storePdfAndRecord } from "../engine";

export async function generateCt600jPdf({
  clientId,
  year,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  companyDetails = {},
  dotas = {},
  disclosures = {},
}) {
  const logoPath = path.join(process.cwd(), "lib/pdf/assets/logo.jpg");
  const logoExists = fs.existsSync(logoPath);

  const buffer = await createPdfBuffer((doc) => {
    const margin = 40;

    // Border
    doc.strokeColor("#CCCCCC")
      .lineWidth(1)
      .rect(margin / 2, margin / 2, doc.page.width - margin, doc.page.height - margin)
      .stroke();

    // Header
    doc.fillColor("black");

    if (logoExists) {
      doc.image(logoPath, doc.page.width - margin - 60, margin, { width: 60 });
    }

    doc.y = Math.max(doc.y, margin + 90);

    doc.fontSize(22)
      .text("CT600J – DOTAS Disclosure", { align: "center" })
      .moveDown(1.5);

    // Company details box
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

    doc.strokeColor("#999999")
      .lineWidth(1)
      .rect(boxX, boxY, boxWidth, boxHeight)
      .stroke();

    doc.moveDown(2);

    // Section 1: DOTAS Overview
    doc.fontSize(16).text("1. DOTAS Overview", { underline: true }).moveDown(0.8);

    if (dotas && Object.keys(dotas).length > 0) {
      Object.entries(dotas).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.fontSize(12).text("No DOTAS disclosures recorded.");
    }

    doc.moveDown(1.5);

    // Section 2: Additional Disclosures
    doc.fontSize(16).text("2. Additional Disclosures", { underline: true }).moveDown(0.8);

    if (disclosures && Object.keys(disclosures).length > 0) {
      Object.entries(disclosures).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.fontSize(12).text("No additional disclosures provided.");
    }

    // Footer
    doc.moveDown(3);
    doc.fontSize(10).fillColor("gray").text("ProfitLens Technologies Ltd", { align: "center" });
    doc.fontSize(8).fillColor("gray").text(
      "ProfitLens provides estimates only. Always verify figures before filing with HMRC.",
      { align: "center" }
    );
  });

  return await storePdfAndRecord({
    clientId,
    type: "ct600j",
    periodStart,
    periodEnd,
    year,
    filename,
    createdBy,
    metadata: {
      companyDetails,
      dotas,
      disclosures,
    },
    buffer,
  });
}
