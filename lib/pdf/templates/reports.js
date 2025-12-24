// lib/pdf/templates/reports.js
import { createPdfBuffer, storePdfAndRecord } from "../engine";

export async function generateReportsPdf({
  clientId,
  filename,
  createdBy,

  selectedCategory,
  selectedClient,
  filteredReports = [],
  transactions = [],
}) {
  const buffer = await createPdfBuffer((doc) => {
    //
    // ─────────────────────────────────────────────
    // HEADER
    // ─────────────────────────────────────────────
    //
    doc.fontSize(20).text("Reports Summary", { align: "center" }).moveDown();
    doc.fontSize(12);
    doc.text(`Category Filter: ${selectedCategory || "All"}`);
    doc.text(`Client Filter: ${selectedClient || "All Clients"}`);
    doc.moveDown();

    //
    // ─────────────────────────────────────────────
    // MONTHLY REPORTS (each month = one page)
    // ─────────────────────────────────────────────
    //
    filteredReports.forEach((report, i) => {
      if (i > 0) doc.addPage();

      doc.fontSize(16).text(report.label, { underline: true }).moveDown(0.5);
      doc.fontSize(12);

      doc.text(`Revenue: £${Number(report.revenue || 0).toFixed(2)}`);
      doc.text(`Expenses: £${Number(report.expenses || 0).toFixed(2)}`);
      doc.text(`Net: £${Number(report.net || 0).toFixed(2)}`);
      doc.moveDown();

      //
      // CATEGORY BREAKDOWN
      //
      doc.fontSize(14).text("Category Breakdown", { underline: true }).moveDown(0.5);
      doc.fontSize(12);

      if (!report.categories?.length) {
        doc.text("No category data available.");
      } else {
        report.categories.forEach((cat) => {
          doc.text(`${cat.name}: £${Number(cat.amount || 0).toFixed(2)}`);
        });
      }
      doc.moveDown();

      //
      // TRANSACTIONS
      //
      if (report.transactions?.length) {
        doc.fontSize(14).text("Transactions", { underline: true }).moveDown(0.5);
        doc.fontSize(12);

        report.transactions.forEach((tx) => {
          doc.text(
            `${tx.date} | ${tx.description} | ${tx.category} | £${Number(
              tx.amount || 0
            ).toFixed(2)}`
          );
        });
      }
    });

    //
    // ─────────────────────────────────────────────
    // CLIENT‑LEVEL TRANSACTIONS (Sankey, Sunburst, Heatmap)
    // ─────────────────────────────────────────────
    //
    if (transactions.length) {
      doc.addPage();
      doc.fontSize(16)
        .text("Transactions for Selected Client", { underline: true })
        .moveDown(0.5);

      doc.fontSize(12);
      transactions.forEach((tx) => {
        doc.text(
          `${tx.date} | ${tx.description} | ${tx.category} | £${Number(
            tx.amount || 0
          ).toFixed(2)}`
        );
      });
    }

    //
    // ─────────────────────────────────────────────
    // DISCLAIMER
    // ─────────────────────────────────────────────
    //
    doc.moveDown(2);
    doc.fontSize(10)
      .fillColor("gray")
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
    type: "reports",
    periodStart: null,
    periodEnd: null,
    year: null,
    taxYear: null,
    filename,
    createdBy,
    metadata: {
      selectedCategory,
      selectedClient,
      filteredReports,
      transactions,
    },
    buffer,
  });

  return record;
}
