// lib/pdf/templates/ct600.js
import fs from "fs";
import path from "path";
import { createPdfBuffer, storePdfAndRecord } from "../engine";

export async function generateCt600Pdf({
  clientId,
  year,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  companyDetails = {},
  ctSummary = {},
  computations = {},
  capitalAllowances = {},
  losses = {},
  adjustments = {},
  rAndD = {},
  loansToParticipators = {},
  payments = {},
  disclosures = {},
}) {
  const logoPath = path.join(process.cwd(), "lib/pdf/assets/logo.jpg");
  const logoExists = fs.existsSync(logoPath);

  const buffer = await createPdfBuffer((doc) => {
   // ────────────────────────────────────────────────
// HEADER: Logo (right) + Bordered Client Block
// ────────────────────────────────────────────────

doc.fillColor("black");

let logoHeight = 0;

// Logo top-right
if (logoExists) {
  const logoWidth = 120;
  const logoX = doc.page.width - 160;
  const logoY = 40;

  doc.image(logoPath, logoX, logoY, { width: logoWidth });

  logoHeight = 40 + (logoWidth * 0.6); // estimate height based on aspect ratio
}

// Move cursor below logo
doc.y = Math.max(doc.y, logoHeight + 20);

// Title
doc
  .fontSize(22)
  .text("CT600 Corporation Tax Working Paper", { align: "center" })
  .moveDown(1.5);

// Bordered client block
const boxX = 40;
const boxY = doc.y;
const boxWidth = doc.page.width - 80;
const boxHeight = 280;

doc
  .rect(boxX, boxY, boxWidth, boxHeight)
  .strokeColor("#999")
  .lineWidth(1)
  .stroke();

doc.moveDown(0.5).fontSize(12);

const headerFields = [
  ["Business Name", companyDetails.business_name || companyDetails.name],
  ["Trading Name", companyDetails.trading_name],
  ["Company Number", companyDetails.company_number],
  ["UTR Number", companyDetails.utr_number],
  ["Registered Address", companyDetails.registered_address || companyDetails.address],
  ["Postcode", companyDetails.postcode],
  ["Phone", companyDetails.phone],
  ["Email", companyDetails.email],
  ["Website", companyDetails.website],
  ["Contact Person", companyDetails.contact_person],
  ["Contact Phone", companyDetails.contact_phone],
  ["Contact Email", companyDetails.contact_email],
  ["Client ID", clientId],
  ["Tax Year", year],
  ["Period Start", periodStart],
  ["Period End", periodEnd],
];

headerFields.forEach(([label, value]) => {
  if (value) doc.text(`${label}: ${value}`);
});

doc.moveDown(2);


    //
    // ────────────────────────────────────────────────
    //  SECTION: SUMMARY
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("1. Summary", { underline: true }).moveDown(0.8);

    if (ctSummary && Object.keys(ctSummary).length > 0) {
      Object.entries(ctSummary).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No summary data available.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION: COMPUTATIONS
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("2. Computations", { underline: true }).moveDown(0.8);

    const compSections = [
      ["Turnover", computations.turnover],
      ["Allowable Expenses", computations.allowableExpenses],
      ["Disallowable Expenses", computations.disallowableExpenses],
      ["Adjusted Profit", computations.adjustedProfit],
      ["Taxable Total Profit", computations.taxableProfit],
      ["Corporation Tax Rate", computations.taxRate],
      ["Corporation Tax Due", computations.taxDue],
    ];

    compSections.forEach(([label, value]) => {
      if (value !== undefined) doc.fontSize(12).text(`${label}: ${value}`);
    });

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION: CAPITAL ALLOWANCES
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("3. Capital Allowances", { underline: true }).moveDown(0.8);

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
    //  SECTION: LOSSES
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("4. Losses", { underline: true }).moveDown(0.8);

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
    //  SECTION: ADJUSTMENTS
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("5. Adjustments", { underline: true }).moveDown(0.8);

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
    //  SECTION: R&D (CT600L)
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("6. Research & Development (CT600L)", { underline: true }).moveDown(0.8);

    if (rAndD && Object.keys(rAndD).length > 0) {
      Object.entries(rAndD).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No R&D claims recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION: LOANS TO PARTICIPATORS (CT600A)
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("7. Loans to Participators (CT600A)", { underline: true }).moveDown(0.8);

    if (loansToParticipators && Object.keys(loansToParticipators).length > 0) {
      Object.entries(loansToParticipators).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No loans to participators recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION: PAYMENTS & BALANCES
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("8. Payments & Balances", { underline: true }).moveDown(0.8);

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
    //  SECTION: ADDITIONAL DISCLOSURES
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("9. Additional Disclosures", { underline: true }).moveDown(0.8);

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
    type: "ct600",
    periodStart,
    periodEnd,
    year,
    taxYear: null,
    filename,
    createdBy,
    metadata: {
      companyDetails,
      ctSummary,
      computations,
      capitalAllowances,
      losses,
      adjustments,
      rAndD,
      loansToParticipators,
      payments,
      disclosures,
    },
    buffer,
  });

  return record;
}
