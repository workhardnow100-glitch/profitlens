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

export async function generateFrs105AccountsPdf({
  clientId,
  year,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  companyDetails,
  balanceSheetCurrent = {},
  balanceSheetPrior = {},
  notes = {},
  directorApproval = {},
  framework = "FRS105",
}) {
  const companyName = (companyDetails.business_name || "").toUpperCase();
  const companyNumber = companyDetails.company_number || "";
  const jurisdiction = companyDetails.jurisdiction || "England and Wales";

  const yearEnd = new Date(periodEnd);
  const prevYearEnd = new Date(periodEnd);
  prevYearEnd.setFullYear(prevYearEnd.getFullYear() - 1);

  const currentYear = yearEnd.getFullYear();
  const priorYear = prevYearEnd.getFullYear();

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
    doc.fontSize(16).text("Micro-Entity Accounts", { align: "center" });
    doc.moveDown(1);

    doc.fontSize(12).text(
      `For the Year Ended ${formatLongDate(yearEnd)}`,
      { align: "center" }
    );

    doc.moveDown(1);
    doc.text(
      "Prepared in accordance with the micro-entity provisions\nof the Companies Act 2006 and FRS 105",
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

    const contents = [
      { label: "Balance Sheet", page: "3" },
      { label: "Statement of Compliance", page: "4" },
      { label: "Notes to the Financial Statements", page: "5–7" },
    ];

    doc.fontSize(12);

    const usableWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const dotWidth = doc.widthOfString(".");

    contents.forEach((item) => {
      const labelWidth = doc.widthOfString(item.label);
      const pageWidth = doc.widthOfString(item.page);
      const dotsWidth = usableWidth - labelWidth - pageWidth;
      const dotsCount = Math.max(0, Math.floor(dotsWidth / dotWidth));
      const dots = ".".repeat(dotsCount);

      doc.text(item.label, { continued: true });
      doc.text(` ${dots} `, { continued: true });
      doc.text(item.page, { align: "right" });
    });

    doc.addPage();

    /* ------------------------------------------------------------ */
    /*                       BALANCE SHEET                          */
    /* ------------------------------------------------------------ */
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);

    doc.fontSize(16).text("Balance sheet", { align: "center" });
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

    const rows = [
      [
        "Current assets",
        balanceSheetCurrent.currentAssets,
        balanceSheetPrior.currentAssets,
      ],
      [
        "Creditors: amounts falling due within one year",
        balanceSheetCurrent.creditors,
        balanceSheetPrior.creditors,
      ],
      [
        "Net current assets (liabilities)",
        balanceSheetCurrent.netCurrentAssets,
        balanceSheetPrior.netCurrentAssets,
      ],
      [
        "Total assets less current liabilities",
        balanceSheetCurrent.totalAssetsLessLiabilities,
        balanceSheetPrior.totalAssetsLessLiabilities,
      ],
      [
        "Net assets",
        balanceSheetCurrent.totalNetAssets,
        balanceSheetPrior.totalNetAssets,
      ],
      [
        "Capital and reserves",
        balanceSheetCurrent.capitalAndReserves,
        balanceSheetPrior.capitalAndReserves,
      ],
    ];

    rows.forEach(([label, curr, prev]) => {
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
    /*                 BALANCE SHEET CONTINUED                      */
    /* ------------------------------------------------------------ */
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);

    doc.fontSize(16).text("Balance sheet continued", { align: "center" });
    doc.moveDown(2);

    doc.fontSize(12).text(
      `For the year ending ${formatLongDate(
        yearEnd
      )} the company was entitled to exemption under section 477 of the Companies Act 2006 relating to small companies.`
    );
    doc.moveDown(1);

    doc.fontSize(12).text("Directors’ responsibilities:", { underline: true });
    doc.moveDown(0.5);

    doc.text(
      "The members have not required the company to obtain an audit of its accounts for the year in question in accordance with section 476;"
    );
    doc.moveDown(0.5);

    doc.text(
      "The directors acknowledge their responsibilities for complying with the requirements of the Act with respect to accounting records and the preparation of accounts."
    );
    doc.moveDown(1);

    doc.text(
      "These accounts have been prepared and delivered in accordance with the provisions of the small companies regime applicable to micro-entities."
    );

    doc.moveDown(2);

    doc.text(
      `The accounts were approved by the Board of Directors and authorised for issue on ${formatLongDate(
        new Date()
      )}.`
    );
    doc.moveDown(1);

    if (directorApproval.name) {
      doc.text(directorApproval.name);
    }
    doc.text("Director");

    doc.addPage();

    /* ------------------------------------------------------------ */
    /*                 NOTES – ACCOUNTING POLICIES                  */
    /* ------------------------------------------------------------ */
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

    doc.moveDown(4);
    doc.fontSize(10).text("5", { align: "center" });

    doc.addPage();

    /* ------------------------------------------------------------ */
    /*           NOTES – BASIS OF PREPARATION (CONTINUED)           */
    /* ------------------------------------------------------------ */
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);

    doc.fontSize(16).text(
      "Notes to the Financial Statements (continued)",
      { align: "center" }
    );
    doc.moveDown(2);

    doc.fontSize(14).text("2. Basis of Preparation", { underline: true });
    doc.moveDown(1);

    doc.fontSize(12).text(
      "These financial statements have been prepared in accordance with the micro-entity provisions of the Companies Act 2006 and FRS 105 The Financial Reporting Standard applicable to the Micro-entities Regime."
    );

    doc.moveDown(4);
    doc.fontSize(10).text("6", { align: "center" });

    doc.addPage();

    /* ------------------------------------------------------------ */
    /*           NOTES – EMPLOYEE INFORMATION (CONTINUED)           */
    /* ------------------------------------------------------------ */
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);

    doc.fontSize(16).text(
      "Notes to the Financial Statements (continued)",
      { align: "center" }
    );
    doc.moveDown(2);

    doc.fontSize(14).text("3. Employee Information", { underline: true });
    doc.moveDown(1);

    doc.fontSize(12).text(
      `The average number of employees during the year was: ${
        notes.employees ?? 0
      }`
    );

    doc.moveDown(4);
    doc.fontSize(10).text("7", { align: "center" });
  });

  return await storePdfAndRecord({
    clientId,
    type: "accounts_frs105",
    periodStart,
    periodEnd,
    year,
    filename,
    createdBy,
    metadata: {
      companyDetails,
      balanceSheetCurrent,
      balanceSheetPrior,
      notes,
      directorApproval,
      framework,
    },
    buffer,
  });
}
