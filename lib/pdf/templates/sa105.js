// lib/pdf/templates/sa105.js
import fs from "fs";
import path from "path";
import { createPdfBuffer, storePdfAndRecord } from "../engine";

export async function generateSa105Pdf({
  clientId,
  taxYear,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  clientDetails = {},
  sa105Summary = {},
  rentalIncome = {},
  furnishedHolidayLettings = {},
  rentARoom = {},
  allowableExpenses = {},
  disallowableExpenses = {},
  mortgageInterest = {},
  capitalAllowances = {},
  propertyLosses = {},
  jointOwnership = {},
  adjustments = {},
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
      .text("SA105 UK Property Income Working Paper", { align: "center" })
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

    if (sa105Summary && Object.keys(sa105Summary).length > 0) {
      Object.entries(sa105Summary).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No summary data available.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 2 — RENTAL INCOME
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("2. Rental Income", { underline: true }).moveDown(0.8);

    if (rentalIncome && Object.keys(rentalIncome).length > 0) {
      Object.entries(rentalIncome).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No rental income recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 3 — FURNISHED HOLIDAY LETTINGS (FHL)
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("3. Furnished Holiday Lettings (FHL)", { underline: true }).moveDown(0.8);

    if (furnishedHolidayLettings && Object.keys(furnishedHolidayLettings).length > 0) {
      Object.entries(furnishedHolidayLettings).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No FHL income recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 4 — RENT‑A‑ROOM
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("4. Rent‑a‑Room", { underline: true }).moveDown(0.8);

    if (rentARoom && Object.keys(rentARoom).length > 0) {
      Object.entries(rentARoom).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No rent‑a‑room income recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 5 — ALLOWABLE EXPENSES
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("5. Allowable Expenses", { underline: true }).moveDown(0.8);

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
    //  SECTION 6 — DISALLOWABLE EXPENSES
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("6. Disallowable Expenses", { underline: true }).moveDown(0.8);

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
    //  SECTION 7 — MORTGAGE INTEREST
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("7. Mortgage Interest", { underline: true }).moveDown(0.8);

    if (mortgageInterest && Object.keys(mortgageInterest).length > 0) {
      Object.entries(mortgageInterest).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No mortgage interest recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 8 — CAPITAL ALLOWANCES
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("8. Capital Allowances", { underline: true }).moveDown(0.8);

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
    //  SECTION 9 — PROPERTY LOSSES
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("9. Property Losses", { underline: true }).moveDown(0.8);

    if (propertyLosses && Object.keys(propertyLosses).length > 0) {
      Object.entries(propertyLosses).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No property losses recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 10 — JOINT OWNERSHIP
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("10. Joint Ownership", { underline: true }).moveDown(0.8);

    if (jointOwnership && Object.keys(jointOwnership).length > 0) {
      Object.entries(jointOwnership).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No joint ownership details recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 11 — ADJUSTMENTS
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("11. Adjustments", { underline: true }).moveDown(0.8);

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
    type: "sa105",
    periodStart,
    periodEnd,
    year: taxYear,
    taxYear,
    filename,
    createdBy,
    metadata: {
      clientDetails,
      sa105Summary,
      rentalIncome,
      furnishedHolidayLettings,
      rentARoom,
      allowableExpenses,
      disallowableExpenses,
      mortgageInterest,
      capitalAllowances,
      propertyLosses,
      jointOwnership,
      adjustments,
      payments,
      disclosures,
    },
    buffer,
  });

  return record;
}
