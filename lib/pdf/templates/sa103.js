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
    //
    // ────────────────────────────────────────────────
    //  HEADER: LOGO + CLIENT DETAILS
    // ────────────────────────────────────────────────
    //
    if (logoExists) {
      doc.image(logoPath, 40, 40, { width: 120 });
      doc.moveDown(3);
    }

    doc.fillColor("black");

    doc
      .fontSize(22)
      .text("SA103 Self‑Employment Working Paper", { align: "center" })
      .moveDown(1.5);

    //
    // Client Header Block
    //
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

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 1 — SUMMARY
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
    // ────────────────────────────────────────────────
    //  SECTION 2 — TURNOVER
    // ────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────
    //  SECTION 3 — ALLOWABLE EXPENSES
    // ────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────
    //  SECTION 4 — DISALLOWABLE EXPENSES
    // ────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────
    //  SECTION 5 — CAPITAL ALLOWANCES
    // ────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────
    //  SECTION 6 — SIMPLIFIED EXPENSES
    // ────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────
    //  SECTION 7 — ADJUSTMENTS
    // ────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────
    //  SECTION 8 — LOSSES
    // ────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────
    //  SECTION 9 — CLASS 2 NIC
    // ────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────
    //  SECTION 10 — CLASS 4 NIC
    // ────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────
    //  SECTION 11 — PAYMENTS & BALANCES
    // ────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────
    //  SECTION 12 — ADDITIONAL DISCLOSURES
    // ────────────────────────────────────────────────
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
    // Footer
    //
    doc.moveDown(3);
    doc
      .fontSize(10)
      .fillColor("gray")
      .text("Generated by ProfitLens", { align: "right" });
  });

  //
  // Save PDF + record in pdf_documents
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
