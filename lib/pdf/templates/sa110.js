// lib/pdf/templates/sa110.js
import fs from "fs";
import path from "path";
import { createPdfBuffer, storePdfAndRecord } from "../engine";

export async function generateSa110Pdf({
  clientId,
  taxYear,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  clientDetails = {},
  sa110Summary = {},
  totalIncome = {},
  adjustments = {},
  allowances = {},
  taxableIncome = {},
  taxBands = {},
  taxDue = {},
  nicClass2 = {},
  nicClass4 = {},
  paymentsOnAccount = {},
  balancingPayments = {},
  refunds = {},
  finalLiability = {},
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
      const logoWidth = 60;
      const logoX = doc.page.width - margin - logoWidth;
      const logoY = margin;

      doc.image(logoPath, logoX, logoY, { width: logoWidth });
    }

    // Ensure cursor is below logo
    doc.y = Math.max(doc.y, margin + 70);

    doc
      .fontSize(22)
      .text("SA110 Tax Calculation Summary Working Paper", { align: "center" })
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

    if (sa110Summary && Object.keys(sa110Summary).length > 0) {
      Object.entries(sa110Summary).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No summary data available.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 2 — TOTAL INCOME
    //
    doc.fontSize(16).text("2. Total Income", { underline: true }).moveDown(0.8);

    if (totalIncome && Object.keys(totalIncome).length > 0) {
      Object.entries(totalIncome).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No income data recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 3 — ADJUSTMENTS
    //
    doc.fontSize(16).text("3. Adjustments", { underline: true }).moveDown(0.8);

    if (adjustments && Object.keys(adjustments).length > 0) {
      Object.entries(adjustments).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No adjustments recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 4 — ALLOWANCES
    //
    doc.fontSize(16).text("4. Allowances", { underline: true }).moveDown(0.8);

    if (allowances && Object.keys(allowances).length > 0) {
      Object.entries(allowances).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No allowances recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 5 — TAXABLE INCOME
    //
    doc.fontSize(16).text("5. Taxable Income", { underline: true }).moveDown(0.8);

    if (taxableIncome && Object.keys(taxableIncome).length > 0) {
      Object.entries(taxableIncome).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No taxable income recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 6 — TAX BANDS
    //
    doc.fontSize(16).text("6. Tax Bands", { underline: true }).moveDown(0.8);

    if (taxBands && Object.keys(taxBands).length > 0) {
      Object.entries(taxBands).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No tax band data recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 7 — TAX DUE
    //
    doc.fontSize(16).text("7. Tax Due", { underline: true }).moveDown(0.8);

    if (taxDue && Object.keys(taxDue).length > 0) {
      Object.entries(taxDue).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No tax due recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 8 — CLASS 2 NIC
    //
    doc.fontSize(16).text("8. Class 2 NIC", { underline: true }).moveDown(0.8);

    if (nicClass2 && Object.keys(nicClass2).length > 0) {
      Object.entries(nicClass2).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No Class 2 NIC recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 9 — CLASS 4 NIC
    //
    doc.fontSize(16).text("9. Class 4 NIC", { underline: true }).moveDown(0.8);

    if (nicClass4 && Object.keys(nicClass4).length > 0) {
      Object.entries(nicClass4).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No Class 4 NIC recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 10 — PAYMENTS ON ACCOUNT
    //
    doc.fontSize(16).text("10. Payments on Account", { underline: true }).moveDown(0.8);

    if (paymentsOnAccount && Object.keys(paymentsOnAccount).length > 0) {
      Object.entries(paymentsOnAccount).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No payments on account recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 11 — BALANCING PAYMENTS
    //
    doc.fontSize(16).text("11. Balancing Payments", { underline: true }).moveDown(0.8);

    if (balancingPayments && Object.keys(balancingPayments).length > 0) {
      Object.entries(balancingPayments).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No balancing payments recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 12 — REFUNDS
    //
    doc.fontSize(16).text("12. Refunds", { underline: true }).moveDown(0.8);

    if (refunds && Object.keys(refunds).length > 0) {
      Object.entries(refunds).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No refunds recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 13 — FINAL LIABILITY
    //
    doc.fontSize(16).text("13. Final Liability", { underline: true }).moveDown(0.8);

    if (finalLiability && Object.keys(finalLiability).length > 0) {
      Object.entries(finalLiability).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.text("No final liability recorded.");
    }

    doc.moveDown(1.5);

    //
    // SECTION 14 — ADDITIONAL DISCLOSURES
    //
    doc.fontSize(16).text("14. Additional Disclosures", { underline: true }).moveDown(0.8);

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
    type: "sa110",
    periodStart,
    periodEnd,
    year: taxYear,
    taxYear,
    filename,
    createdBy,
    metadata: {
      clientDetails,
      sa110Summary,
      totalIncome,
      adjustments,
      allowances,
      taxableIncome,
      taxBands,
      taxDue,
      nicClass2,
      nicClass4,
      paymentsOnAccount,
      balancingPayments,
      refunds,
      finalLiability,
      disclosures,
    },
    buffer,
  });

  return record;
}
