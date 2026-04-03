// FORCE-REBUILD-V8-HMRC-ID-FIX

import crypto from "crypto";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { sendToHmrcGateway } from "../../../lib/ct/gatewayClient";
import { buildHmrcSubmissionEnvelope } from "../../../lib/ct/xmlBuilder";

export default async function handler(req, res) {
  try {
    console.log("🟦 [HMRC] submit-to-hmrc invoked");
    console.log("🟦 [HMRC] Incoming BODY:", req.body);

    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const { clientId, periodEnd, environment = "test" } = req.body;

    if (!clientId || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: "Missing clientId or periodEnd.",
      });
    }

    // Load client
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ success: false, message: "Client not found." });
    }

    // Paths to artefacts
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
      return res.status(500).json({
        success: false,
        message: "Accounts iXBRL file not found.",
      });
    }

    const accountsPath = `ixbrl/${accountsFileName}`;

    // Download artefacts
    const [ct600XmlFile, computationsFile, accountsFile] = await Promise.all([
      supabaseAdmin.storage.from("pdfs").download(ct600XmlPath),
      supabaseAdmin.storage.from("pdfs").download(computationsPath),
      supabaseAdmin.storage.from("pdfs").download(accountsPath),
    ]);

    if (!ct600XmlFile.data || !computationsFile.data || !accountsFile.data) {
      return res.status(500).json({
        success: false,
        message: "Missing one or more CT artefacts.",
      });
    }

    const ct600Xml = await ct600XmlFile.data.text();
    const computationsIxbrl = await computationsFile.data.text();
    const accountsIxbrl = await accountsFile.data.text();

    // ✅ HMRC‑VALID 32‑CHAR HEX ID (NO HYPHENS, UPPERCASE)
    const correlationId = crypto.randomBytes(16).toString("hex").toUpperCase();
    console.log("🟦 [HMRC] Using correlationId:", correlationId);

    // Build GovTalk envelope
    const envelopeXml = buildHmrcSubmissionEnvelope({
      correlationId,
      senderId: process.env.HMRC_SENDER_ID,
      password: process.env.HMRC_PASSWORD,
      companyNumber: client.company_number,
      companyName: client.business_name || client.name,
      periodStart: client.period_start,
      periodEnd,
      ct600Xml,
      computationsIxbrl,
      accountsIxbrl,
    });

    // Save submission XML
    const submissionPath = `hmrc/CT600_SUBMISSION_${clientId}_${periodEnd}.xml`;

    await supabaseAdmin.storage
      .from("pdfs")
      .upload(submissionPath, envelopeXml, {
        contentType: "application/xml",
        upsert: true,
      });

    // Send to HMRC
    const response = await sendToHmrcGateway({
      xml: envelopeXml,
      environment,
    });

    // Save HMRC response
    const responsePath = `hmrc/CT600_RESPONSE_${clientId}_${periodEnd}.xml`;

    await supabaseAdmin.storage
      .from("pdfs")
      .upload(responsePath, response.body, {
        contentType: "application/xml",
        upsert: true,
      });

    return res.status(200).json({
      success: true,
      environment,
      statusCode: response.statusCode,
      submissionPath,
      responsePath,
    });

  } catch (err) {
    console.log("🟥 [HMRC] TOP-LEVEL ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error submitting to HMRC.",
    });
  }
}
