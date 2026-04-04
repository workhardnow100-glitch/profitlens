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

  // Build contents dynamically with page numbers
  const contentsEntries = [];
  let pageCounter = 3;

  contentsEntries.push({
    key: "balanceSheet",
    label: "Balance Sheet",
    page: pageCounter++,
  });

  if (hasPAndL) {
    contentsEntries.push({
      key: "pAndL",
      label: "Profit and Loss Account",
      page: pageCounter++,
    });
  }

  if (hasPolicies) {
    contentsEntries.push({
      key: "policies",
      label: "Accounting Policies",
      page: pageCounter++,
    });
  }

  if (hasNotes) {
    // We’ll show notes across one or more pages; show as a range later if needed
    contentsEntries.push({
      key: "notes",
      label: "Notes to the Financial Statements",
      page: pageCounter, // starting page
    });
    // We’ll increment pageCounter as we actually render notes pages
  }

  if (hasDirectorsReport) {
    contentsEntries.push({
      key: "directorsReport",
      label: "Director’s Report",
      page: null, // will set after notes
    });
  }

  contentsEntries.push({
    key: "approval",
    label: "Director’s Approval",
    page: null, // will set at the end
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

    // We’ll fill in any null page numbers after rendering sections
    const renderContentsLine = (label, page) => {
      const labelWidth = doc.widthOfString(label + " ");
      const pageText = String(page);
      const pageWidth = doc.widthOfString(" " + pageText);
      const dotsWidth = usableWidth - labelWidth - pageWidth;
      const dotsCount = Math.max(0, Math.floor(dotsWidth / dotWidth));
      const dots = ".".repeat(dotsCount);
      const line = `${label} ${dots} ${pageText}`;
      doc.text(line, { align: "left" });
    };

    // Temporarily store to render later once pages are known
    const contentsToRender = contentsEntries.map((entry) => ({
      ...entry,
    }));

    // We’ll come back and render contents at the end of the function
    // So for now, just remember current page and y
    const contentsPageNumber = 2;
    const contentsY = doc.y;

    doc.addPage();

    /* ------------------------------------------------------------ */
    /*                       BALANCE SHEET                          */
    /* ------------------------------------------------------------ */
    const balanceSheetPage = 3;

    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);

    doc.fontSize(16).text("Balance Sheet", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(
      `As at ${formatLongDate(yearEnd)}`,
      { align: "center" }
    );

    doc.moveDown(2);

    const marginLeft = doc.page.margins.left;
    const marginRight = doc.page.width - doc.page.margins.right;
    const totalWidth = marginRight - marginLeft;

    const colLabelX = marginLeft;
    const colCurrX = marginLeft + totalWidth * 0.55;
    const colPrevX = marginLeft + totalWidth * 0.78;

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
    let currentPage = balanceSheetPage + 1;

    let pAndLPage = null;
    if (hasPAndL) {
      pAndLPage = currentPage;

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
      currentPage++;
    }

    /* ------------------------------------------------------------ */
    /*                   ACCOUNTING POLICIES                        */
    /* ------------------------------------------------------------ */
    let policiesPage = null;
    if (hasPolicies) {
      policiesPage = currentPage;

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
      currentPage++;
    }

    /* ------------------------------------------------------------ */
    /*                 NOTES TO THE FINANCIAL STATEMENTS            */
    /* ------------------------------------------------------------ */
    let notesStartPage = null;
    let notesEndPage = null;

    if (hasNotes) {
      notesStartPage = currentPage;

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

        // crude page break if near bottom
        if (doc.y > doc.page.height - doc.page.margins.bottom - 80 && idx < entries.length - 1) {
          doc.addPage();
          currentPage++;
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

      notesEndPage = currentPage;
      doc.addPage();
      currentPage++;
    }

    /* ------------------------------------------------------------ */
    /*                     DIRECTOR’S REPORT                        */
    /* ------------------------------------------------------------ */
    let directorsReportPage = null;
    if (hasDirectorsReport) {
      directorsReportPage = currentPage;

      doc.fontSize(20).text(companyName, { align: "center" });
      doc.moveDown(2);

      doc.fontSize(16).text("Director’s Report", {
        align: "center",
      });
      doc.moveDown(2);

      doc.fontSize(12).text(notes.directorsReport || "");

      doc.addPage();
      currentPage++;
    }

    /* ------------------------------------------------------------ */
    /*                    DIRECTOR APPROVAL                         */
    /* ------------------------------------------------------------ */
    const approvalPage = currentPage;

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

    /* ------------------------------------------------------------ */
    /*              GO BACK AND RENDER CONTENTS PAGE                */
    /* ------------------------------------------------------------ */
    // Fill in actual page numbers for notes range, director’s report, approval
    contentsToRender.forEach((entry) => {
      if (entry.key === "notes" && notesStartPage) {
        if (notesEndPage && notesEndPage !== notesStartPage) {
          entry.page = `${notesStartPage}–${notesEndPage}`;
        } else {
          entry.page = String(notesStartPage);
        }
      }
      if (entry.key === "directorsReport" && directorsReportPage) {
        entry.page = String(directorsReportPage);
      }
      if (entry.key === "approval") {
        entry.page = String(approvalPage);
      }
      if (entry.key === "balanceSheet") {
        entry.page = String(balanceSheetPage);
      }
      if (entry.key === "pAndL" && pAndLPage) {
        entry.page = String(pAndLPage);
      }
      if (entry.key === "policies" && policiesPage) {
        entry.page = String(policiesPage);
      }
    });

    // Jump back to contents page and re-render it cleanly
    doc.switchToPage(contentsPageNumber - 1); // zero-based index
    doc.y = contentsY;
    doc.fontSize(12);

    contentsToRender
      .filter((e) => e.page != null)
      .forEach((entry) => {
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
