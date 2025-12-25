// lib/pdf/templates/profile.js
import fs from "fs";
import path from "path";
import { createPdfBuffer, storePdfAndRecord } from "../engine";

const __dirname = new URL(".", import.meta.url).pathname;

/* ─────────────────────────────────────────────
 * Helpers (visual only)
 * ───────────────────────────────────────────── */

function drawBackground(doc, bg) {
  if (!bg) return;
  doc.save();
  doc.opacity(0.12);
  doc.image(bg, 0, 0, {
    width: doc.page.width,
    height: doc.page.height,
  });
  doc.restore();
}

function drawBorder(doc) {
  doc.save();
  doc.lineWidth(2);
  doc.strokeColor("#1e293b");
  doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();
  doc.restore();
}

function drawFooter(doc, pageNumber) {
  doc
    .fontSize(9)
    .fillColor("gray")
    .text(`Page ${pageNumber}`, 0, doc.page.height - 30, {
      align: "center",
    })
    .fillColor("black");
}

function centered(doc, text, size = 12) {
  doc.x = 40;
  doc.fontSize(size).text(text, {
    width: doc.page.width - 80,
    align: "center",
  });
}

/* ─────────────────────────────────────────────
 * Main
 * ───────────────────────────────────────────── */

export async function generateProfilePdf({
  clientId,
  filename,
  createdBy,

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
  let page = 1;

  const buffer = await createPdfBuffer((doc) => {
    const yearLabel = selectedYear || "All years";

    /* ───────────── Images (fixed paths) ───────────── */

    const logoPath = path.resolve(__dirname, "../../public/logo.jpg");
    const bgPath = path.resolve(__dirname, "../../public/growth-bg.jpg");

    const logo = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;
    const bg = fs.existsSync(bgPath) ? fs.readFileSync(bgPath) : null;

    /* =================================================
     * PAGE 1
     * ================================================= */

    drawBackground(doc, bg);
    drawBorder(doc);

    if (logo) {
      doc.image(logo, doc.page.width - 140, 30, { width: 100 });
    }

    doc.fontSize(26).fillColor("#1e293b").text("Client Profile Summary", 40, 40);

    doc.moveDown(1.2);
    doc.fontSize(12).fillColor("black");
    doc.text(`Client ID: ${client?.id || "—"}`);
    doc.text(`Year: ${yearLabel}`);
    doc.text(`Expense View: ${expenseView}`);
    doc.moveDown(1.5);

    /* ───────────── Personal & Business ───────────── */

    const leftX = 50;
    const rightX = 300;
    const startY = doc.y;

    doc.fontSize(16).fillColor("#1e293b").text("Personal Details", leftX, startY, {
      underline: true,
    });

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

    const leftBottom = doc.y;

    doc.y = startY;
    doc.fontSize(16).fillColor("#1e293b").text("Business Details", rightX, startY, {
      underline: true,
    });

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

    doc.y = Math.max(leftBottom, doc.y) + 20;

    /* ───────────── Account ───────────── */

    doc.fontSize(16).fillColor("#1e293b").text("Account Details", {
      underline: true,
    });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor("black");
    doc.text(`Account Number: ${account?.account_number || "—"}`);
    doc.text(`Sort Code: ${account?.sort_code || "—"}`);
    doc.moveDown(2);

    /* ───────────── Summary (true center) ───────────── */

    centered(doc, "Summary (filtered by year)", 18);
    doc.moveDown(1);

    centered(
      doc,
      `Total Income: £${Number(yearSummary?.totalIncome || 0).toFixed(2)}`
    );
    centered(
      doc,
      `Total Expenses: £${Number(yearSummary?.totalExpenses || 0).toFixed(2)}`
    );
    centered(
      doc,
      `Net Profit: £${Number(yearSummary?.netProfit || 0).toFixed(2)}`
    );

    drawFooter(doc, page++);

    /* =================================================
     * PAGE 2 — TRANSACTIONS
     * ================================================= */

    doc.addPage();
    drawBackground(doc, bg);
    drawBorder(doc);

    doc.fontSize(16).fillColor("#1e293b").text("Transactions (filtered by year)", {
      underline: true,
    });
    doc.moveDown(0.5);

    doc.fontSize(11).fillColor("#334155");
    doc.text("Date | Description | Category | Amount");
    doc.moveDown(0.3);
    doc.strokeColor("#cbd5f5").moveTo(40, doc.y).lineTo(550, doc.y).stroke();

    doc.fontSize(12).fillColor("black");
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

    drawFooter(doc, page++);

    /* =================================================
     * PAGE 3 — MONTHLY
     * ================================================= */

    doc.addPage();
    drawBackground(doc, bg);
    drawBorder(doc);

    doc.fontSize(16).fillColor("#1e293b").text("By Month (filtered by year)", {
      underline: true,
    });
    doc.moveDown(0.5);

    if (!Object.keys(filteredByMonth || {}).length) {
      doc.text("No monthly data available.");
    } else {
      Object.entries(filteredByMonth).forEach(([month, vals]) => {
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

    drawFooter(doc, page++);
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
