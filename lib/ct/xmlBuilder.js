// lib/ct/xmlBuilder.js

/**
 * Build the core CT600 XML (NOT the HMRC submission envelope).
 * This is the XML that represents the CT600 form itself.
 */
export function buildCt600Xml(input) {
  const {
    companyNumber,
    companyName,
    periodStart,
    periodEnd,
    computations,
  } = input;

  // Extract key CT fields (expand later)
  const taxableProfit = computations?.taxableProfit ?? 0;
  const corporationTaxDue = computations?.corporationTaxDue ?? 0;

  const xml = `
<?xml version="1.0" encoding="UTF-8"?>
<CT600
  xmlns="http://www.govtalk.gov.uk/taxation/CT600/v3"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.govtalk.gov.uk/taxation/CT600/v3 CT600-v3-2024.xsd"
>
  <CompanyDetails>
    <CompanyName>${escapeXml(companyName)}</CompanyName>
    <CompanyNumber>${escapeXml(companyNumber)}</CompanyNumber>
  </CompanyDetails>

  <ReturnPeriod>
    <StartDate>${periodStart}</StartDate>
    <EndDate>${periodEnd}</EndDate>
  </ReturnPeriod>

  <ComputationSummary>
    <TaxableProfit>${taxableProfit}</TaxableProfit>
    <CorporationTaxDue>${corporationTaxDue}</CorporationTaxDue>
  </ComputationSummary>

  <!-- Expand with full CT600 sections later -->
</CT600>
  `.trim();

  return xml;
}

/* -------------------------------------------------------------------------- */
/*                               HELPERS                                      */
/* -------------------------------------------------------------------------- */

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
