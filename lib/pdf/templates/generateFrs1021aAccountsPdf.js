import { createPdfBuffer } from "../engine";
import { storePdfAndRecord } from "../engine";

const formatShortDate = (d) =>
  d instanceof Date && !isNaN(d)
    ? d.toLocaleDateString("en-GB")
    : "";

const formatLongDate = (d) =>
  d instanceof Date && !isNaN(d)
    ? d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

export async function generateFrs1021aAccountsPdf({
  clientId,
  year,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  companyDetails,
  balanceSheetCurrent = {},
  balanceSheetPrior = {},
  pAndlCurrent = {},
  pAndlPrior = {},
  notes = {},
  directorApproval = {},
  framework = "FRS102_1A",
}) {
  const companyName = (companyDetails.business_name || "").toUpperCase();
  const companyNumber = companyDetails.company_number || "";
  const jurisdiction = companyDetails.jurisdiction || "England and Wales";

  const yearEnd = new Date(periodEnd);
  const prevYearEnd = new Date(periodEnd);
  prevYearEnd.setFullYear(prevYearEnd.getFullYear() - 1);

  const currentYear = yearEnd.getFullYear();
  const priorYear = prevYearEnd.getFullYear();

  const hasPAndL =
    pAndlCurrent && Object.keys(pAndlCurrent || {}).length > 0;
  const hasPolicies =
    notes?.policies && Object.keys(notes.policies || {}).length > 0;
  const hasNotes =
    notes?.details && Object.keys(notes.details || {}).length > 0;
  const hasDirectorsReport =
    typeof notes?.directorsReport === "string" &&
    notes.directorsReport.trim().length > 0;

  // Precompute contents with page numbers (sequential, no backtracking)
  const contentsEntries = [];
  let pageNo = 3; // 1 = cover, 2 = contents

  contentsEntries.push({
    key: "balanceSheet",
    label: "Balance Sheet",
    page: pageNo++,
  });

  if (hasPAndL) {
    contentsEntries.push({
      key: "pAndL",
      label: "Profit and Loss Account",
      page: pageNo++,
    });
  }

  if (hasPolicies) {
    contentsEntries.push({
      key: "policies",
      label: "Accounting Policies",
      page: pageNo++,
    });
  }

  if (hasNotes) {
    contentsEntries.push({
      key: "notes",
      label: "Notes to the Financial Statements",
      page: pageNo++,
    });
  }

  if (hasDirectorsReport) {
    contentsEntries.push({
      key: "directorsReport",
      label: "Director’s Report",
      page: pageNo++,
    });
  }

  contentsEntries.push({
    key: "approval",
    label: "Director’s Approval",
    page: pageNo++,
  });

  const buffer = await createPdfBuffer((doc) => {
    /* ------------------------------------------------------------ */
    /*                         COVER PAGE                           */
    /* ------------------------------------------------------------ */
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(1);

    doc.fontSize(12).text("Company Registration Number", { align: "center" });
    doc.text(companyNumber, { align: "center" });
    doc.text(`(${jurisdiction})`, { align: "center" });

    doc.moveDown(2);
    doc.fontSize(16).text("Small Company Accounts", { align: "center" });
    doc.moveDown(1);

    doc.fontSize(12).text(
      `For the Year Ended ${formatLongDate(yearEnd)}`,
      { align: "center" }
    );

    doc.moveDown(1);
    doc.text(
      "Prepared in accordance with FRS 102 Section 1A\nThe Financial Reporting Standard applicable in the UK and Republic of Ireland",
      { align: "center" }
    );

    doc.addPage();

    /* ------------------------------------------------------------ */
    /*                         CONTENTS PAGE                        */
    /* ------------------------------------------------------------ */
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);

    doc.fontSize(16).text("Contents", { underline: true });
    doc.moveDown(2);

    doc.fontSize(12);

    const usableWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const dotWidth = doc.widthOfString(".");

    contentsEntries.forEach((entry) => {
      const label = entry.label;
      const pageText = String(entry.page);
      const labelWidth = doc.widthOfString(label + " ");
      const pageWidth = doc.widthOfString(" " + pageText);
      const dotsWidth = usableWidth - labelWidth - pageWidth;
      const dotsCount = Math.max(0, Math.floor(dotsWidth / dotWidth));
      const dots = ".".repeat(dotsCount);
      const line = `${label} ${dots} ${pageText}`;
      doc.text(line, { align: "left" });
    });

    doc.addPage();

    /* ------------------------------------------------------------ */
    /*                       BALANCE SHEET                          */
    /* ------------------------------------------------------------ */
    const marginLeft = doc.page.margins.left;
    const marginRight = doc.page.width - doc.page.margins.right;
    const totalWidth = marginRight - marginLeft;

    const colLabelX = marginLeft;
    const colCurrX = marginLeft + totalWidth * 0.55;
    const colPrevX = marginLeft + totalWidth * 0.78;

    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);

    doc.fontSize(16).text("Balance Sheet", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(
      `As at ${formatLongDate(yearEnd)}`,
      { align: "center" }
    );

    doc.moveDown(2);

    let y = doc.y;

    doc.fontSize(12);
    doc.text(`${currentYear} (£)`, colCurrX, y, {
      width: totalWidth * 0.2,
      align: "right",
    });
    doc.text(`${priorYear} (£)`, colPrevX, y, {
      width: totalWidth * 0.2,
      align: "right",
    });

    y += 20;

    const bsRows = [
      [
        "Fixed assets",
        balanceSheetCurrent?.fixedAssets,
        balanceSheetPrior?.fixedAssets,
      ],
      [
        "Current assets",
        balanceSheetCurrent?.currentAssets,
        balanceSheetPrior?.currentAssets,
      ],
      [
        "Creditors: amounts falling due within one year",
        balanceSheetCurrent?.creditors,
        balanceSheetPrior?.creditors,
      ],
      [
        "Net current assets",
        balanceSheetCurrent?.netCurrentAssets,
        balanceSheetPrior?.netCurrentAssets,
      ],
      [
        "Total assets less current liabilities",
        balanceSheetCurrent?.totalAssetsLessLiabilities,
        balanceSheetPrior?.totalAssetsLessLiabilities,
      ],
      [
        "Capital and reserves",
        balanceSheetCurrent?.capitalAndReserves,
        balanceSheetPrior?.capitalAndReserves,
      ],
    ];

    bsRows.forEach(([label, curr, prev]) => {
      doc.text(label, colLabelX, y);
      doc.text(String(curr ?? 0), colCurrX, y, {
        width: totalWidth * 0.2,
        align: "right",
      });
      doc.text(String(prev ?? 0), colPrevX, y, {
        width: totalWidth * 0.2,
        align: "right",
      });
      y += 18;
    });

    doc.y = y + 10;

    doc.addPage();

    /* ------------------------------------------------------------ */
    /*                   PROFIT AND LOSS ACCOUNT                    */
    /* ------------------------------------------------------------ */
    if (hasPAndL) {
      doc.fontSize(20).text(companyName, { align: "center" });
      doc.moveDown(2);

      doc.fontSize(16).text("Profit and Loss Account", { align: "center" });
      doc.moveDown(0.5);
      doc.fontSize(12).text(
        `For the Year Ended ${formatLongDate(yearEnd)}`,
        { align: "center" }
      );

      doc.moveDown(2);

      let py = doc.y;

      doc.fontSize(12);
      doc.text(`${currentYear} (£)`, colCurrX, py, {
        width: totalWidth * 0.2,
        align: "right",
      });
      doc.text(`${priorYear} (£)`, colPrevX, py, {
        width: totalWidth * 0.2,
        align: "right",
      });

      py += 20;

      const plRows = [
        ["Turnover", pAndlCurrent?.turnover, pAndlPrior?.turnover],
        ["Cost of sales", pAndlCurrent?.costOfSales, pAndlPrior?.costOfSales],
        ["Gross profit", pAndlCurrent?.grossProfit, pAndlPrior?.grossProfit],
        [
          "Administrative expenses",
          pAndlCurrent?.adminExpenses,
          pAndlPrior?.adminExpenses,
        ],
        [
          "Operating profit",
          pAndlCurrent?.operatingProfit,
          pAndlPrior?.operatingProfit,
        ],
        [
          "Interest receivable/(payable)",
          pAndlCurrent?.interest,
          pAndlPrior?.interest,
        ],
        [
          "Profit before tax",
          pAndlCurrent?.profitBeforeTax,
          pAndlPrior?.profitBeforeTax,
        ],
        ["Taxation", pAndlCurrent?.tax, pAndlPrior?.tax],
        [
          "Profit for the financial year",
          pAndlCurrent?.profitForYear,
          pAndlPrior?.profitForYear,
        ],
      ];

      plRows.forEach(([label, curr, prev]) => {
        doc.text(label, colLabelX, py);
        doc.text(String(curr ?? 0), colCurrX, py, {
          width: totalWidth * 0.2,
          align: "right",
        });
        doc.text(String(prev ?? 0), colPrevX, py, {
          width: totalWidth * 0.2,
          align: "right",
        });
        py += 18;
      });

      doc.y = py + 10;
      doc.addPage();
    }

    /* ------------------------------------------------------------ */
    /*                   ACCOUNTING POLICIES                        */
    /* ------------------------------------------------------------ */
    if (hasPolicies) {
      doc.fontSize(20).text(companyName, { align: "center" });
      doc.moveDown(2);

      doc.fontSize(16).text("Accounting Policies", {
        align: "center",
      });
      doc.moveDown(2);

      doc.fontSize(12);

      Object.entries(notes.policies || {}).forEach(([key, value]) => {
        doc.fontSize(12).text(key, { underline: true });
        doc.text(String(value || ""));
        doc.moveDown(1);
      });

      doc.addPage();
    }

    /* ------------------------------------------------------------ */
    /*                 NOTES TO THE FINANCIAL STATEMENTS            */
    /* ------------------------------------------------------------ */
    if (hasNotes) {
      doc.fontSize(20).text(companyName, { align: "center" });
      doc.moveDown(2);

      doc.fontSize(16).text("Notes to the Financial Statements", {
        align: "center",
      });
      doc.moveDown(0.5);

      doc.fontSize(12).text(
        `for the Year Ended ${formatLongDate(yearEnd)}`,
        { align: "center" }
      );

      doc.moveDown(2);

      doc.fontSize(12);

      let noteIndex = 1;
      const entries = Object.entries(notes.details || {});

      entries.forEach(([key, value], idx) => {
        doc.fontSize(12).text(`${noteIndex}. ${key}`, { underline: true });
        doc.moveDown(0.5);
        doc.text(String(value || ""));
        doc.moveDown(1.5);

        noteIndex++;

        if (
          doc.y >
            doc.page.height - doc.page.margins.bottom - 80 &&
          idx < entries.length - 1
        ) {
          doc.addPage();
          doc.fontSize(20).text(companyName, { align: "center" });
          doc.moveDown(2);
          doc.fontSize(16).text(
            "Notes to the Financial Statements (continued)",
            { align: "center" }
          );
          doc.moveDown(2);
          doc.fontSize(12);
        }
      });

      doc.addPage();
    }

    /* ------------------------------------------------------------ */
    /*                     DIRECTOR’S REPORT                        */
    /* ------------------------------------------------------------ */
    if (hasDirectorsReport) {
      doc.fontSize(20).text(companyName, { align: "center" });
      doc.moveDown(2);

      doc.fontSize(16).text("Director’s Report", {
        align: "center",
      });
      doc.moveDown(2);

      doc.fontSize(12).text(notes.directorsReport || "");

      doc.addPage();
    }

    /* ------------------------------------------------------------ */
    /*                    DIRECTOR APPROVAL                         */
    /* ------------------------------------------------------------ */
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);

    doc.fontSize(16).text("Director’s Approval", {
      align: "center",
    });
    doc.moveDown(2);

    const approvalDate = directorApproval.date
      ? formatLongDate(new Date(directorApproval.date))
      : "";

    doc.fontSize(12).text(
      `The accounts were approved by the board of directors on ${approvalDate}.`
    );
    doc.moveDown(1);
    doc.text(`Director: ${directorApproval.name || ""}`);
  });

  return await storePdfAndRecord({
    clientId,
    type: "accounts_frs102_1a",
    periodStart,
    periodEnd,
    year,
    filename,
    createdBy,
    metadata: {
      companyDetails,
      balanceSheetCurrent,
      balanceSheetPrior,
      pAndlCurrent,
      pAndlPrior,
      notes,
      directorApproval,
      framework,
    },
    buffer,
  });
}
