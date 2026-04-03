/**
 * CT600 XML Builder
 * -----------------
 */

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

/**
 * HMRC SUBMISSION ENVELOPE
 * ------------------------
 * Wraps CT600 + computations iXBRL + accounts iXBRL
 * into a GovTalkMessage suitable for gateway submission.
 */

export function buildHmrcSubmissionEnvelope(input) {
  const {
    correlationId,
    senderId,
    password,
    companyNumber,
    companyName,
    periodStart,
    periodEnd,
    ct600Xml,
    computationsIxbrl,
    accountsIxbrl,
    environment = "test",
  } = input;

  const gatewayTest = environment === "test" ? "1" : "0";

  const xml = `
<?xml version="1.0" encoding="UTF-8"?>
<GovTalkMessage xmlns="http://www.govtalk.gov.uk/CM/envelope">
  <EnvelopeVersion>2.0</EnvelopeVersion>

  <Header>
    <MessageDetails>
      <Class>CT600</Class>
      <Qualifier>request</Qualifier>
      <Function>submit</Function>
      <TransactionID>${escapeXml(correlationId)}</TransactionID>
      <CorrelationID>${escapeXml(correlationId)}</CorrelationID>
      <GatewayTest>${gatewayTest}</GatewayTest>
    </MessageDetails>

    <SenderDetails>
      <IDAuthentication>
        <SenderID>${escapeXml(senderId)}</SenderID>
        <Authentication>
          <Method>clear</Method>
          <Value>${escapeXml(password)}</Value>
        </Authentication>
      </IDAuthentication>
    </SenderDetails>
  </Header>

  <GovTalkDetails>
    <Keys>
      <Key Type="UTR">${escapeXml(companyNumber)}</Key>
    </Keys>
  </GovTalkDetails>

  <Body>
    <IRenvelope:IRheader xmlns:IRenvelope="http://www.govtalk.gov.uk/taxation/CT/3">
      <IRenvelope:Keys>
        <IRenvelope:Key Type="CompanyName">${escapeXml(companyName)}</IRenvelope:Key>
        <IRenvelope:Key Type="PeriodStart">${escapeXml(periodStart)}</IRenvelope:Key>
        <IRenvelope:Key Type="PeriodEnd">${escapeXml(periodEnd)}</IRenvelope:Key>
      </IRenvelope:Keys>
    </IRenvelope:IRheader>

    <IRenvelope:IRbody xmlns:IRenvelope="http://www.govtalk.gov.uk/taxation/CT/3">
      <IRenvelope:CT600>
${indent(stripOuterCt600Tag(ct600Xml), 8)}
      </IRenvelope:CT600>

      <IRenvelope:Computation>
        <IRenvelope:InlineXBRL>
${indent(stripXmlPrologAndDoctype(computationsIxbrl), 10)}
        </IRenvelope:InlineXBRL>
      </IRenvelope:Computation>

      <IRenvelope:Accounts>
        <IRenvelope:InlineXBRL>
${indent(stripXmlPrologAndDoctype(accountsIxbrl), 10)}
        </IRenvelope:InlineXBRL>
      </IRenvelope:Accounts>
    </IRenvelope:IRbody>
  </Body>
</GovTalkMessage>
  `.trim();

  return xml;
}

/* Helpers */

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function indent(content, spaces) {
  const pad = " ".repeat(spaces);
  return String(content ?? "")
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}

// Remove the outer <CT600 ...>...</CT600> wrapper so it can sit inside <IRenvelope:CT600>
function stripOuterCt600Tag(xml) {
  return String(xml ?? "").replace(/<\/?CT600[^>]*>/g, "").trim();
}

// Strip XML declaration and DOCTYPE from embedded iXBRL so it’s valid inside the envelope
function stripXmlPrologAndDoctype(xml) {
  return String(xml ?? "")
    .replace(/<\?xml[^>]*>\s*/i, "")
    .replace(/<!DOCTYPE[^>]*>\s*/i, "")
    .trim();
}

function number(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}
