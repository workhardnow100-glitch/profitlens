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
    <Turnover>${number(summary.turnover)}</Turnover>
    <NonTradingIncome>${number(summary.nonTradingIncome)}</NonTradingIncome>
    <Expenses>${number(summary.expenses)}</Expenses>
    <CapitalAllowances>${number(summary.capitalAllowances)}</CapitalAllowances>
    <ProfitBeforeTax>${number(summary.profitBeforeTax)}</ProfitBeforeTax>
    <TaxableProfit>${number(computations.taxableProfit)}</TaxableProfit>
    <CorporationTaxDue>${number(computations.corporationTaxDue)}</CorporationTaxDue>
  </ComputationSummary>

  <Payments>
    <TotalPaid>${number(payments.paymentsMade)}</TotalPaid>
    <BalancingPaymentDue>${number(payments.balanceDue)}</BalancingPaymentDue>
  </Payments>

  <Adjustments>
    <NonDeductibleExpenses>${number(adjustments.nonDeductibleExpenses)}</NonDeductibleExpenses>
    <NonTaxableIncomeDeductions>${number(adjustments.nonTaxableIncomeDeduction)}</NonTaxableIncomeDeductions>
    <OtherAdjustments>${number(adjustments.otherAdjustments)}</OtherAdjustments>
  </Adjustments>

  <CapitalAllowances>
    <Total>${number(capitalAllowances.totalCapitalAllowances)}</Total>
    <AnnualInvestmentAllowance>${number(capitalAllowances.aiaClaimed)}</AnnualInvestmentAllowance>
  </CapitalAllowances>

  <Losses>
    <BroughtForward>${number(losses.broughtForward)}</BroughtForward>
    <Used>${number(losses.used)}</Used>
    <Carryback>${number(losses.carryback)}</Carryback>
    <GroupRelief>${number(losses.groupRelief)}</GroupRelief>
    <CarriedForward>${number(losses.carriedForward)}</CarriedForward>
  </Losses>

  <LoansToParticipators>
    <TotalLoans>${number(loans.totalLoans)}</TotalLoans>
    <LoansAdvanced>${number(loans.loansAdvanced)}</LoansAdvanced>
    <LoansRepaid>${number(loans.loansRepaid)}</LoansRepaid>
    <InterestCharged>${number(loans.interestCharged)}</InterestCharged>
    <InterestPaid>${number(loans.interestPaid)}</InterestPaid>
  </LoansToParticipators>

  <ResearchAndDevelopment>
    <TotalRAndD>${number(rAndD.totalRAndD)}</TotalRAndD>
    <EnhancedRelief>${number(rAndD.enhancedRelief)}</EnhancedRelief>
    <Grants>${number(rAndD.grants)}</Grants>
  </ResearchAndDevelopment>

  <Disclosures>
    <Notes>${escapeXml(disclosures.notes ?? "")}</Notes>
  </Disclosures>

  <Declaration>
    <SubmittedBy>${escapeXml(declaration.submittedBy ?? "Accountant")}</SubmittedBy>
    <DeclarationDate>${declaration.date ?? periodEnd}</DeclarationDate>
    <DeclarationStatement>${escapeXml(
      declaration.statement ?? "I declare the information is correct."
    )}</DeclarationStatement>
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
