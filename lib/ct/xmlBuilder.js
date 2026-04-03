export function buildCt600Xml(input) {
  // ... your existing buildCt600Xml function remains unchanged ...
  return xml;
}

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

  return `
<?xml version="1.0" encoding="UTF-8"?>
<GovTalkMessage xmlns="http://www.govtalk.gov.uk/CM/envelope">
  <EnvelopeVersion>2.0</EnvelopeVersion>

  <Header>
    <MessageDetails>
      <Class>CT600</Class>
      <Qualifier>request</Qualifier>
      <Function>submit</Function>
      <TransactionID>${correlationId}</TransactionID>
      <CorrelationID>${correlationId}</CorrelationID>
      <GatewayTest>1</GatewayTest>
    </MessageDetails>

    <SenderDetails>
      <ID>${senderId}</ID>
      <Authentication>
        <Method>clear</Method>
        <Value>${password}</Value>
      </Authentication>
    </SenderDetails>
  </Header>

  <GovTalkDetails>
    <Keys>
      <Key Type="UTR">${companyNumber}</Key>
    </Keys>
  </GovTalkDetails>

  <Body>
    <IRenvelope:IRheader xmlns:IRenvelope="http://www.govtalk.gov.uk/taxation/CT/3">
      <IRenvelope:Keys>
        <IRenvelope:Key Type="CompanyName">${escapeXml(companyName)}</IRenvelope:Key>
        <IRenvelope:Key Type="PeriodStart">${periodStart}</IRenvelope:Key>
        <IRenvelope:Key Type="PeriodEnd">${periodEnd}</IRenvelope:Key>
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

function stripOuterCt600Tag(xml) {
  return String(xml ?? "").replace(/<\/?CT600[^>]*>/g, "").trim();
}

function stripXmlPrologAndDoctype(xml) {
  return String(xml ?? "")
    .replace(/<\?xml[^>]*>\s*/i, "")
    .replace(/<!DOCTYPE[^>]*>\s*/i, "")
    .trim();
}
