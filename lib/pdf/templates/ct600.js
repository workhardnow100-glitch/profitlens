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
      .text("CT600 Corporation Tax Working Paper", { align: "center" })
      .moveDown(1.5);

    //
    // Bordered client / company details block
    //
    const boxX = margin;
    const boxY = doc.y;
    const boxWidth = doc.page.width - margin * 2;

    // Leave some padding inside the box for text
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

    // Capture bottom of the header content to size the box correctly
    const boxBottomY = doc.y + 10;
    const boxHeight = boxBottomY - boxY;

    // Draw the client details border AFTER writing the text
    doc
      .strokeColor("#999999")
      .lineWidth(1)
      .rect(boxX, boxY, boxWidth, boxHeight)
      .stroke();

    doc.moveDown(2);

    //
    // ────────────────────────────────────────────────
    //  SECTION: SUMMARY
    // ────────────────────────────────────────────────
    //
    doc.fontSize(16).fillColor("black").text("1. Summary", { underline: true }).moveDown(0.8);

    if (ctSummary && Object.keys(ctSummary).length > 0) {
      Object.entries(ctSummary).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.fontSize(12).text("No summary data available.");
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
        doc.fontSize(12).text(`${label}: ${JSON.stringify(value)}`);
      });
    } else {
      doc.fontSize(12).text("No capital allowances recorded.");
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
      doc.fontSize(12).text("No losses recorded.");
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
      doc.fontSize(12).text("No adjustments recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION: R&D (CT600L)
    // ────────────────────────────────────────────────
    //
    doc
      .fontSize(16)
      .text("6. Research & Development (CT600L)", { underline: true })
      .moveDown(0.8);

    if (rAndD && Object.keys(rAndD).length > 0) {
      const {
        totalRAndD,
        enhancedRelief,
        multiplier,
        sme = {},
        rdec = {},
        override = {},
        grants,
      } = rAndD;

      // 6.0 Overview
      doc.fontSize(13).text("6.0 Overview").moveDown(0.4);
      if (totalRAndD !== undefined) {
        doc.fontSize(12).text(`Total R&D Spend (journals): ${totalRAndD}`);
      }
      if (enhancedRelief !== undefined) {
        doc.fontSize(12).text(`Enhanced Relief (SME): ${enhancedRelief}`);
      }
      if (multiplier !== undefined) {
        doc.fontSize(12).text(`SME Uplift Multiplier: ${multiplier}`);
      }
      if (grants !== undefined) {
        doc.fontSize(12).text(`Grants / Subsidies Detected: ${grants}`);
      }
      doc.moveDown(0.8);

      // 6.1 SME Scheme
      doc.fontSize(13).text("6.1 SME Scheme").moveDown(0.4);
      if (Object.keys(sme).length > 0) {
        const {
          qualifyingSpend,
          enhancedDeduction,
          payableCredit,
          surrenderedLoss,
        } = sme;

        if (qualifyingSpend !== undefined) {
          doc.fontSize(12).text(`Qualifying SME Spend: ${qualifyingSpend}`);
        }
        if (enhancedDeduction !== undefined) {
          doc.fontSize(12).text(`Enhanced Deduction: ${enhancedDeduction}`);
        }
        if (surrenderedLoss !== undefined) {
          doc.fontSize(12).text(`Surrendered Loss: ${surrenderedLoss}`);
        }
        if (payableCredit !== undefined) {
          doc.fontSize(12).text(`Payable Credit: ${payableCredit}`);
        }
      } else {
        doc.fontSize(12).text("No SME R&D claim computed.");
      }

      doc.moveDown(0.8);

      // 6.2 RDEC Scheme
      doc.fontSize(13).text("6.2 RDEC Scheme").moveDown(0.4);
      if (Object.keys(rdec).length > 0) {
        const { qualifyingSpend, credit } = rdec;

        if (qualifyingSpend !== undefined) {
          doc.fontSize(12).text(`RDEC Qualifying Spend: ${qualifyingSpend}`);
        }
        if (credit !== undefined) {
          doc.fontSize(12).text(`RDEC Credit: ${credit}`);
        }
      } else {
        doc.fontSize(12).text("No RDEC claim computed.");
      }

      doc.moveDown(0.8);

      // 6.3 Grants & Subsidised Expenditure
      doc.fontSize(13).text("6.3 Grants & Subsidised Expenditure").moveDown(0.4);
      if (grants !== undefined) {
        doc.fontSize(12).text(`Grants / Subsidies affecting R&D: ${grants}`);
      } else {
        doc.fontSize(12).text("No grants or subsidies detected in R&D accounts.");
      }

      doc.moveDown(0.8);

      // 6.4 Manual Overrides
      doc.fontSize(13).text("6.4 Manual Overrides").moveDown(0.4);
      if (override && Object.keys(override).length > 0) {
        const {
          enabled,
          smeEnhancedDeduction,
          smePayableCredit,
          rdecCredit,
          surrenderedLoss,
        } = override;

        doc
          .fontSize(12)
          .text(`Override Enabled: ${enabled ? "Yes" : "No"}`);

        if (smeEnhancedDeduction !== undefined) {
          doc
            .fontSize(12)
            .text(`Override SME Enhanced Deduction: ${smeEnhancedDeduction}`);
        }
        if (smePayableCredit !== undefined) {
          doc
            .fontSize(12)
            .text(`Override SME Payable Credit: ${smePayableCredit}`);
        }
        if (rdecCredit !== undefined) {
          doc.fontSize(12).text(`Override RDEC Credit: ${rdecCredit}`);
        }
        if (surrenderedLoss !== undefined) {
          doc
            .fontSize(12)
            .text(`Override Surrendered Loss: ${surrenderedLoss}`);
        }
      } else {
        doc.fontSize(12).text("No manual overrides configured.");
      }
    } else {
      doc.fontSize(12).text("No R&D claims recorded.");
    }

    doc.moveDown(1.5);

    //
    // ────────────────────────────────────────────────
    //  SECTION: LOANS TO PARTICIPATORS (CT600A)
    // ────────────────────────────────────────────────
    //
    doc
      .fontSize(16)
      .text("7. Loans to Participators (CT600A)", { underline: true })
      .moveDown(0.8);

    if (loansToParticipators && Object.keys(loansToParticipators).length > 0) {
      Object.entries(loansToParticipators).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.fontSize(12).text("No loans to participators recorded.");
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
      doc.fontSize(12).text("No payments recorded.");
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
      doc.fontSize(12).text("No additional disclosures provided.");
    }

    //
    // ────────────────────────────────────────────────
    //  FOOTER: BRAND + DISCLAIMER
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
        {
          align: "center",
        }
      );
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
