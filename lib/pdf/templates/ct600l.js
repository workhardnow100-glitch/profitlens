// lib/pdf/templates/ct600l.js
import fs from "fs";
import path from "path";
import { createPdfBuffer, storePdfAndRecord } from "../engine";

export async function generateCt600lPdf({
  clientId,
  year,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  companyDetails = {},
  rAndD = {},
  disclosures = {},
}) {
  const logoPath = path.join(process.cwd(), "lib/pdf/assets/logo.jpg");
  const logoExists = fs.existsSync(logoPath);

  const buffer = await createPdfBuffer((doc) => {
    const margin = 40;

    // Outer border
    doc
      .strokeColor("#CCCCCC")
      .lineWidth(1)
      .rect(margin / 2, margin / 2, doc.page.width - margin, doc.page.height - margin)
      .stroke();

    // Header
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
      .text("CT600L – Research & Development Supplement", { align: "center" })
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

    doc
      .strokeColor("#999999")
      .lineWidth(1)
      .rect(boxX, boxY, boxWidth, boxHeight)
      .stroke();

    doc.moveDown(2);

    //
    // ────────────────────────────────────────────────
    //  SECTION 1: OVERVIEW
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("1. Overview", { underline: true }).moveDown(0.8);

    const {
      totalRAndD,
      enhancedRelief,
      multiplier,
      grants,
      sme = {},
      rdec = {},
      override = {},
    } = rAndD;

    doc.fontSize(12);
    if (totalRAndD !== undefined) doc.text(`Total R&D Spend: ${totalRAndD}`);
    if (grants !== undefined) doc.text(`Grants / Subsidies: ${grants}`);
    if (multiplier !== undefined) doc.text(`SME Uplift Multiplier: ${multiplier}`);
    if (enhancedRelief !== undefined) doc.text(`Enhanced Relief (SME): ${enhancedRelief}`);

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 2: SME SCHEME
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("2. SME Scheme", { underline: true }).moveDown(0.8);

    if (Object.keys(sme).length > 0) {
      const { qualifyingSpend, enhancedDeduction, payableCredit, surrenderedLoss } = sme;

      if (qualifyingSpend !== undefined) doc.fontSize(12).text(`Qualifying Spend: ${qualifyingSpend}`);
      if (enhancedDeduction !== undefined) doc.text(`Enhanced Deduction: ${enhancedDeduction}`);
      if (surrenderedLoss !== undefined) doc.text(`Surrendered Loss: ${surrenderedLoss}`);
      if (payableCredit !== undefined) doc.text(`Payable Credit: ${payableCredit}`);
    } else {
      doc.fontSize(12).text("No SME R&D claim computed.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 3: RDEC SCHEME
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("3. RDEC Scheme", { underline: true }).moveDown(0.8);

    if (Object.keys(rdec).length > 0) {
      const { qualifyingSpend, credit } = rdec;

      if (qualifyingSpend !== undefined) doc.fontSize(12).text(`Qualifying Spend: ${qualifyingSpend}`);
      if (credit !== undefined) doc.text(`RDEC Credit: ${credit}`);
    } else {
      doc.fontSize(12).text("No RDEC claim computed.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 4: MANUAL OVERRIDES
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("4. Manual Overrides", { underline: true }).moveDown(0.8);

    if (override && Object.keys(override).length > 0) {
      const {
        enabled,
        smeEnhancedDeduction,
        smePayableCredit,
        rdecCredit,
        surrenderedLoss,
      } = override;

      doc.fontSize(12).text(`Override Enabled: ${enabled ? "Yes" : "No"}`);

      if (smeEnhancedDeduction !== undefined)
        doc.text(`Override SME Enhanced Deduction: ${smeEnhancedDeduction}`);

      if (smePayableCredit !== undefined)
        doc.text(`Override SME Payable Credit: ${smePayableCredit}`);

      if (rdecCredit !== undefined)
        doc.text(`Override RDEC Credit: ${rdecCredit}`);

      if (surrenderedLoss !== undefined)
        doc.text(`Override Surrendered Loss: ${surrenderedLoss}`);
    } else {
      doc.fontSize(12).text("No manual overrides configured.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 5: DISCLOSURES
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("5. Disclosures", { underline: true }).moveDown(0.8);

    if (disclosures && Object.keys(disclosures).length > 0) {
      Object.entries(disclosures).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.fontSize(12).text("No additional disclosures provided.");
    }

    //
    // FOOTER
    //
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
    type: "ct600l",
    periodStart,
    periodEnd,
    year,
    filename,
    createdBy,
    metadata: {
      companyDetails,
      rAndD,
      disclosures,
    },
    buffer,
  });
}
