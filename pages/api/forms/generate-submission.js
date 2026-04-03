// FORCE-REBUILD-V6

import { supabaseAdmin } from "../../../lib/supabase-admin";
import { buildHmrcSubmissionEnvelope } from "../../../lib/ct/submissionEnvelope";

export default async function handler(req, res) {
  try {
    console.log("🟦 [SUBMISSION] Handler invoked");

    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const { clientId, periodStart, periodEnd } = req.body || {};

    console.log("🟩 Incoming BODY:", req.body);

    if (!clientId || !periodEnd) {
      console.log("🟥 Missing required fields:", { clientId, periodStart, periodEnd });
      return res.status(400).json({
        success: false,
        message: "Missing clientId or periodEnd.",
      });
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ success: false, message: "Client not found." });
    }

    const safePeriodStart =
      periodStart ||
      client.periodStart ||
      client.accounting_period_start ||
      periodEnd;

    const ct600XmlPath = `xml/CT600_${clientId}_${periodEnd}.xml`;
    const computationsPath = `ixbrl/CT_COMPUTATIONS_${clientId}_${periodEnd}.xhtml`;

    const { data: list } = await supabaseAdmin.storage
      .from("pdfs")
      .list("ixbrl");

    const accountsFileName = list?.find(f =>
      f.name.includes(`${clientId}_${periodEnd}`) &&
      f.name.startsWith("ACCOUNTS_")
    )?.name;

    if (!accountsFileName) {
      return res.status(500).json({ success: false, message: "Accounts iXBRL file not found." });
    }

    const accountsPath = `ixbrl/${accountsFileName}`;

    const [ct600XmlFile, computationsFile, accountsFile] = await Promise.all([
      supabaseAdmin.storage.from("pdfs").download(ct600XmlPath),
      supabaseAdmin.storage.from("pdfs").download(computationsPath),
      supabaseAdmin.storage.from("pdfs").download(accountsPath),
    ]);

    if (!ct600XmlFile.data || !computationsFile.data || !accountsFile.data) {
      return res.status(500).json({ success: false, message: "Missing one or more CT artefacts." });
    }

    const ct600Xml = await ct600XmlFile.data.text();
    const computationsIxbrl = await computationsFile.data.text();
    const accountsIxbrl = await accountsFile.data.text();

    const envelopeInput = {
      correlationId: `corr-${clientId}-${periodEnd}`,
      senderId: "YOUR_SENDER_ID",
      password: "YOUR_PASSWORD",
      client,
      companyNumber: client.companyNumber || client.company_number || "",
      companyName: client.business_name || client.name,
      periodStart: safePeriodStart,
      periodEnd,
      ct600Xml,
      computationsIxbrl,
      accountsIxbrl,
    };

    let envelope;
    try {
      envelope = buildHmrcSubmissionEnvelope(envelopeInput);
    } catch (err) {
      console.log("🟥 Envelope builder crashed:", err);
      return res.status(500).json({ success: false, message: "Envelope builder crashed." });
    }

    const submissionPath = `hmrc/CT600_SUBMISSION_${clientId}_${periodEnd}.xml`;
    const envelopeBlob = new Blob([envelope], { type: "application/xml" });

    const { error: uploadError } = await supabaseAdmin.storage
      .from("pdfs")
      .upload(submissionPath, envelopeBlob, {
        contentType: "application/xml",
        upsert: true,
      });

    if (uploadError) {
      return res.status(500).json({ success: false, message: "Failed to upload submission envelope." });
    }

    return res.status(200).json({ success: true, submissionPath });
  } catch (err) {
    console.log("🟥 TOP-LEVEL ERROR:", err);
    return res.status(500).json({ success: false, message: "Internal server error generating submission envelope." });
  }
}
