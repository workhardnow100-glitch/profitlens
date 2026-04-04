import { createPdfBuffer } from "../engine";
import { storePdfAndRecord } from "../engine";

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
  const companyName = companyDetails.business_name || "";
  const companyNumber = companyDetails.company_number || "";
  const jurisdiction = companyDetails.jurisdiction || "England and Wales";

  const yearEnd = new Date(periodEnd);
  const prevYearEnd = new Date(periodEnd);
  prevYearEnd.setFullYear(prevYearEnd.getFullYear() - 1);

  const formatDate = (d) =>
    d instanceof Date && !isNaN(d) ? d.toLocaleDateString("en-GB") : "";

  const buffer = await createPdfBuffer((doc) => {
    /* ------------------------------------------------------------ */
    /*                         COVER PAGE                           */
    /* ------------------------------------------------------------ */
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(1);

    doc.fontSize(12).text(`Company Registration Number`, { align: "center" });
    doc.text(companyNumber, { align: "center" });
    doc.text(`(${jurisdiction})`, { align: "center" });

    doc.moveDown(2);
    doc.fontSize(16).text("Micro‑Entity Accounts", { align: "center" });
    doc.moveDown(1);

    doc.text(
      `For the Year Ended ${formatDate(yearEnd)}`,
      { align: "center" }
    );

    doc.moveDown(1);
    doc.text(
      "Prepared in accordance with the micro‑entity provisions\nof the Companies Act 2006 and FRS 105",
      { align: "center" }
    );

    doc.addPage();

    /* ------------------------------------------------------------ */
    /*                         CONTENTS                             */
    /* ------------------------------------------------------------ */
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);

    doc.fontSize(16).text("Contents", { underline: true });
    doc.moveDown(1);

    doc.fontSize(12).list([
      "Balance Sheet\t\t3",
      "Statement of Compliance\t4",
      "Notes to the Financial Statements\t5–7",
    ]);

    doc.addPage();

    /* ------------------------------------------------------------ */
    /*                       BALANCE SHEET                          */
    /* ------------------------------------------------------------ */
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);

    doc.fontSize(16).text(
      `Balance sheet\nAs at ${formatDate(yearEnd)}`,
      { align: "center" }
    );

    doc.moveDown(2);

    const rows = [
      ["Current assets", balanceSheetCurrent.currentAssets, balanceSheetPrior.currentAssets],
      ["Creditors: amounts falling due within one year", balanceSheetCurrent.creditors, balanceSheetPrior.creditors],
      ["Net current assets (liabilities)", balanceSheetCurrent.netCurrentAssets, balanceSheetPrior.netCurrentAssets],
      ["Total assets less current liabilities", balanceSheetCurrent.totalAssetsLessLiabilities, balanceSheetPrior.totalAssetsLessLiabilities],
      ["Total net assets (liabilities)", balanceSheetCurrent.totalNetAssets, balanceSheetPrior.totalNetAssets],
      ["Capital and reserves", balanceSheetCurrent.capitalAndReserves, balanceSheetPrior.capitalAndReserves],
    ];

    doc.fontSize(12);
    doc.text("2024 £\t\t2023 £");
    doc.moveDown(1);

    rows.forEach(([label, curr, prev]) => {
      doc.text(`${label}\t${curr ?? 0}\t${prev ?? 0}`);
    });

    doc.addPage();

    /* ------------------------------------------------------------ */
    /*                 BALANCE SHEET CONTINUED                      */
    /* ------------------------------------------------------------ */
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);

    doc.fontSize(16).text("Balance sheet continued", { align: "center" });
    doc.moveDown(2);

    doc.fontSize(12).text(
      "For the year ending the company was entitled to exemption under section 477 of the Companies Act 2006 relating to small companies."
    );
    doc.moveDown(1);

    doc.text(
      "The members have not required the company to obtain an audit of its accounts for the year in question in accordance with section 476;"
    );
    doc.moveDown(1);

    doc.text(
      "The directors acknowledge their responsibilities for complying with the requirements of the Act with respect to accounting records and the preparation of accounts."
    );
    doc.moveDown(1);

    doc.text(
      "These accounts have been prepared and delivered in accordance with the provisions of the small companies regime applicable to micro‑entities."
    );

    doc.moveDown(2);

    doc.text(
      `The accounts were approved by the Board of Directors and authorised for issue on ${formatDate(
        new Date()
      )}.`
    );
    doc.moveDown(1);

    doc.text(`${directorApproval.name || "Director"}`, { align: "left" });

    doc.addPage();

    /* ------------------------------------------------------------ */
    /*                       NOTES SECTION                          */
    /* ------------------------------------------------------------ */
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);

    doc.fontSize(16).text(
      `Notes to the Financial Statements\nfor the Year Ended ${formatDate(yearEnd)}`,
      { align: "center" }
    );

    doc.moveDown(2);

    /* Note 1 — Accounting Policies */
    doc.fontSize(14).text("1. Accounting Policies", { underline: true });
    doc.moveDown(1);

    doc.fontSize(12).text("Turnover");
    doc.text("Turnover is recognised when goods are delivered or services are provided.");
    doc.moveDown(1);

    doc.text("Taxation");
    doc.text(
      "Corporation tax is provided at amounts expected to be paid (or recovered) using the tax rates and laws that have been enacted or substantively enacted by the balance sheet date."
    );
    doc.moveDown(1);

    doc.text("Debtors");
    doc.text("Debtors are recognised at the settlement amount due.");
    doc.moveDown(1);

    doc.text("Cash at bank and in hand");
    doc.text("Cash includes cash and short‑term highly liquid investments.");
    doc.moveDown(1);

    doc.text("Creditors");
    doc.text("Creditors are recognised when there is an obligation at the balance sheet date.");
    doc.moveDown(2);

    /* Note 2 — Basis of Preparation */
    doc.fontSize(14).text("2. Basis of Preparation", { underline: true });
    doc.moveDown(1);

    doc.fontSize(12).text(
      "These financial statements have been prepared in accordance with the micro‑entity provisions of the Companies Act 2006 and FRS 105 The Financial Reporting Standard applicable to the Micro‑entities Regime."
    );

    doc.moveDown(2);

    /* Note 3 — Employees */
    doc.fontSize(14).text("3. Employee Information", { underline: true });
    doc.moveDown(1);

    doc.fontSize(12).text(
      `The average number of employees during the year was: ${notes.employees ?? 0}`
    );
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
