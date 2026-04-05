
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

  const hasPAndL = pAndlCurrent && Object.keys(pAndlCurrent || {}).length > 0;
  const hasPolicies = notes?.policies && Object.keys(notes.policies || {}).length > 0;
  const hasNotes = notes?.details && Object.keys(notes.details || {}).length > 0;
  const hasDirectorsReport = typeof notes?.directorsReport === "string" && notes.directorsReport.trim().length > 0;

  const buffer = await createPdfBuffer((doc) => {
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(1);
    doc.fontSize(12).text("Company Registration Number", { align: "center" });
    doc.text(companyNumber, { align: "center" });
    doc.text(`(${jurisdiction})`, { align: "center" });
    doc.moveDown(2);
    doc.fontSize(16).text("Small Company Accounts", { align: "center" });
    doc.moveDown(1);
    doc.fontSize(12).text(`For the Year Ended ${formatLongDate(yearEnd)}`, { align: "center" });
    doc.moveDown(1);
    doc.text("Prepared in accordance with FRS 102 Section 1A\nThe Financial Reporting Standard applicable in the UK and Republic of Ireland", { align: "center" });
    doc.addPage();

    const contentsEntries = [];
    let pageNo = 3;
    contentsEntries.push({ label: "Balance Sheet", page: pageNo++ });
    if (hasPAndL) contentsEntries.push({ label: "Profit and Loss Account", page: pageNo++ });
    if (hasPolicies) contentsEntries.push({ label: "Accounting Policies", page: pageNo++ });
    if (hasNotes) contentsEntries.push({ label: "Notes to the Financial Statements", page: pageNo++ });
    if (hasDirectorsReport) contentsEntries.push({ label: "Director’s Report", page: pageNo++ });
    contentsEntries.push({ label: "Director’s Approval", page: pageNo++ });

    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);
    doc.fontSize(16).text("Contents", { underline: true });
    doc.moveDown(2);
    doc.fontSize(12);

    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
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
    doc.fontSize(12).text(`As at ${formatLongDate(yearEnd)}`, { align: "center" });
    doc.moveDown(2);

    let y = doc.y;
    doc.fontSize(12);
    doc.text(`${currentYear} (£)`, colCurrX, y, { width: totalWidth * 0.2, align: "right" });
    doc.text(`${priorYear} (£)`, colPrevX, y, { width: totalWidth * 0.2, align: "right" });
    y += 20;

    const bsRows = [
      ["Fixed assets", balanceSheetCurrent?.fixedAssets, balanceSheetPrior?.fixedAssets],
      ["Current assets", balanceSheetCurrent?.currentAssets, balanceSheetPrior?.currentAssets],
      ["Creditors: amounts falling due within one year", balanceSheetCurrent?.creditors, balanceSheetPrior?.creditors],
      ["Net current assets", balanceSheetCurrent?.netCurrentAssets, balanceSheetPrior?.netCurrentAssets],
      ["Total assets less current liabilities", balanceSheetCurrent?.totalAssetsLessLiabilities, balanceSheetPrior?.totalAssetsLessLiabilities],
      ["Capital and reserves", balanceSheetCurrent?.capitalAndReserves, balanceSheetPrior?.capitalAndReserves],
    ];
    bsRows.forEach(([label, curr, prev]) => {
      doc.text(label, colLabelX, y);
      doc.text(String(curr ?? 0), colCurrX, y, { width: totalWidth * 0.2, align: "right" });
      doc.text(String(prev ?? 0), colPrevX, y, { width: totalWidth * 0.2, align: "right" });
      y += 18;
    });
    doc.y = y + 10;

    doc.addPage();
    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);
    doc.fontSize(16).text("Balance Sheet (continued)", { align: "center" });
    doc.moveDown(2);
    doc.fontSize(12).text(`For the year ending ${formatLongDate(yearEnd)} the company was entitled to exemption under section 477 of the Companies Act 2006 relating to small companies.`);
    doc.moveDown(1);
    doc.text("The members have not required the company to obtain an audit of its accounts for the year in question in accordance with section 476.");
    doc.moveDown(1);
    doc.text("The directors acknowledge their responsibilities for complying with the requirements of the Act with respect to accounting records and the preparation of accounts.");
    doc.moveDown(1);
    doc.text("These accounts have been prepared and delivered in accordance with the provisions applicable to small companies.");
    doc.addPage();

    if (hasPAndL) {
      // render P&L rows here
    }

    if (hasPolicies) {
      // render policies here
    }

    if (hasNotes) {
      // render notes here
    }

    if (hasDirectorsReport) {
      // render director’s report here
    }

    doc.fontSize(20).text(companyName, { align: "center" });
    doc.moveDown(2);
    doc.fontSize(16).text("Director’s Approval", { align: "center" });
    doc.moveDown(2);

    const approvalDate = directorApproval.date
      ? formatLongDate(new Date(directorApproval.date))
      : formatLongDate(new Date());
    const approvalName = directorApproval.name || "Director";

    doc.fontSize(12).text(`The accounts were approved by the board of directors on ${approvalDate}.`);
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
      directorApproval,
      framework,
    },
    buffer,
  });
}
