// lib/pdf/templates/profile.js
import { createPdfBuffer, storePdfAndRecord } from "../engine";

export async function generateProfilePdf({
  clientId,
  filename,
  createdBy,

  // FULL PAGE PAYLOAD
  client,
  account,
  selectedYear,
  expenseView,
  yearSummary,
  hmrcBreakdown,
  incomeByCategory,
  expensesByCategory,
  filteredTransactions = [],
  filteredByMonth = {},
}) {
  const buffer = await createPdfBuffer((doc) => {
    const yearLabel = selectedYear || "All years";
//
// ─────────────────────────────────────────────
// BUSINESS PROFILE — FULL CLIENT TABLE
// ─────────────────────────────────────────────
//
doc.fontSize(16).text("Business Profile", { underline: true }).moveDown(0.5);
doc.fontSize(12);

// Core identity
doc.text(`Client ID: ${client?.id || "—"}`);
doc.text(`Full Name: ${client?.name || "—"}`);
doc.text(`Owner ID: ${client?.owner_id || "—"}`);
doc.text(`Industry: ${client?.industry || "—"}`);

// Contact + address
doc.text(`Email: ${client?.email || "—"}`);
doc.text(`Phone: ${client?.phone || "—"}`);
doc.text(`Address: ${client?.address || "—"}`);
doc.text(`Postcode: ${client?.postcode || "—"}`);

// Business structure
doc.text(`Business Type: ${client?.business_type || "—"}`);
doc.text(`Business Name: ${client?.business_name || "—"}`);
doc.text(`Trading Name: ${client?.trading_name || "—"}`);
doc.text(`Company Number: ${client?.company_number || "—"}`);
doc.text(`VAT Number: ${client?.vat_number || "—"}`);
doc.text(`UTR Number: ${client?.utr_number || "—"}`);
doc.text(`Registered Address: ${client?.registered_address || "—"}`);

// Website + contacts
doc.text(`Website: ${client?.website || "—"}`);
doc.text(`Contact Person: ${client?.contact_person || "—"}`);
doc.text(`Contact Phone: ${client?.contact_phone || "—"}`);
doc.text(`Contact Email: ${client?.contact_email || "—"}`);

// Notes
doc.text(`Notes: ${client?.notes || "—"}`);

// Timestamps
doc.text(`Created At: ${client?.created_at || "—"}`);
doc.text(`Updated At: ${client?.updated_at || "—"}`);

doc.moveDown();


    //
    // ─────────────────────────────────────────────
    // BUSINESS PROFILE
    // ─────────────────────────────────────────────
    //
    doc.fontSize(16).text("Business Profile", { underline: true }).moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Business Type: ${client?.business_type || "—"}`);
    doc.text(`Address: ${client?.address || "—"}`);
    doc.text(`Postcode: ${client?.postcode || "—"}`);
    doc.text(`Phone: ${client?.phone || "—"}`);
    doc.text(`Email: ${client?.email || "—"}`);
    doc.moveDown();

    //
    // ─────────────────────────────────────────────
    // ACCOUNT DETAILS
    // ─────────────────────────────────────────────
    //
    doc.fontSize(16).text("Account Details", { underline: true }).moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Account Number: ${account?.account_number || "—"}`);
    doc.text(`Sort Code: ${account?.sort_code || "—"}`);
    doc.moveDown();

    //
    // ─────────────────────────────────────────────
    // SUMMARY
    // ─────────────────────────────────────────────
    //
    doc.fontSize(16).text("Summary (filtered by year)", { underline: true }).moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Total Income: £${Number(yearSummary?.totalIncome || 0).toFixed(2)}`);
    doc.text(`Total Expenses: £${Number(yearSummary?.totalExpenses || 0).toFixed(2)}`);
    doc.text(`Net Profit: £${Number(yearSummary?.netProfit || 0).toFixed(2)}`);
    doc.moveDown();

    //
    // ─────────────────────────────────────────────
    // HMRC BREAKDOWN — SOLE TRADER
    // ─────────────────────────────────────────────
    //
    doc.fontSize(16).text("HMRC – Sole Trader Breakdown", { underline: true }).moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Total Income: £${Number(hmrcBreakdown?.totalIncome || 0).toFixed(2)}`);
    doc.text(`Allowable Expenses: £${Number(hmrcBreakdown?.allowable || 0).toFixed(2)}`);
    doc.text(`Disallowable Expenses: £${Number(hmrcBreakdown?.disallowable || 0).toFixed(2)}`);
    doc.text(`Net Profit: £${Number(hmrcBreakdown?.netProfit || 0).toFixed(2)}`);
    doc.text(`Tax Rate: ${(hmrcBreakdown?.soleTraderTaxRate || 0) * 100}%`);
    doc.text(`Tax Owed: £${Number(hmrcBreakdown?.soleTraderOwed || 0).toFixed(2)}`);
    doc.moveDown();

    //
    // ─────────────────────────────────────────────
    // HMRC BREAKDOWN — LIMITED COMPANY
    // ─────────────────────────────────────────────
    //
    doc.fontSize(16).text("HMRC – Limited Company Breakdown", { underline: true }).moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Net Profit: £${Number(hmrcBreakdown?.netProfit || 0).toFixed(2)}`);
    doc.text(`Corporation Tax Rate: ${(hmrcBreakdown?.limitedCompanyTaxRate || 0) * 100}%`);
    doc.text(`Corporation Tax Owed: £${Number(hmrcBreakdown?.limitedCompanyOwed || 0).toFixed(2)}`);
    doc.moveDown();

    //
    // ─────────────────────────────────────────────
    // INCOME BY CATEGORY
    // ─────────────────────────────────────────────
    //
    doc.fontSize(16).text("Income by Category", { underline: true }).moveDown(0.5);
    doc.fontSize(12);

    const incomeEntries = Object.entries(incomeByCategory || {});
    if (!incomeEntries.length) {
      doc.text("No income data available.");
    } else {
      incomeEntries.forEach(([cat, total]) => {
        doc.text(`${cat}: £${Number(total).toFixed(2)}`);
      });
    }
    doc.moveDown();

    //
    // ─────────────────────────────────────────────
    // EXPENSES BY CATEGORY
    // ─────────────────────────────────────────────
    //
    doc.fontSize(16).text("Expenses by Category", { underline: true }).moveDown(0.5);
    doc.fontSize(12);

    const expenseEntries = Object.entries(expensesByCategory || {});
    if (!expenseEntries.length) {
      doc.text("No expense data available.");
    } else {
      expenseEntries.forEach(([cat, total]) => {
        doc.text(`${cat}: £${Number(total).toFixed(2)}`);
      });
    }
    doc.moveDown();

    //
    // ─────────────────────────────────────────────
    // TRANSACTIONS TABLE
    // ─────────────────────────────────────────────
    //
    doc.addPage();
    doc.fontSize(16).text("Transactions (filtered by year)", { underline: true }).moveDown(0.5);
    doc.fontSize(12);

    if (!filteredTransactions.length) {
      doc.text("No transactions available.");
    } else {
      filteredTransactions.forEach((tx) => {
        doc.text(
          `${tx.date || "—"} | ${tx.description || "—"} | ${
            tx.business_category || "Uncategorised"
          } | £${Number(tx.amount || 0).toFixed(2)}`
        );
      });
    }
    doc.moveDown();

    //
    // ─────────────────────────────────────────────
    // MONTHLY BREAKDOWN
    // ─────────────────────────────────────────────
    //
    doc.addPage();
    doc.fontSize(16).text("By Month (filtered by year)", { underline: true }).moveDown(0.5);
    doc.fontSize(12);

    const monthEntries = Object.entries(filteredByMonth || {});
    if (!monthEntries.length) {
      doc.text("No monthly data available.");
    } else {
      monthEntries.forEach(([month, vals]) => {
        doc.text(
          `${month}: Income £${Number(vals.income || 0).toFixed(
            2
          )} | Expenses £${Number(vals.expenses || 0).toFixed(2)}`
        );
      });
    }
    doc.moveDown();

    //
    // ─────────────────────────────────────────────
    // DISCLAIMER
    // ─────────────────────────────────────────────
    //
    doc.moveDown(2);
    doc.fontSize(10).fillColor("gray")
      .text(
        "ProfitLens provides estimates only. Always verify figures before filing with HMRC. Nothing displayed here constitutes tax, accounting, or legal advice.",
        { align: "center" }
      );
    doc.fillColor("black");
  });

  //
  // ─────────────────────────────────────────────
  // STORE PDF + RECORD
  // ─────────────────────────────────────────────
  //
  const record = await storePdfAndRecord({
    clientId,
    type: "profile",
    periodStart: null,
    periodEnd: null,
    year: selectedYear || null,
    taxYear: null,
    filename,
    createdBy,
    metadata: {
      client,
      account,
      selectedYear,
      expenseView,
      yearSummary,
      hmrcBreakdown,
      incomeByCategory,
      expensesByCategory,
      filteredTransactions,
      filteredByMonth,
    },
    buffer,
  });

  return record;
}
