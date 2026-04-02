/**
 * CT600 XML Builder
 * -----------------
 * PURPOSE:
 *   Builds the full HMRC CT600 v3 XML document for a single accounting period,
 *   using the same CtComputations object that powers the CT600 PDF and CT
 *   computations iXBRL.
 *
 * CALLED BY:
 *   pages/api/forms/generate-pack.js
 *
 * INPUT:
 *   - companyNumber
 *   - companyName
 *   - periodStart
 *   - periodEnd
 *   - computations: CtComputations
 *   - utr
 *   - companyType
 *   - declaration
 *   - accountant
 *   - submission
 *
 * OUTPUT:
 *   - A CT600 v3 XML string
 */

/**
 * HMRC SUBMISSION ENVELOPE (GovTalkMessage)
 * -----------------------------------------
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
  } = input;

  const xml = `
<?xml version="1.0" encoding="UTF-8"?>
<GovTalkMessage
  xmlns="http://www.govtalk.gov.uk/CM/envelope"
  xmlns:gt="http://www.govtalk.gov.uk/CM/envelope"
>
  <EnvelopeVersion>2.0</EnvelopeVersion>

  <Header>
    <MessageDetails>
      <Class>HMRC-CT600</Class>
      <Qualifier>request</Qualifier>
      <Function>submit</Function>
      <TransactionID>${escapeXml(correlationId)}</TransactionID>
      <CorrelationID>${escapeXml(correlationId)}</CorrelationID>
      <GatewayTest>1</GatewayTest>
    </MessageDetails>

    <SenderDetails>
      <ID>${escapeXml(senderId)}</ID>
      <Authentication>
        <Method>clear</Method>
        <Value>${escapeXml(password)}</Value>
      </Authentication>
    </SenderDetails>
  </Header>

  <GovTalkDetails>
    <Keys>
      <!-- HMRC expect UTR as the primary key -->
      <Key Type="UTR">${escapeXml(companyNumber)}</Key>
    </Keys>
  </GovTalkDetails>

  <Body>
    <IRenvelope:IRheader
      xmlns:IRenvelope="http://www.govtalk.gov.uk/taxation/CT/3"
    >
      <IRenvelope:Keys>
        <IRenvelope:Key Type="CompanyName">${escapeXml(companyName)}</IRenvelope:Key>
        <IRenvelope:Key Type="PeriodStart">${escapeXml(periodStart)}</IRenvelope:Key>
        <IRenvelope:Key Type="PeriodEnd">${escapeXml(periodEnd)}</IRenvelope:Key>
      </IRenvelope:Keys>
    </IRenvelope:IRheader>

    <IRenvelope:IRbody
      xmlns:IRenvelope="http://www.govtalk.gov.uk/taxation/CT/3"
    >
      <!-- CT600 core XML (without outer <CT600> wrapper) -->
      <IRenvelope:CT600>
${indent(stripOuterCt600Tag(ct600Xml), 8)}
      </IRenvelope:CT600>

      <!-- Computations iXBRL -->
      <IRenvelope:Computation>
        <IRenvelope:InlineXBRL>
${indent(computationsIxbrl, 10)}
        </IRenvelope:InlineXBRL>
      </IRenvelope:Computation>

      <!-- Accounts iXBRL -->
      <IRenvelope:Accounts>
        <IRenvelope:InlineXBRL>
${indent(accountsIxbrl, 10)}
        </IRenvelope:InlineXBRL>
      </IRenvelope:Accounts>
    </IRenvelope:IRbody>
  </Body>
</GovTalkMessage>
  `.trim();

  return xml;
}

/* -------------------------------------------------------------------------- */
/*                                   HELPERS                                  */
/* -------------------------------------------------------------------------- */

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
  return content
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}

// Remove the outer <CT600 ...>...</CT600> wrapper so it can sit inside <IRenvelope:CT600>
function stripOuterCt600Tag(xml) {
  return xml.replace(/<\/?CT600[^>]*>/g, "").trim();
}
