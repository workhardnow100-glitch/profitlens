// lib/xml/buildCt600Xml.ts

export function buildCt600Xml(input) {
  const {
    companyNumber,
    companyName,
    periodStart,
    periodEnd,
    computations,
    utr = "",
    companyType = "LTD",
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
  const disclosures = Array.isArray(computations?.disclosures)
    ? computations.disclosures[0] || {}
    : computations?.disclosures || {};

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
    <TradingProfit>${number(summary.tradingProfit)}</TradingProfit>
    <Adjustments>${number(summary.adjustments)}</Adjustments>
    <CapitalAllowances>${number(summary.capitalAllowances)}</CapitalAllowances>
    <LossesUsed>${number(summary.lossesUsed)}</LossesUsed>
    <TaxableProfit>${number(summary.taxableProfit)}</TaxableProfit>
    <CorporationTaxDue>${number(summary.corporationTaxDue)}</CorporationTaxDue>
  </ComputationSummary>

  <Payments>
    <TotalPaid>${number(payments.totalPaid)}</TotalPaid>
    <BalancingPaymentDue>${number(payments.balancingDue)}</BalancingPaymentDue>
  </Payments>

  <Adjustments>
    <DisallowableExpenses>${number(adjustments.disallowableExpenses)}</DisallowableExpenses>
    <OtherAdjustments>${number(adjustments.other)}</OtherAdjustments>
  </Adjustments>

  <CapitalAllowances>
    <Total>${number(capitalAllowances.totalCapitalAllowances ?? capitalAllowances.total)}</Total>
    <AnnualInvestmentAllowance>${number(capitalAllowances.aiaClaimed ?? capitalAllowances.annualInvestmentAllowance)}</AnnualInvestmentAllowance>
    <FirstYearAllowance>${number(capitalAllowances.firstYearAllowance)}</FirstYearAllowance>
  </CapitalAllowances>

  <Losses>
    <BroughtForward>${number(losses.broughtForward)}</BroughtForward>
    <Used>${number(losses.used)}</Used>
    <CarriedForward>${number(losses.carriedForward)}</CarriedForward>
  </Losses>

  <LoansToParticipators>
    <Outstanding>${number(loans.outstanding)}</Outstanding>
    <WrittenOff>${number(loans.writtenOff)}</WrittenOff>
  </LoansToParticipators>

  <ResearchAndDevelopment>
    <QualifyingExpenditure>${number(rAndD.totalRAndD ?? rAndD.total)}</QualifyingExpenditure>
    <EnhancedDeduction>${number(rAndD.enhancedRelief ?? rAndD.enhancedDeduction)}</EnhancedDeduction>
  </ResearchAndDevelopment>

  <Disclosures>
    <CharitableDonations>${number(disclosures.charitableDonations)}</CharitableDonations>
    <PoliticalDonations>${number(disclosures.politicalDonations)}</PoliticalDonations>
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
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function number(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}
