/**
 * CT600 PDF TEMPLATE (WORKING PAPER)
 * -----------------------------------
 * PURPOSE:
 *   Generates the accountant‑grade CT600 Working Paper PDF used inside
 *   ProfitLens. This PDF mirrors the structure of:
 *
 *     - CtComputations (canonical model)
 *     - CT600 XML builder
 *     - CT computations iXBRL builder
 *     - CT600 engine (journal‑driven)
 *
 * CALLED BY:
 *   pages/api/forms/generate-pack.js
 *
 * INPUT:
 *   {
 *     clientId,
 *     year,
 *     periodStart,
 *     periodEnd,
 *     filename,
 *     createdBy,
 *     companyDetails,
 *     ctSummary,
 *     computations,
 *     capitalAllowances,
 *     losses,
 *     adjustments,
 *     rAndD,
 *     loansToParticipators,
 *     payments,
 *     disclosures,
 *     supplements
 *   }
 *
 * OUTPUT:
 *   - A fully formatted PDF stored in Supabase under /pdfs/
 *
 * VALIDATION STATUS:
 *   ✓ Fully aligned with new CtComputations model
 *   ✓ Adjustments section upgraded (non‑deductible, non‑taxable, other)
 *   ✓ R&D section aligned with SME + RDEC + overrides
 *   ✓ Capital allowances aligned with pools
 *   ✓ Losses aligned with new engine
 *   ✓ Supplements aligned with CT600 engine
 *   ☐ Pending: visual polish pass (optional)
 */

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
  supplements = {},
}) {
  const logoPath = path.join(process.cwd(), "lib/pdf/assets/logo.jpg");
  const logoExists = fs.existsSync(logoPath);

  const buffer = await createPdfBuffer((doc) => {
    const margin = 40;

    //
    // OUTER BORDER
    //
    doc
      .strokeColor("#CCCCCC")
      .lineWidth(1)
      .rect(margin / 2, margin / 2, doc.page.width - margin, doc.page.height - margin)
      .stroke();

    //
    // HEADER
    //
    doc.fillColor("black");

    if (logoExists) {
      const logoWidth = 60;
      const logoX = doc.page.width - margin - logoWidth;
      const logoY = margin;
      doc.image(logoPath, logoX, logoY, { width: logoWidth });
    }

    doc.y = Math.max(doc.y, margin + 90);

    doc
      .fontSize(22)
      .text("CT600 — Corporation Tax Working Paper", { align: "center" })
      .moveDown(1.5);

    //
    // COMPANY DETAILS BOX
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

    const boxBottomY = doc.y + 10;
    const boxHeight = boxBottomY - boxY;

    doc
      .strokeColor("#999999")
      .lineWidth(1)
      .rect(boxX, boxY, boxWidth, boxHeight)
      .stroke();

    doc.moveDown(2);

    //
    // 1. SUMMARY
    //
    doc.fontSize(16).text("1. Summary", { underline: true }).moveDown(0.8);

    if (ctSummary && Object.keys(ctSummary).length > 0) {
      Object.entries(ctSummary).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.fontSize(12).text("No summary data available.");
    }

    doc.moveDown(1.5);

    //
    // 2. COMPUTATIONS
    //
    doc.fontSize(16).text("2. Computations", { underline: true }).moveDown(0.8);

    const compSections = [
      ["Turnover", computations.turnover],
      ["Non‑Trading Income", computations.nonTradingIncome],
      ["Allowable Expenses", computations.allowableExpenses],
      ["Non‑Deductible Expenses", adjustments.nonDeductibleExpenses],
      ["Other Adjustments", adjustments.otherAdjustments],
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
    // 3. CAPITAL ALLOWANCES
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
    // 4. LOSSES
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
    // 5. ADJUSTMENTS (FULL MODEL)
    //
    doc.fontSize(16).text("5. Adjustments", { underline: true }).moveDown(0.8);

    const adjSections = [
      ["Non‑Deductible Expenses", adjustments.nonDeductibleExpenses],
      ["Non‑Taxable Income Deductions", adjustments.nonTaxableIncomeDeduction],
      ["Other Adjustments", adjustments.otherAdjustments],
    ];

    adjSections.forEach(([label, value]) => {
      if (value !== undefined) doc.fontSize(12).text(`${label}: ${value}`);
    });

    doc.moveDown(1.5);

    //
    // 6. R&D (CT600L)
    //
    doc.fontSize(16).text("6. Research & Development (CT600L)", { underline: true }).moveDown(0.8);

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

      doc.fontSize(13).text("6.0 Overview").moveDown(0.4);
      if (totalRAndD !== undefined) doc.fontSize(12).text(`Total R&D Spend: ${totalRAndD}`);
      if (enhancedRelief !== undefined) doc.text(`Enhanced Relief (SME): ${enhancedRelief}`);
      if (multiplier !== undefined) doc.text(`SME Uplift Multiplier: ${multiplier}`);
      if (grants !== undefined) doc.text(`Grants / Subsidies: ${grants}`);
      doc.moveDown(0.8);

      doc.fontSize(13).text("6.1 SME Scheme").moveDown(0.4);
      if (Object.keys(sme).length > 0) {
        const { qualifyingSpend, enhancedDeduction, payableCredit, surrenderedLoss } = sme;
        if (qualifyingSpend !== undefined) doc.fontSize(12).text(`Qualifying Spend: ${qualifyingSpend}`);
        if (enhancedDeduction !== undefined) doc.text(`Enhanced Deduction: ${enhancedDeduction}`);
        if (surrenderedLoss !== undefined) doc.text(`Surrendered Loss: ${surrenderedLoss}`);
        if (payableCredit !== undefined) doc.text(`Payable Credit: ${payableCredit}`);
      } else {
        doc.fontSize(12).text("No SME R&D claim computed.");
      }

      doc.moveDown(0.8);

      doc.fontSize(13).text("6.2 RDEC Scheme").moveDown(0.4);
      if (Object.keys(rdec).length > 0) {
        const { qualifyingSpend, credit } = rdec;
        if (qualifyingSpend !== undefined) doc.fontSize(12).text(`RDEC Qualifying Spend: ${qualifyingSpend}`);
        if (credit !== undefined) doc.text(`RDEC Credit: ${credit}`);
      } else {
        doc.fontSize(12).text("No RDEC claim computed.");
      }

      doc.moveDown(0.8);

      doc.fontSize(13).text("6.3 Grants & Subsidised Expenditure").moveDown(0.4);
      if (grants !== undefined) doc.fontSize(12).text(`Grants / Subsidies: ${grants}`);
      else doc.fontSize(12).text("No grants detected.");

      doc.moveDown(0.8);

      doc.fontSize(13).text("6.4 Manual Overrides").moveDown(0.4);
      if (override && Object.keys(override).length > 0) {
        const { enabled, smeEnhancedDeduction, smePayableCredit, rdecCredit, surrenderedLoss } = override;
        doc.fontSize(12).text(`Override Enabled: ${enabled ? "Yes" : "No"}`);
        if (smeEnhancedDeduction !== undefined) doc.text(`Override SME Enhanced Deduction: ${smeEnhancedDeduction}`);
        if (smePayableCredit !== undefined) doc.text(`Override SME Payable Credit: ${smePayableCredit}`);
        if (rdecCredit !== undefined) doc.text(`Override RDEC Credit: ${rdecCredit}`);
        if (surrenderedLoss !== undefined) doc.text(`Override Surrendered Loss: ${surrenderedLoss}`);
      } else {
        doc.fontSize(12).text("No manual overrides configured.");
      }
    } else {
      doc.fontSize(12).text("No R&D claims recorded.");
    }

    doc.moveDown(1.5);

    //
    // 7. LOANS TO PARTICIPATORS
    //
    doc.fontSize(16).text("7. Loans to Participators (CT600A)", { underline: true }).moveDown(0.8);

    if (loansToParticipators && Object.keys(loansToParticipators).length > 0) {
      Object.entries(loansToParticipators).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.fontSize(12).text("No loans to participators recorded.");
    }

    doc.moveDown(1.5);

    //
    // 8. PAYMENTS & BALANCES
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
    // 9. ADDITIONAL DISCLOSURES
    //
    doc.fontSize(16).text("9. Additional Disclosures", { underline: true }).moveDown(0.8);

    if (disclosures && Object.keys(disclosures).length > 0) {
      Object.entries(disclosures).forEach(([label, value]) => {
        doc.fontSize(12).text(`${label}: ${value}`);
      });
    } else {
      doc.fontSize(12).text("No additional disclosures provided.");
    }

    doc.moveDown(1.5);

    //
    // 10. SUPPLEMENTS
    //
    doc.fontSize(16).text("10. Supplement Forms Included", { underline: true }).moveDown(0.8);

    const supplementFlags = [
      ["CT600A — Loans to Participators", supplements.ct600ARequired],
      ["CT600J — DOTAS Disclosure", supplements.ct600JRequired],
      ["CT600L — R&D Supplement", supplements.ct600LRequired],
      ["CT600F — Charity Exemptions", supplements.ct600FRequired],
      ["CT600M — Cross-Border Royalties", supplements.ct600MRequired],
      ["CT600N — Northern Ireland Rate", supplements.ct600NRequired],
    ];

    supplementFlags.forEach(([label, flag]) => {
      doc.fontSize(12).text(`${label}: ${flag ? "Yes" : "No"}`);
    });

    doc.moveDown(1.5);

    //
    // 11. CORPORATION TAX SUMMARY
    //
    doc.fontSize(16).text("11. Corporation Tax Summary", { underline: true }).moveDown(0.8);

    const taxSummary = [
      ["Profit Before Tax", computations.adjustedProfit],
      ["Taxable Total Profit", computations.taxableProfit],
      ["Corporation Tax Rate", computations.taxRate],
      ["Marginal Relief", computations.marginalRelief],
      ["Corporation Tax Due", computations.taxDue],
      ["Total Payable", payments.balanceDue],
    ];

    taxSummary.forEach(([label, value]) => {
      if (value !== undefined) doc.fontSize(12).text(`${label}: ${value}`);
    });

    doc.moveDown(1.5);

    //
    // 12. INCOME CATEGORIES
    //
    doc.fontSize(16).text("12. Income Categories", { underline: true }).moveDown(0.8);

    const incomeCats = [
      ["Trading Income", computations.turnover],
      ["Non-Trading Income", computations.nonTradingIncome],
      ["Property Income", computations.propertyIncome],
      ["Chargeable Gains", computations.chargeableGains],
      ["Loan Relationships", computations.loanRelationships],
      ["Intangibles", computations.intangibles],
    ];

    incomeCats.forEach(([label, value]) => {
      if (value !== undefined) doc.fontSize(12).text(`${label}: ${value}`);
    });

    doc.moveDown(1.5);

    //
    // 13. PAYMENTS & BALANCES (EXPANDED)
    //
    doc.fontSize(16).text("13. Payments & Balances (Expanded)", { underline: true }).moveDown(0.8);

    const paymentDetails = [
      ["Payments Made", payments.paymentsMade],
      ["Overpayments", payments.overpayments],
      ["Balance Brought Forward", payments.balanceBroughtForward],
      ["Balance Carried Forward", payments.balanceDue],
    ];

    paymentDetails.forEach(([label, value]) => {
      if (value !== undefined) doc.fontSize(12).text(`${label}: ${value}`);
    });

    //
    // FOOTER
    //
    doc.moveDown(3);
    doc.fontSize(10).fillColor("gray").text("ProfitLens Technologies Ltd", { align: "center" });
    doc
      .fontSize(8)
      .fillColor("gray")
      .text(
        "ProfitLens provides estimates only. Always verify figures before filing with HMRC.",
        { align: "center" }
      );
  });

  return await storePdfAndRecord({
    clientId,
    type: "ct600",
    periodStart,
    periodEnd,
    year,
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
      supplements,
    },
    buffer,
  });
}
