// lib/pdf/templates/cis_statement.js
import fs from "fs";
import path from "path";
import { createPdfBuffer, storePdfAndRecord } from "../engine";

export async function generateCisStatementPdf({
  clientId,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  contractorDetails = {},
  subcontractorDetails = {},
  paymentDetails = {},
  materials = {},
  cisDeducted = {},
  verification = {},
  adjustments = {},
  netPayment = {},
  disclosures = {},
}) {
  const logoPath = path.join(process.cwd(), "lib/pdf/assets/logo.jpg");
  const logoExists = fs.existsSync(logoPath);

  const buffer = await createPdfBuffer((doc) => {
    //
    // ────────────────────────────────────────────────
    //  HEADER: LOGO + CONTRACTOR DETAILS
    // ────────────────────────────────────────────────
    //
    if (logoExists) {
      doc.image(logoPath, 40, 40, { width: 120 });
      doc.moveDown(3);
    }

    doc.fillColor("black");

    doc
      .fontSize(22)
      .text("CIS Subcontractor Monthly Statement", { align: "center" })
      .moveDown(1.5);

    //
    // Contractor Header Block
    //
    doc.fontSize(12);

    const contractorFields = [
      ["Contractor Name", contractorDetails.business_name || contractorDetails.name],
      ["Trading Name", contractorDetails.trading_name],
      ["UTR Number", contractorDetails.utr_number],
      ["Company Number", contractorDetails.company_number],
      ["Address", contractorDetails.address],
      ["Postcode", contractorDetails.postcode],
      ["Phone", contractorDetails.phone],
      ["Email", contractorDetails.email],
      ["Client ID", clientId],
      ["Period Start", periodStart],
      ["Period End", periodEnd],
    ];

    contractorFields.forEach(([label, value]) => {
      if (value) doc.text(`${label}: ${value}`);
    });

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 1 — SUBCONTRACTOR DETAILS
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("1. Subcontractor Details", { underline: true }).moveDown(0.8);

    if (subcontractorDetails && Object.keys(subcontractorDetails).length > 0) {
      Object.entries(subcontractorDetails).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No subcontractor details recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 2 — PAYMENT DETAILS
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("2. Payment Details", { underline: true }).moveDown(0.8);

    if (paymentDetails && Object.keys(paymentDetails).length > 0) {
      Object.entries(paymentDetails).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No payment details recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 3 — MATERIALS
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("3. Materials", { underline: true }).moveDown(0.8);

    if (materials && Object.keys(materials).length > 0) {
      Object.entries(materials).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No materials recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 4 — CIS DEDUCTED
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("4. CIS Deducted", { underline: true }).moveDown(0.8);

    if (cisDeducted && Object.keys(cisDeducted).length > 0) {
      Object.entries(cisDeducted).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No CIS deductions recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 5 — VERIFICATION DETAILS
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("5. Verification Details", { underline: true }).moveDown(0.8);

    if (verification && Object.keys(verification).length > 0) {
      Object.entries(verification).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No verification details recorded.");
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
    //  SECTION 7 — NET PAYMENT TO SUBCONTRACTOR
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("7. Net Payment", { underline: true }).moveDown(0.8);

    if (netPayment && Object.keys(netPayment).length > 0) {
      Object.entries(netPayment).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No net payment calculation recorded.");
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
    type: "cis_statement",
    periodStart,
    periodEnd,
    year: null,
    taxYear: null,
    filename,
    createdBy,
    metadata: {
      contractorDetails,
      subcontractorDetails,
      paymentDetails,
      materials,
      cisDeducted,
      verification,
      adjustments,
      netPayment,
      disclosures,
    },
    buffer,
  });

  return record;
}
