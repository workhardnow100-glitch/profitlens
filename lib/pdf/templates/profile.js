// lib/pdf/templates/profile.js
import fs from "fs";
import path from "path";
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

    /* ─────────────────────────────────────────────
     * LOAD IMAGES (process.cwd – unchanged)
     * ───────────────────────────────────────────── */

    const logoPath = path.join(process.cwd(), "public", "logo.jpg");
    const bgPath = path.join(process.cwd(), "public", "growth-bg.jpg");

    const logo = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;
    const bg = fs.existsSync(bgPath) ? fs.readFileSync(bgPath) : null;

    /* ─────────────────────────────────────────────
     * PAGE 1 BACKGROUND + BORDER (ORDER FIXED)
     * ───────────────────────────────────────────── */

    if (bg) {
      doc.save();
      doc.opacity(0.15);
      doc.image(bg, 0, 0, {
        width: doc.page.width,
        height: doc.page.height,
      });
      doc.restore();
    }

    doc.save();
    doc.lineWidth(2);
    doc.strokeColor("#1e293b");
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();
    doc.restore();

    /* ─────────────────────────────────────────────
     * HEADER + LOGO
     * ───────────────────────────────────────────── */

    if (logo) {
      doc.image(logo, doc.page.width - 140, 30, { width: 100 });
    }

    doc
      .fontSize(26)
      .fillColor("#1e293b")
      .text("Client Profile Summary", 40, 40)
      .moveDown(1.5);

    doc.fontSize(12).fillColor("black");
    doc.text(`Client ID: ${client?.id || "—"}`);
    doc.text(`Year: ${yearLabel}`);
    doc.text(`Expense View: ${expenseView}`);
    doc.moveDown(1.5);

    /* ─────────────────────────────────────────────
     * PERSONAL + BUSINESS DETAILS (UNCHANGED)
     * ───────────────────────────────────────────── */

    const leftX = 50;
    const rightX = 300;
    let startY = doc.y;

    // PERSONAL
    doc
      .fontSize(16)
      .fillColor("#1e293b")
      .text("Personal Details", leftX, startY, { underline: true });

    doc.fontSize(12).fillColor("black");
    doc.text(`Full Name: ${client?.name || "—"}`, leftX, doc.y + 10);
    doc.text(`Email: ${client?.email || "—"}`, leftX);
    doc.text(`Phone: ${client?.phone || "—"}`, leftX);
    doc.text(`Address: ${client?.address || "—"}`, leftX);
    doc.text(`Postcode: ${client?.postcode || "—"}`, leftX);
    doc.text(`UTR Number: ${client?.utr_number || "—"}`, leftX);
    doc.text(`Notes: ${client?.notes || "—"}`, leftX);
    doc.text(`Created At: ${client?.created_at || "—"}`, leftX);
    doc.text(`Updated At: ${client?.updated_at || "—"}`, leftX);

    const leftColumnBottom = doc.y;

    // BUSINESS
    doc.y = startY;
    doc
      .fontSize(16)
      .fillColor("#1e293b")
      .text("Business Details", rightX, startY, { underline: true });

    doc.fontSize(12).fillColor("black");
    doc.text(`Business Type: ${client?.business_type || "—"}`, rightX, doc.y + 10);
    doc.text(`Business Name: ${client?.business_name || "—"}`, rightX);
    doc.text(`Trading Name: ${client?.trading_name || "—"}`, rightX);
    doc.text(`Company Number: ${client?.company_number || "—"}`, rightX);
    doc.text(`VAT Number: ${client?.vat_number || "—"}`, rightX);
    doc.text(`Registered Address: ${client?.registered_address || "—"}`, rightX);
    doc.text(`Industry: ${client?.industry || "—"}`, rightX);
    doc.text(`Website: ${client?.website || "—"}`, rightX);
    doc.text(`Contact Person: ${client?.contact_person || "—"}`, rightX);
    doc.text(`Contact Phone: ${client?.contact_phone || "—"}`, rightX);
    doc.text(`Contact Email: ${client?.contact_email || "—"}`, rightX);

    const rightColumnBottom = doc.y;
    doc.y = Math.max(leftColumnBottom, rightColumnBottom) + 20;

    /* ─────────────────────────────────────────────
     * ACCOUNT DETAILS (UNCHANGED)
     * ───────────────────────────────────────────── */

    doc
      .fontSize(16)
      .fillColor("#1e293b")
      .text("Account Details", { underline: true })
      .moveDown(0.5);

    doc.fontSize(12).fillColor("black");
    doc.text(`Account Number: ${account?.account_number || "—"}`);
    doc.text(`Sort Code: ${account?.sort_code || "—"}`);
    doc.moveDown(2);

    /* ─────────────────────────────────────────────
     * SUMMARY (CENTERING FIX ONLY)
     * ───────────────────────────────────────────── */

    doc.x = 40;
    doc
      .fontSize(18)
      .fillColor("#1e293b")
      .text("Summary (filtered by year)", {
        width: doc.page.width - 80,
        align: "center",
        underline: true,
      })
      .moveDown(1);

    doc.fontSize(12).fillColor("black");
    doc.text(
      `Total Income: £${Number(yearSummary?.totalIncome || 0).toFixed(2)}`,
      { width: doc.page.width - 80, align: "center" }
    );
    doc.text(
      `Total Expenses: £${Number(yearSummary?.totalExpenses || 0).toFixed(2)}`,
      { width: doc.page.width - 80, align: "center" }
    );
    doc.text(
      `Net Profit: £${Number(yearSummary?.netProfit || 0).toFixed(2)}`,
      { width: doc.page.width - 80, align: "center" }
    );
    doc.moveDown(1.5);

    /* ─────────────────────────────────────────────
     * HMRC — SOLE TRADER (UNCHANGED)
     * ───────────────────────────────────────────── */

    doc
      .fontSize(16)
      .fillColor("#1e293b")
      .text("HMRC – Sole Trader Breakdown", { underline: true })
      .moveDown(0.5);

    doc.fontSize(12).fillColor("black");
    doc.text(`Total Income: £${Number(hmrcBreakdown?.totalIncome || 0).toFixed(2)}`);
    doc.text(`Allowable Expenses: £${Number(hmrcBreakdown?.allowable || 0).toFixed(2)}`);
    doc.text(
      `Disallowable Expenses: £${Number(hmrcBreakdown?.disallowable || 0).toFixed(2)}`
    );
    doc.text(`Net Profit: £${Number(hmrcBreakdown?.netProfit || 0).toFixed(2)}`);
    doc.text(`Tax Rate: ${(hmrcBreakdown?.soleTraderTaxRate || 0) * 100}%`);
    doc.text(`Tax Owed: £${Number(hmrcBreakdown?.soleTraderOwed || 0).toFixed(2)}`);
    doc.moveDown(1.5);

    /* ─────────────────────────────────────────────
     * HMRC — LIMITED COMPANY (UNCHANGED)
     * ───────────────────────────────────────────── */

    doc
      .fontSize(16)
      .fillColor("#1e293b")
      .text("HMRC – Limited Company Breakdown", { underline: true })
      .moveDown(0.5);

    doc.fontSize(12).fillColor("black");
    doc.text(`Net Profit: £${Number(hmrcBreakdown?.netProfit || 0).toFixed(2)}`);
    doc.text(
      `Corporation Tax Rate: ${(hmrcBreakdown?.limitedCompanyTaxRate || 0) * 100}%`
    );
    doc.text(
      `Corporation Tax Owed: £${Number(hmrcBreakdown?.limitedCompanyOwed || 0).toFixed(2)}`
    );
    doc.moveDown(1.5);

    /* ─────────────────────────────────────────────
     * INCOME BY CATEGORY (UNCHANGED)
     * ───────────────────────────────────────────── */

    doc
      .fontSize(16)
      .fillColor("#1e293b")
      .text("Income by Category", { underline: true })
      .moveDown(0.5);

    const incomeEntries = Object.entries(incomeByCategory || {});
    if (!incomeEntries.length) {
      doc.text("No income data available.");
    } else {
      incomeEntries.forEach(([cat, total]) => {
        doc.text(`${cat}: £${Number(total).toFixed(2)}`);
      });
    }
    doc.moveDown(1.5);

    /* ─────────────────────────────────────────────
     * EXPENSES BY CATEGORY (UNCHANGED)
     * ───────────────────────────────────────────── */

    doc
      .fontSize(16)
      .fillColor("#1e293b")
      .text("Expenses by Category", { underline: true })
      .moveDown(0.5);

    const expenseEntries = Object.entries(expensesByCategory || {});
    if (!expenseEntries.length) {
      doc.text("No expense data available.");
    } else {
      expenseEntries.forEach(([cat, total]) => {
        doc.text(`${cat}: £${Number(total).toFixed(2)}`);
      });
    }
    doc.moveDown(1.5);

    /* ─────────────────────────────────────────────
     * PAGE 2 — TRANSACTIONS (UNCHANGED)
     * ───────────────────────────────────────────── */

    doc.addPage();

    if (bg) {
      doc.save();
      doc.opacity(0.15);
      doc.image(bg, 0, 0, {
        width: doc.page.width,
        height: doc.page.height,
      });
      doc.restore();
    }

    doc.save();
    doc.lineWidth(2);
    doc.strokeColor("#1e293b");
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();
    doc.restore();

    doc
      .fontSize(16)
      .fillColor("#1e293b")
      .text("Transactions (filtered by year)", { underline: true })
      .moveDown(0.5);

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
    doc.moveDown(1.5);

    /* ─────────────────────────────────────────────
     * PAGE 3 — MONTHLY BREAKDOWN (UNCHANGED)
     * ───────────────────────────────────────────── */

    doc.addPage();

    if (bg) {
      doc.save();
      doc.opacity(0.15);
      doc.image(bg, 0, 0, {
        width: doc.page.width,
        height: doc.page.height,
      });
      doc.restore();
    }

    doc.save();
    doc.lineWidth(2);
    doc.strokeColor("#1e293b");
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();
    doc.restore();

    doc
      .fontSize(16)
      .fillColor("#1e293b")
      .text("By Month (filtered by year)", { underline: true })
      .moveDown(0.5);

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

    doc.moveDown(2);
    doc.fontSize(10).fillColor("gray").text(
      "ProfitLens provides estimates only. Always verify figures before filing with HMRC. Nothing displayed here constitutes tax, accounting, or legal advice.",
      { align: "center" }
    );
    doc.fillColor("black");
  });

  return storePdfAndRecord({
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
}
