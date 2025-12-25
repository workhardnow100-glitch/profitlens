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
      .text("CIS300 Contractor Monthly Return Working Paper", { align: "center" })
      .moveDown(1.5);

    //
    // Client Header Block
    //
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

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 1 — SUMMARY
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
    // ────────────────────────────────────────────────
    //  SECTION 2 — SUBCONTRACTORS INCLUDED IN THIS RETURN
    // ────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────
    //  SECTION 3 — PAYMENTS MADE TO SUBCONTRACTORS
    // ────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────
    //  SECTION 4 — CIS DEDUCTED FROM SUBCONTRACTORS
    // ────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────
    //  SECTION 5 — CIS SUFFERED
    // ────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────
    //  SECTION 6 — ADJUSTMENTS
    // ────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────
    //  SECTION 7 — NET CIS DUE
    // ────────────────────────────────────────────────
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
    // ────────────────────────────────────────────────
    //  SECTION 8 — ADDITIONAL DISCLOSURES
    // ────────────────────────────────────────────────
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
