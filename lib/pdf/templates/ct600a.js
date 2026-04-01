// lib/pdf/templates/ct600a.js
import fs from "fs";
import path from "path";
import { createPdfBuffer, storePdfAndRecord } from "../engine";

export async function generateCt600aPdf({
  clientId,
  year,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  companyDetails = {},
  loansToParticipators = {},
  computations = {},
  payments = {},
  disclosures = {},
}) {
  const logoPath = path.join(process.cwd(), "lib/pdf/assets/logo.jpg");
  const logoExists = fs.existsSync(logoPath);

  const buffer = await createPdfBuffer((doc) => {
    const margin = 40;

    //
    // ────────────────────────────────────────────────
    //  OPTIONAL: OUTER PAGE BORDER (SUBTLE)
    // ────────────────────────────────────────────────
    //
    doc
      .strokeColor("#CCCCCC")
      .lineWidth(1)
      .rect(margin / 2, margin / 2, doc.page.width - margin, doc.page.height - margin)
      .stroke();

    //
    // ────────────────────────────────────────────────
    //  HEADER: LOGO (RIGHT) + TITLE + CLIENT BLOCK
    // ────────────────────────────────────────────────
    //
    doc.fillColor("black");

    // Logo top-right
    if (logoExists) {
      const logoWidth = 60;
      const logoX = doc.page.width - margin - logoWidth;
      const logoY = margin;

      doc.image(logoPath, logoX, logoY, { width: logoWidth });
    }

    // Ensure cursor is safely below the logo
    doc.y = Math.max(doc.y, margin + 90);

    // Title
    doc
      .fontSize(22)
      .text("CT600A – Loans to Participators Working Paper", { align: "center" })
      .moveDown(1.5);

    //
    // Bordered client / company details block
    //
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
      ["Phone", companyDetails.phone],
      ["Email", companyDetails.email],
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
    doc.fontSize(16).fillColor("black").text("1. Overview", { underline: true }).moveDown(0.8);

    if (loansToParticipators && Object.keys(loansToParticipators).length > 0) {
      const {
        totalLoans,
        loansAdvanced,
        loansRepaid,
        interestCharged,
        interestPaid,
      } = loansToParticipators;

      if (totalLoans !== undefined) {
        doc.fontSize(12).text(`Total Loans to Participators (period end): ${totalLoans}`);
      }
      if (loansAdvanced !== undefined) {
        doc.fontSize(12).text(`Loans Advanced in Period: ${loansAdvanced}`);
      }
      if (loansRepaid !== undefined) {
        doc.fontSize(12).text(`Loans Repaid in Period: ${loansRepaid}`);
      }
      if (interestCharged !== undefined) {
        doc.fontSize(12).text(`Interest Charged to Participators: ${interestCharged}`);
      }
      if (interestPaid !== undefined) {
        doc.fontSize(12).text(`Interest Paid on Director Loans: ${interestPaid}`);
      }
    } else {
      doc.fontSize(12).text("No loans to participators recorded for this period.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 2: COMPUTATIONS (IF ANY CT600A CHARGE)
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("2. Computations (CT600A)", { underline: true }).moveDown(0.8);

    if (computations && Object.keys(computations).length > 0) {
      Object.entries(computations).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.fontSize(12).text("No specific CT600A computations recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 3: PAYMENTS & BALANCES
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("3. Payments & Balances", { underline: true }).moveDown(0.8);

    if (payments && Object.keys(payments).length > 0) {
      Object.entries(payments).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.fontSize(12).text("No payments or balances recorded specifically for CT600A.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION 4: DISCLOSURES & NOTES
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).text("4. Disclosures & Notes", { underline: true }).moveDown(0.8);

    if (disclosures && Object.keys(disclosures).length > 0) {
      Object.entries(disclosures).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.fontSize(12).text("No additional disclosures provided for CT600A.");
    }

    //
    // ────────────────────────────────────────────────
    //  FOOTER
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

  const record = await storePdfAndRecord({
    clientId,
    type: "ct600a",
    periodStart,
    periodEnd,
    year,
    taxYear: null,
    filename,
    createdBy,
    metadata: {
      companyDetails,
      loansToParticipators,
      computations,
      payments,
      disclosures,
    },
    buffer,
  });

  return record;
}
