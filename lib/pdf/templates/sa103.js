// lib/pdf/templates/sa103.js
import fs from "fs";
import path from "path";
import { createPdfBuffer, storePdfAndRecord } from "../engine";

export async function generateSa103Pdf({
  clientId,
  taxYear,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  clientDetails = {},
  sa103Summary = {},
  turnover = {},
  allowableExpenses = {},
  disallowableExpenses = {},
  capitalAllowances = {},
  simplifiedExpenses = {},
  adjustments = {},
  losses = {},
  class2NIC = {},
  class4NIC = {},
  payments = {},
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
    doc.fillColor("black");

    if (logoExists) {
      const logoWidth = 60; // resized to avoid overlap
      const logoX = doc.page.width - margin - logoWidth;
      const logoY = margin;

      doc.image(logoPath, logoX, logoY, { width: logoWidth });
    }

    // Ensure cursor is below logo
    doc.y = Math.max(doc.y, margin + 70);

    doc
      .fontSize(22)
      .text("SA103 Self‑Employment Working Paper", { align: "center" })
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
      ["Client Name", clientDetails.name],
      ["Trading Name", clientDetails.trading_name],
      ["Business Type", clientDetails.business_type],
      ["UTR Number", clientDetails.utr_number],
      ["National Insurance Number", clientDetails.ni_number],
      ["Address", clientDetails.address],
      ["Postcode", clientDetails.postcode],
      ["Phone", clientDetails.phone],
      ["Email", clientDetails.email],
      ["Client ID", clientId],
      ["Tax Year", taxYear],
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

    if (sa103Summary && Object.keys(sa103Summary).length > 0) {
      Object.entries(sa103Summary).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No summary data available.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 2 — TURNOVER
    //
    doc.fontSize(16).text("2. Turnover", { underline: true }).moveDown(0.8);

    if (turnover && Object.keys(turnover).length > 0) {
      Object.entries(turnover).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No turnover recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 3 — ALLOWABLE EXPENSES
    //
    doc.fontSize(16).text("3. Allowable Expenses", { underline: true }).moveDown(0.8);

    if (allowableExpenses && Object.keys(allowableExpenses).length > 0) {
      Object.entries(allowableExpenses).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No allowable expenses recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 4 — DISALLOWABLE EXPENSES
    //
    doc.fontSize(16).text("4. Disallowable Expenses", { underline: true }).moveDown(0.8);

    if (disallowableExpenses && Object.keys(disallowableExpenses).length > 0) {
      Object.entries(disallowableExpenses).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No disallowable expenses recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 5 — CAPITAL ALLOWANCES
    //
    doc.fontSize(16).text("5. Capital Allowances", { underline: true }).moveDown(0.8);

    if (capitalAllowances && Object.keys(capitalAllowances).length > 0) {
      Object.entries(capitalAllowances).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No capital allowances recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 6 — SIMPLIFIED EXPENSES
    //
    doc.fontSize(16).text("6. Simplified Expenses", { underline: true }).moveDown(0.8);

    if (simplifiedExpenses && Object.keys(simplifiedExpenses).length > 0) {
      Object.entries(simplifiedExpenses).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No simplified expenses recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 7 — ADJUSTMENTS
    //
    doc.fontSize(16).text("7. Adjustments", { underline: true }).moveDown(0.8);

    if (adjustments && Object.keys(adjustments).length > 0) {
      Object.entries(adjustments).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No adjustments recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 8 — LOSSES
    //
    doc.fontSize(16).text("8. Losses", { underline: true }).moveDown(0.8);

    if (losses && Object.keys(losses).length > 0) {
      Object.entries(losses).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No losses recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 9 — CLASS 2 NIC
    //
    doc.fontSize(16).text("9. Class 2 NIC", { underline: true }).moveDown(0.8);

    if (class2NIC && Object.keys(class2NIC).length > 0) {
      Object.entries(class2NIC).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No Class 2 NIC data recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 10 — CLASS 4 NIC
    //
    doc.fontSize(16).text("10. Class 4 NIC", { underline: true }).moveDown(0.8);

    if (class4NIC && Object.keys(class4NIC).length > 0) {
      Object.entries(class4NIC).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No Class 4 NIC data recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 11 — PAYMENTS & BALANCES
    //
    doc.fontSize(16).text("11. Payments & Balances", { underline: true }).moveDown(0.8);

    if (payments && Object.keys(payments).length > 0) {
      Object.entries(payments).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No payments recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 12 — ADDITIONAL DISCLOSURES
    //
    doc.fontSize(16).text("12. Additional Disclosures", { underline: true }).moveDown(0.8);

    if (disclosures && Object.keys(disclosures).length > 0) {
      Object.entries(disclosures).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No additional disclosures provided.");
    }

    //
    // ────────────────────────────────────────────────
    // FOOTER — BRAND + DISCLAIMER
    // ────────────────────────────────────────────────
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
    type: "sa103",
    periodStart,
    periodEnd,
    year: taxYear,
    taxYear,
    filename,
    createdBy,
    metadata: {
      clientDetails,
      sa103Summary,
      turnover,
      allowableExpenses,
      disallowableExpenses,
      capitalAllowances,
      simplifiedExpenses,
      adjustments,
      losses,
      class2NIC,
      class4NIC,
      payments,
      disclosures,
    },
    buffer,
  });

  return record;
}
