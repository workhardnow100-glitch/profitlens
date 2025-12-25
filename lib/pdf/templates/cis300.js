// lib/pdf/templates/cis300.js
import fs from "fs";
import path from "path";
import { createPdfBuffer, storePdfAndRecord } from "../engine";

export async function generateCis300Pdf({
  clientId,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  clientDetails = {},
  cisSummary = {},
  subcontractors = [],
  payments = {},
  deductions = {},
  cisSuffered = {},
  adjustments = {},
  netCis = {},
  disclosures = {},
}) {
  const logoPath = path.join(process.cwd(), "lib/pdf/assets/logo.jpg");
  const logoExists = fs.existsSync(logoPath);

  const buffer = await createPdfBuffer((doc) => {
    const margin = 40;

    //
    // ────────────────────────────────────────────────
    // OUTER PAGE BORDER
    // ────────────────────────────────────────────────
    //
    doc
      .strokeColor("#CCCCCC")
      .lineWidth(1)
      .rect(margin / 2, margin / 2, doc.page.width - margin, doc.page.height - margin)
      .stroke();

    //
    // ────────────────────────────────────────────────
    // HEADER: LOGO (RIGHT) + TITLE
    // ────────────────────────────────────────────────
    //
    if (logoExists) {
      const logoWidth = 60;
      const logoX = doc.page.width - margin - logoWidth;
      const logoY = margin;

      doc.image(logoPath, logoX, logoY, { width: logoWidth });
    }

    // Ensure cursor is below logo
    doc.y = Math.max(doc.y, margin + 70);

    doc
      .fontSize(22)
      .fillColor("black")
      .text("CIS300 Contractor Monthly Return Working Paper", { align: "center" })
      .moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    // CLIENT DETAILS BLOCK (bordered)
    // ────────────────────────────────────────────────
    //
    const boxX = margin;
    const boxY = doc.y;
    const boxWidth = doc.page.width - margin * 2;

    doc.y = boxY + 10;
    doc.fontSize(12);

    const headerFields = [
      ["Contractor Name", clientDetails.business_name || clientDetails.name],
      ["Trading Name", clientDetails.trading_name],
      ["UTR Number", clientDetails.utr_number],
      ["Company Number", clientDetails.company_number],
      ["Address", clientDetails.address],
      ["Postcode", clientDetails.postcode],
      ["Phone", clientDetails.phone],
      ["Email", clientDetails.email],
      ["Client ID", clientId],
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
    // SECTION 1 — SUMMARY
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("1. Summary", { underline: true }).moveDown(0.8);

    if (cisSummary && Object.keys(cisSummary).length > 0) {
      Object.entries(cisSummary).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No CIS summary data available.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 2 — SUBCONTRACTORS
    //
    doc.fontSize(16).text("2. Subcontractors", { underline: true }).moveDown(0.8);

    if (subcontractors.length > 0) {
      subcontractors.forEach((sc, index) => {
        doc.fontSize(12).text(`Subcontractor ${index + 1}:`);
        Object.entries(sc).forEach(([label, value]) => {
          doc.text(`  ${label}: ${value}`);
        });
        doc.moveDown(0.5);
      });
    } else {
      doc.text("No subcontractors recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 3 — PAYMENTS MADE
    //
    doc.fontSize(16).text("3. Payments Made", { underline: true }).moveDown(0.8);

    if (payments && Object.keys(payments).length > 0) {
      Object.entries(payments).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No payments recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 4 — CIS DEDUCTED
    //
    doc.fontSize(16).text("4. CIS Deducted", { underline: true }).moveDown(0.8);

    if (deductions && Object.keys(deductions).length > 0) {
      Object.entries(deductions).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No CIS deductions recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 5 — CIS SUFFERED
    //
    doc.fontSize(16).text("5. CIS Suffered", { underline: true }).moveDown(0.8);

    if (cisSuffered && Object.keys(cisSuffered).length > 0) {
      Object.entries(cisSuffered).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No CIS suffered recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 6 — ADJUSTMENTS
    //
    doc.fontSize(16).text("6. Adjustments", { underline: true }).moveDown(0.8);

    if (adjustments && Object.keys(adjustments).length > 0) {
      Object.entries(adjustments).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No adjustments recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 7 — NET CIS DUE
    //
    doc.fontSize(16).text("7. Net CIS Due", { underline: true }).moveDown(0.8);

    if (netCis && Object.keys(netCis).length > 0) {
      Object.entries(netCis).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No net CIS calculation recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 8 — ADDITIONAL DISCLOSURES
    //
    doc.fontSize(16).text("8. Additional Disclosures", { underline: true }).moveDown(0.8);

    if (disclosures && Object.keys(disclosures).length > 0) {
      Object.entries(disclosures).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No additional disclosures provided.");
    }

    //
    // FOOTER — BRAND + DISCLAIMER
    //
    doc.moveDown(3);

    doc
      .fontSize(10)
      .fillColor("gray")
      .text("ProfitLens Technologies Ltd", { align: "center" })
      .moveDown(0.5);

    doc
      .fontSize(8)
      .fillColor("gray")
      .text(
        "ProfitLens provides estimates only. Always verify figures before filing with HMRC. Nothing displayed here constitutes tax, accounting, or legal advice.",
        { align: "center" }
      );
  });

  //
  // SAVE PDF + RECORD
  //
  const record = await storePdfAndRecord({
    clientId,
    type: "cis300",
    periodStart,
    periodEnd,
    year: null,
    taxYear: null,
    filename,
    createdBy,
    metadata: {
      clientDetails,
      cisSummary,
      subcontractors,
      payments,
      deductions,
      cisSuffered,
      adjustments,
      netCis,
      disclosures,
    },
    buffer,
  });

  return record;
}
