import { createPdfBuffer } from "../engine";
import { storePdfAndRecord } from "../engine";

function formatShortDate(d) {
  return d instanceof Date && !isNaN(d)
    ? d.toLocaleDateString("en-GB")
    : "";
}

function formatLongDate(d) {
  return d instanceof Date && !isNaN(d)
    ? d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
}

function formatAmount(value) {
  const num = Number(value) || 0;
  if (num < 0) {
    return `(${Math.abs(num)})`;
  }
  return String(num);
}

export async function generateFrs1021aAccountsPdf({
  clientId,
  year,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  companyDetails,
  overview,        // current year overview JSON
  overviewPrior,   // prior year overview JSON
  pAndlCurrent = {},
  pAndlPrior = {},
  notes = {},
  customNotes = [],
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

  // Map API overview into balance sheet objects (aligned with FRS105 structure)
  const balanceSheetCurrent = {
    fixedAssets: overview?.categories?.fixedAssets ?? 0,
    currentAssets: overview?.totals?.current_assets ?? 0,
    creditors: overview?.totals?.current_liabilities ?? 0,
    netCurrentAssets: overview?.totals?.net_current_assets ?? 0,
    totalAssetsLessLiabilities:
      overview?.totals?.total_assets_less_current_liabilities ?? 0,
    capitalAndReserves: overview?.totals?.total_equity ?? 0,
  };

  const balanceSheetPrior = {
    fixedAssets: overviewPrior?.categories?.fixedAssets ?? 0,
    currentAssets: overviewPrior?.totals?.current_assets ?? 0,
    creditors: overviewPrior?.totals?.current_liabilities ?? 0,
    netCurrentAssets: overviewPrior?.totals?.net_current_assets ?? 0,
    totalAssetsLessLiabilities:
      overviewPrior?.totals?.total_assets_less_current_liabilities ?? 0,
    capitalAndReserves: overviewPrior?.totals?.total_equity ?? 0,
  };

  const hasPAndL =
    pAndlCurrent && Object.keys(pAndlCurrent || {}).length > 0;
  const hasDirectorsReport =
    typeof notes?.directorsReport === "string" &&
    notes.directorsReport.trim().length > 0;
  const hasCustomNotes =
    Array.isArray(customNotes) && customNotes.length > 0;

  const buffer = await createPdfBuffer((doc) => {
    // ---------------- Cover ----------------
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(1);
    doc.fontSize(12).text("Company Registration Number", { align: "center" });
    doc.text(companyNumber, { align: "center" });
    doc.text(`(${jurisdiction})`, { align: "center" });
    doc.moveDown(2);
    doc.fontSize(16).text("Small Company Accounts", { align: "center" });
    doc.moveDown(1);
    doc
      .fontSize(12)
      .text(`For the Year Ended ${formatLongDate(yearEnd)}`, {
        align: "center",
      });
    doc.moveDown(1);
    doc.text(
      "Prepared in accordance with FRS 102 Section 1A\nThe Financial Reporting Standard applicable in the UK and Republic of Ireland",
      { align: "center" }
    );
    doc.addPage();

    // ---------------- Contents ----------------
    const contentsEntries = [];
    let pageNo = 3;

    contentsEntries.push({ label: "Balance Sheet", page: pageNo++ });
    if (hasPAndL) {
      contentsEntries.push({
        label: "Profit and Loss Account",
        page: pageNo++,
      });
    }
    contentsEntries.push({
      label: "Notes to the Financial Statements",
      page: pageNo++,
    });
    if (hasCustomNotes) {
      contentsEntries.push({
        label: "Additional Notes",
        page: pageNo++,
      });
    }
    if (hasDirectorsReport) {
      contentsEntries.push({
        label: "Director’s Report",
        page: pageNo++,
      });
    }
    contentsEntries.push({
      label: "Director’s Approval",
      page: pageNo++,
    });

    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);
    doc.fontSize(16).text("Contents", { underline: true });
    doc.moveDown(2);
    doc.fontSize(12);

    const usableWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const dotWidth = doc.widthOfString(".");
    contentsEntries.forEach((entry) => {
      const labelWidth = doc.widthOfString(entry.label + " ");
      const pageWidth = doc.widthOfString(" " + entry.page);
      const dotsWidth = usableWidth - labelWidth - pageWidth;
      const dotsCount = Math.max(0, Math.floor(dotsWidth / dotWidth));
      const dots = ".".repeat(dotsCount);
      doc.text(`${entry.label} ${dots} ${entry.page}`, { align: "left" });
    });
    doc.addPage();

    // ---------------- Balance Sheet ----------------
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
    doc
      .fontSize(12)
      .text(`As at ${formatLongDate(yearEnd)}`, { align: "center" });
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
        balanceSheetCurrent.fixedAssets,
        balanceSheetPrior.fixedAssets,
      ],
      [
        "Current assets",
        balanceSheetCurrent.currentAssets,
        balanceSheetPrior.currentAssets,
      ],
      [
        "Creditors: amounts falling due within one year",
        -Math.abs(balanceSheetCurrent.creditors),
        -Math.abs(balanceSheetPrior.creditors),
      ],
      [
        "Net current assets",
        balanceSheetCurrent.netCurrentAssets,
        balanceSheetPrior.netCurrentAssets,
      ],
      [
        "Total assets less current liabilities",
        balanceSheetCurrent.totalAssetsLessLiabilities,
        balanceSheetPrior.totalAssetsLessLiabilities,
      ],
      [
        "Capital and reserves",
        balanceSheetCurrent.capitalAndReserves,
        balanceSheetPrior.capitalAndReserves,
      ],
    ];

    bsRows.forEach(([label, curr, prev]) => {
      doc.text(label, colLabelX, y);
      doc.text(formatAmount(curr), colCurrX, y, {
        width: totalWidth * 0.2,
        align: "right",
      });
      doc.text(formatAmount(prev), colPrevX, y, {
        width: totalWidth * 0.2,
        align: "right",
      });
      y += 18;
    });
    doc.y = y + 10;

    // ---------------- Balance Sheet (continued) ----------------
    doc.addPage();
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);
    doc
      .fontSize(16)
      .text("Balance Sheet (continued)", { align: "center" });
    doc.moveDown(2);
    doc
      .fontSize(12)
      .text(
        `For the year ending ${formatLongDate(
          yearEnd
        )} the company was entitled to exemption under section 477 of the Companies Act 2006 relating to small companies.`
      );
    doc.moveDown(1);
    doc.text(
      "The members have not required the company to obtain an audit of its accounts for the year in question in accordance with section 476."
    );
    doc.moveDown(1);
    doc.text(
      "The directors acknowledge their responsibilities for complying with the requirements of the Act with respect to accounting records and the preparation of accounts."
    );
    doc.moveDown(1);
    doc.text(
      "These accounts have been prepared and delivered in accordance with the provisions applicable to small companies."
    );
    doc.addPage();

    // ---------------- Profit and Loss Account (optional) ----------------
    if (hasPAndL) {
      doc.fontSize(20).text(companyName, { align: "center" });
      doc.moveDown(2);
      doc
        .fontSize(16)
        .text("Profit and Loss Account", { align: "center" });
      doc.moveDown(0.5);
      doc
        .fontSize(12)
        .text(`For the Year Ended ${formatLongDate(yearEnd)}`, {
          align: "center",
        });
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
        [
          "Turnover",
          pAndlCurrent.turnover ?? 0,
          pAndlPrior.turnover ?? 0,
        ],
        [
          "Cost of sales",
          -Math.abs(pAndlCurrent.costOfSales ?? 0),
          -Math.abs(pAndlPrior.costOfSales ?? 0),
        ],
        [
          "Gross profit",
          pAndlCurrent.grossProfit ?? 0,
          pAndlPrior.grossProfit ?? 0,
        ],
        [
          "Administrative expenses",
          -Math.abs(pAndlCurrent.adminExpenses ?? 0),
          -Math.abs(pAndlPrior.adminExpenses ?? 0),
        ],
        [
          "Operating profit",
          pAndlCurrent.operatingProfit ?? 0,
          pAndlPrior.operatingProfit ?? 0,
        ],
        [
          "Interest payable and similar charges",
          -Math.abs(pAndlCurrent.interest ?? 0),
          -Math.abs(pAndlPrior.interest ?? 0),
        ],
        [
          "Profit before tax",
          pAndlCurrent.profitBeforeTax ?? 0,
          pAndlPrior.profitBeforeTax ?? 0,
        ],
        [
          "Tax on profit",
          -Math.abs(pAndlCurrent.tax ?? 0),
          -Math.abs(pAndlPrior.tax ?? 0),
        ],
        [
          "Profit for the financial year",
          pAndlCurrent.profitForYear ?? 0,
          pAndlPrior.profitForYear ?? 0,
        ],
      ];

      plRows.forEach(([label, curr, prev]) => {
        doc.text(label, colLabelX, py);
        doc.text(formatAmount(curr), colCurrX, py, {
          width: totalWidth * 0.2,
          align: "right",
        });
        doc.text(formatAmount(prev), colPrevX, py, {
          width: totalWidth * 0.2,
          align: "right",
        });
        py += 18;
      });

      doc.y = py + 10;
      doc.addPage();
    }

    // ---------------- Notes to the Financial Statements ----------------
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);
    doc
      .fontSize(16)
      .text("Notes to the Financial Statements", { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .text(`for the Year Ended ${formatLongDate(yearEnd)}`, {
        align: "center",
      });
    doc.moveDown(2);

    // 1. Accounting Policies
    doc.fontSize(14).text("1. Accounting Policies", { underline: true });
    doc.moveDown(1);
    doc.fontSize(12).text("Turnover", { underline: true });
    doc.text(
      "Turnover is recognised when goods are delivered or services are provided."
    );
    doc.moveDown(1);
    doc.text("Taxation", { underline: true });
    doc.text(
      "Corporation tax is provided at amounts expected to be paid (or recovered) using the tax rates and laws that have been enacted or substantively enacted by the balance sheet date."
    );
    doc.moveDown(1);
    doc.text("Debtors", { underline: true });
    doc.text("Debtors are recognised at the settlement amount due.");
    doc.moveDown(1);
    doc.text("Cash at bank and in hand", { underline: true });
    doc.text(
      "Cash at bank and in hand includes cash and short term highly liquid investments."
    );
    doc.moveDown(1);
    doc.text("Creditors", { underline: true });
    doc.text(
      "Creditors are recognised when there is an obligation at the balance sheet date as a result of a past event."
    );
    doc.addPage();

    // 2. Tangible Fixed Assets
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);
    doc
      .fontSize(16)
      .text("Notes to the Financial Statements (continued)", {
        align: "center",
      });
    doc.moveDown(2);

    doc.fontSize(14).text("2. Tangible fixed assets", { underline: true });
    doc.moveDown(1);
    doc.fontSize(12);

    doc.text("Cost or valuation");
    doc.text(
      `At start of year: £${overviewPrior?.totals?.totalFixedAssets ?? 0}`
    );
    doc.text(`Additions: £${overview?.categories?.assetAdditions ?? 0}`);
    doc.text(`Disposals: £${overview?.categories?.assetDisposals ?? 0}`);
    doc.text(
      `At end of year: £${overview?.totals?.totalFixedAssets ?? 0}`
    );
    doc.moveDown(1);

    doc.text("Depreciation");
    doc.text(
      `At start of year: £${
        overviewPrior?.categories?.accumulatedDepreciation ?? 0
      }`
    );
    doc.text(
      `Charge for year: £${overview?.categories?.depreciationCharge ?? 0}`
    );
    doc.text(
      `On disposals: £${
        overview?.categories?.depreciationDisposals ?? 0
      }`
    );
    doc.text(
      `At end of year: £${
        overview?.categories?.accumulatedDepreciation ?? 0
      }`
    );
    doc.moveDown(1);

    doc.text("Net book values");
    doc.text(
      `Closing balance: £${overview?.categories?.fixedAssets ?? 0}`
    );
    doc.text(
      `Opening balance: £${
        overviewPrior?.categories?.fixedAssets ?? 0
      }`
    );
    doc.moveDown(2);

    // 3. Employee Information
    doc.fontSize(14).text("3. Employee Information", { underline: true });
    doc.moveDown(1);
    doc
      .fontSize(12)
      .text(
        `The average number of employees during the year was: ${
          notes.employees ?? 0
        }`
      );
    doc.moveDown(2);

    // 4. Related Party Transactions / Director Loan Disclosure
    doc.fontSize(14).text("4. Related Party Transactions", {
      underline: true,
    });
    doc.moveDown(1);
    const directorLoanBalance =
      overview?.categories?.directorLoans ?? 0;
    doc
      .fontSize(12)
      .text(
        `At ${formatLongDate(
          yearEnd
        )}, amounts owed by directors totalled £${Math.round(
          directorLoanBalance
        )}.`
      );
    doc.moveDown(1);
    doc.text(
      "These balances represent drawings and personal expenses paid on behalf of directors, which are repayable to the company."
    );

    // ---------------- Additional Notes (Custom) ----------------
    if (hasCustomNotes) {
      doc.addPage();

      doc.fontSize(20).text(companyName, { align: "center" });
      doc.moveDown(2);
      doc.fontSize(16).text("Additional Notes", { align: "center" });
      doc.moveDown(2);

      customNotes.forEach((note, index) => {
        doc.fontSize(14).text(`${index + 1}. ${note.title}`, {
          underline: true,
        });
        doc.moveDown(0.5);

        doc.fontSize(12).text(note.body, {
          align: "justify",
        });

        doc.moveDown(1.5);
      });
    }

    // ---------------- Director’s Report (optional) ----------------
    if (hasDirectorsReport) {
      doc.addPage();

      doc.fontSize(20).text(companyName, { align: "center" });
      doc.moveDown(2);
      doc.fontSize(16).text("Director’s Report", { align: "center" });
      doc.moveDown(2);

      doc.fontSize(12).text(notes.directorsReport, {
        align: "justify",
      });
    }

    // ---------------- Director’s Approval ----------------
    doc.addPage();
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);
    doc.fontSize(16).text("Director’s Approval", { align: "center" });
    doc.moveDown(2);

    const approvalDate = directorApproval.date
      ? formatLongDate(new Date(directorApproval.date))
      : formatLongDate(new Date());
    const approvalName = directorApproval.name || "Director";

    doc
      .fontSize(12)
      .text(
        `The accounts were approved by the board of directors on ${approvalDate}.`
      );
    doc.moveDown(1);
    doc.text(`Director: ${approvalName}`);
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
      customNotes,
      directorApproval,
      framework,
    },
    buffer,
  });
}
