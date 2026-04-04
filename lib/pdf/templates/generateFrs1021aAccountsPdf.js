import { createPdfBuffer } from "../pdfEngine";
import { storePdfAndRecord } from "../storage";

export async function generateFrs1021aAccountsPdf({
  clientId,
  year,
  periodStart,
  periodEnd,
  filename,
  createdBy,
  companyDetails,
  balanceSheetCurrent,
  balanceSheetPrior,
  pAndlCurrent,
  pAndlPrior,
  notes,
  directorApproval,
  framework = "FRS102_1A",
}) {
  const buffer = await createPdfBuffer((doc) => {
    /* ------------------------------------------------------------ */
    /*                         COVER PAGE                           */
    /* ------------------------------------------------------------ */
    doc.fontSize(20).text(companyDetails.business_name, { align: "center" });
    doc.moveDown(1);
    doc.fontSize(14).text("Small Company Accounts", { align: "center" });
    doc.text(`For the year ended ${periodEnd}`, { align: "center" });
    doc.text(`Prepared under ${framework}`, { align: "center" });
    doc.addPage();

    /* ------------------------------------------------------------ */
    /*                         CONTENTS                             */
    /* ------------------------------------------------------------ */
    doc.fontSize(16).text("Contents", { underline: true });
    doc.moveDown(1);
    doc.fontSize(12).list([
      "Balance Sheet",
      "Accounting Policies",
      "Notes to the Accounts",
      "Director’s Report",
      "Director’s Approval",
    ]);
    doc.addPage();

    /* ------------------------------------------------------------ */
    /*                       BALANCE SHEET                          */
    /* ------------------------------------------------------------ */
    doc.fontSize(16).text("Balance Sheet", { underline: true });
    doc.moveDown(1);

    const bsRows = [
      ["Fixed assets", balanceSheetCurrent.fixedAssets, balanceSheetPrior.fixedAssets],
      ["Current assets", balanceSheetCurrent.currentAssets, balanceSheetPrior.currentAssets],
      ["Creditors: amounts falling due within one year", balanceSheetCurrent.creditors, balanceSheetPrior.creditors],
      ["Net current assets", balanceSheetCurrent.netCurrentAssets, balanceSheetPrior.netCurrentAssets],
      ["Total assets less current liabilities", balanceSheetCurrent.totalAssetsLessLiabilities, balanceSheetPrior.totalAssetsLessLiabilities],
      ["Capital and reserves", balanceSheetCurrent.capitalAndReserves, balanceSheetPrior.capitalAndReserves],
    ];

    doc.fontSize(12);
    bsRows.forEach(([label, curr, prev]) => {
      doc.text(`${label}: ${curr ?? 0} (PY: ${prev ?? 0})`);
    });

    doc.addPage();

    /* ------------------------------------------------------------ */
    /*                   ACCOUNTING POLICIES                        */
    /* ------------------------------------------------------------ */
    doc.fontSize(16).text("Accounting Policies", { underline: true });
    doc.moveDown(1);

    Object.entries(notes?.policies || {}).forEach(([key, value]) => {
      doc.fontSize(12).text(`${key}: ${value}`);
      doc.moveDown(0.5);
    });

    doc.addPage();

    /* ------------------------------------------------------------ */
    /*                       NOTES TO ACCOUNTS                      */
    /* ------------------------------------------------------------ */
    doc.fontSize(16).text("Notes to the Accounts", { underline: true });
    doc.moveDown(1);

    Object.entries(notes?.details || {}).forEach(([key, value]) => {
      doc.fontSize(12).text(`${key}: ${value}`);
      doc.moveDown(0.5);
    });

    doc.addPage();

    /* ------------------------------------------------------------ */
    /*                     DIRECTOR’S REPORT                        */
    /* ------------------------------------------------------------ */
    doc.fontSize(16).text("Director’s Report", { underline: true });
    doc.moveDown(1);

    doc.fontSize(12).text(notes?.directorsReport || "No director’s report provided.");

    doc.addPage();

    /* ------------------------------------------------------------ */
    /*                    DIRECTOR APPROVAL                         */
    /* ------------------------------------------------------------ */
    doc.fontSize(16).text("Director’s Approval", { underline: true });
    doc.moveDown(1);

    doc.fontSize(12).text(
      `The accounts were approved by the board of directors on ${directorApproval.date || ""}.`
    );
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
