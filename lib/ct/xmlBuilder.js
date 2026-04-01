export function buildCt600Xml(input) {
  const {
    companyNumber,
    companyName,
    periodStart,
    periodEnd,
    computations,
    utr = "", // optional
    companyType = "LTD", // optional
    declaration = {},
    accountant = {},
    submission = {},
  } = input;

  const summary = computations?.summary || {};
  const payments = computations?.payments || {};
  const adjustments = computations?.adjustments || {};
  const capitalAllowances = computations?.capitalAllowances || {};
  const losses = computations?.losses || {};
  const rAndD = computations?.rAndD || {};
  const loans = computations?.loansToParticipators || {};
  const disclosures = computations?.disclosures || {};

  const xml = `
<CT600
  xmlns="http://www.govtalk.gov.uk/taxation/CT600/v3"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.govtalk.gov.uk/taxation/CT600/v3 CT600-v3-2024.xsd"
>
  <CompanyDetails>
    <CompanyName>${escapeXml(companyName)}</CompanyName>
    <CompanyNumber>${escapeXml(companyNumber)}</CompanyNumber>
    <UTR>${escapeXml(utr)}</UTR>
    <CompanyType>${escapeXml(companyType)}</CompanyType>
  </CompanyDetails>

  <ReturnPeriod>
    <StartDate>${periodStart}</StartDate>
    <EndDate>${periodEnd}</EndDate>
  </ReturnPeriod>

  <ComputationSummary>
    <TradingProfit>${summary.tradingProfit ?? 0}</TradingProfit>
    <Adjustments>${summary.adjustments ?? 0}</Adjustments>
    <CapitalAllowances>${summary.capitalAllowances ?? 0}</CapitalAllowances>
    <LossesUsed>${summary.lossesUsed ?? 0}</LossesUsed>
    <TaxableProfit>${summary.taxableProfit ?? 0}</TaxableProfit>
    <CorporationTaxDue>${summary.corporationTaxDue ?? 0}</CorporationTaxDue>
  </ComputationSummary>

  <Payments>
    <TotalPaid>${payments.totalPaid ?? 0}</TotalPaid>
    <BalancingPaymentDue>${payments.balancingDue ?? 0}</BalancingPaymentDue>
  </Payments>

  <Adjustments>
    <DisallowableExpenses>${adjustments.disallowableExpenses ?? 0}</DisallowableExpenses>
    <OtherAdjustments>${adjustments.other ?? 0}</OtherAdjustments>
  </Adjustments>

  <CapitalAllowances>
    <Total>${capitalAllowances.total ?? 0}</Total>
    <AnnualInvestmentAllowance>${capitalAllowances.annualInvestmentAllowance ?? 0}</AnnualInvestmentAllowance>
    <FirstYearAllowance>${capitalAllowances.firstYearAllowance ?? 0}</FirstYearAllowance>
  </CapitalAllowances>

  <Losses>
    <BroughtForward>${losses.broughtForward ?? 0}</BroughtForward>
    <Used>${losses.used ?? 0}</Used>
    <CarriedForward>${losses.carriedForward ?? 0}</CarriedForward>
  </Losses>

  <LoansToParticipators>
    <Outstanding>${loans.outstanding ?? 0}</Outstanding>
    <WrittenOff>${loans.writtenOff ?? 0}</WrittenOff>
  </LoansToParticipators>

  <ResearchAndDevelopment>
    <QualifyingExpenditure>${rAndD.total ?? 0}</QualifyingExpenditure>
    <EnhancedDeduction>${rAndD.enhancedDeduction ?? 0}</EnhancedDeduction>
  </ResearchAndDevelopment>

  <Disclosures>
    <CharitableDonations>${disclosures.charitableDonations ?? 0}</CharitableDonations>
    <PoliticalDonations>${disclosures.politicalDonations ?? 0}</PoliticalDonations>
  </Disclosures>

  <Declaration>
    <SubmittedBy>${escapeXml(declaration.submittedBy ?? "Accountant")}</SubmittedBy>
    <DeclarationDate>${declaration.date ?? periodEnd}</DeclarationDate>
    <DeclarationStatement>${escapeXml(declaration.statement ?? "I declare the information is correct.")}</DeclarationStatement>
  </Declaration>

  <Accountant>
    <Name>${escapeXml(accountant.name ?? "")}</Name>
    <Firm>${escapeXml(accountant.firm ?? "")}</Firm>
    <Email>${escapeXml(accountant.email ?? "")}</Email>
    <Phone>${escapeXml(accountant.phone ?? "")}</Phone>
  </Accountant>

  <Submission>
    <CorrelationId>${escapeXml(submission.correlationId ?? "")}</CorrelationId>
    <Environment>${escapeXml(submission.environment ?? "test")}</Environment>
    <SubmittedAt>${submission.submittedAt ?? new Date().toISOString()}</SubmittedAt>
  </Submission>
</CT600>
  `.trim();

  return xml;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
