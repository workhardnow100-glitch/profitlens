// lib/pdf/templates/sa100.js
import fs from "fs";
import path from "path";
import { createPdfBuffer, storePdfAndRecord } from "../engine";

export async function generateSa100Pdf({
  clientId,
  taxYear,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  clientDetails = {},
  saSummary = {},
  income = {},
  employment = {},
  pensions = {},
  selfEmployment = {},
  property = {},
  dividends = {},
  interest = {},
  capitalGains = {},
  adjustments = {},
  taxCalculation = {},
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
      .text("SA100 Self Assessment Working Paper", { align: "center" })
      .moveDown(1.5);

    //
    // Client Header Block
    //
    doc.fontSize(12);

    const headerFields = [
      ["Client Name", clientDetails.name],
      ["Trading Name", clientDetails.trading_name],
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

    if (saSummary && Object.keys(saSummary).length > 0) {
      Object.entries(saSummary).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No summary data available.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 2 — INCOME
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("2. Income", { underline: true }).moveDown(0.8);

    if (income && Object.keys(income).length > 0) {
      Object.entries(income).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No income data recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 3 — EMPLOYMENT (SA102)
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("3. Employment (SA102)", { underline: true }).moveDown(0.8);

    if (employment && Object.keys(employment).length > 0) {
      Object.entries(employment).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No employment data recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 4 — PENSIONS (SA101)
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("4. Pensions (SA101)", { underline: true }).moveDown(0.8);

    if (pensions && Object.keys(pensions).length > 0) {
      Object.entries(pensions).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No pension data recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 5 — SELF EMPLOYMENT (SA103)
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("5. Self Employment (SA103)", { underline: true }).moveDown(0.8);

    if (selfEmployment && Object.keys(selfEmployment).length > 0) {
      Object.entries(selfEmployment).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No self-employment data recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 6 — PROPERTY (SA105)
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("6. Property (SA105)", { underline: true }).moveDown(0.8);

    if (property && Object.keys(property).length > 0) {
      Object.entries(property).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No property income recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 7 — DIVIDENDS
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("7. Dividends", { underline: true }).moveDown(0.8);

    if (dividends && Object.keys(dividends).length > 0) {
      Object.entries(dividends).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No dividend income recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 8 — INTEREST
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("8. Interest", { underline: true }).moveDown(0.8);

    if (interest && Object.keys(interest).length > 0) {
      Object.entries(interest).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No interest income recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 9 — CAPITAL GAINS (SA108)
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("9. Capital Gains (SA108)", { underline: true }).moveDown(0.8);

    if (capitalGains && Object.keys(capitalGains).length > 0) {
      Object.entries(capitalGains).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No capital gains recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 10 — ADJUSTMENTS
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("10. Adjustments", { underline: true }).moveDown(0.8);

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
    //  SECTION 11 — TAX CALCULATION (SA110)
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("11. Tax Calculation (SA110)", { underline: true }).moveDown(0.8);

    if (taxCalculation && Object.keys(taxCalculation).length > 0) {
      Object.entries(taxCalculation).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No tax calculation available.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 12 — PAYMENTS & BALANCES
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("12. Payments & Balances", { underline: true }).moveDown(0.8);

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
    //  SECTION 13 — ADDITIONAL DISCLOSURES
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("13. Additional Disclosures", { underline: true }).moveDown(0.8);

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
    type: "sa100",
    periodStart,
    periodEnd,
    year: taxYear,
    taxYear,
    filename,
    createdBy,
    metadata: {
      clientDetails,
      saSummary,
      income,
      employment,
      pensions,
      selfEmployment,
      property,
      dividends,
      interest,
      capitalGains,
      adjustments,
      taxCalculation,
      payments,
      disclosures,
    },
    buffer,
  });

  return record;
}
