// lib/pdf/templates/ct600f.js
import fs from "fs";
import path from "path";
import { createPdfBuffer, storePdfAndRecord } from "../engine";

export async function generateCt600fPdf({
  clientId,
  year,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  companyDetails = {},
  charity = {},
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
      .text("CT600F – Charity Exemptions", { align: "center" })
      .moveDown(1.5);

    const boxX = margin;
    const boxY = doc.y;
    const boxWidth = doc.page.width - margin * 2;

    doc.y = boxY + 10;
    doc.fontSize(12);

    const headerFields = [
      ["Charity Name", companyDetails.business_name || companyDetails.name],
      ["Trading Name", companyDetails.trading_name],
      ["Company / Charity Number", companyDetails.company_number],
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
      totalCharityIncome,
      exemptCharityIncome,
      nonExemptIncome,
      giftAidDonations,
      charitableExpenditure,
      reliefsClaimed,
      overviewNotes,
    } = charity;

    // 1. Overview
    doc.fontSize(16).text("1. Overview", { underline: true }).moveDown(0.8);

    if (
      totalCharityIncome !== undefined ||
      exemptCharityIncome !== undefined ||
      nonExemptIncome !== undefined
    ) {
      if (totalCharityIncome !== undefined)
        doc.fontSize(12).text(`Total Charity Income: ${totalCharityIncome}`);
      if (exemptCharityIncome !== undefined)
        doc.text(`Exempt Charity Income: ${exemptCharityIncome}`);
      if (nonExemptIncome !== undefined)
        doc.text(`Non-Exempt Income: ${nonExemptIncome}`);
    } else {
      doc.fontSize(12).text("No charity income figures recorded.");
    }

    if (overviewNotes) {
      doc.moveDown(0.5);
      doc.fontSize(12).text(`Overview notes: ${overviewNotes}`);
    }

    doc.moveDown(1.5);

    // 2. Gift Aid and Donations
    doc.fontSize(16).text("2. Gift Aid and Donations", { underline: true }).moveDown(0.8);

    if (giftAidDonations !== undefined) {
      doc.fontSize(12).text(`Gift Aid Donations: ${giftAidDonations}`);
    } else {
      doc.fontSize(12).text("No Gift Aid donations recorded.");
    }

    doc.moveDown(1.5);

    // 3. Charitable Expenditure
    doc.fontSize(16).text("3. Charitable Expenditure", { underline: true }).moveDown(0.8);

    if (charitableExpenditure !== undefined) {
      doc.fontSize(12).text(`Charitable Expenditure: ${charitableExpenditure}`);
    } else {
      doc.fontSize(12).text("No charitable expenditure recorded.");
    }

    doc.moveDown(1.5);

    // 4. Reliefs and Exemptions
    doc.fontSize(16).text("4. Reliefs and Exemptions", { underline: true }).moveDown(0.8);

    if (reliefsClaimed && Object.keys(reliefsClaimed).length > 0) {
      Object.entries(reliefsClaimed).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.fontSize(12).text("No specific reliefs or exemptions recorded.");
    }

    doc.moveDown(1.5);

    // 5. Additional disclosures
    doc.fontSize(16).text("5. Additional Disclosures", { underline: true }).moveDown(0.8);

    if (disclosures && Object.keys(disclosures).length > 0) {
      Object.entries(disclosures).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.fontSize(12).text("No additional disclosures provided for CT600F.");
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
    type: "ct600f",
    periodStart,
    periodEnd,
    year,
    filename,
    createdBy,
    metadata: {
      companyDetails,
      charity,
      disclosures,
    },
    buffer,
  });
}
