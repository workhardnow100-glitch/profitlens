// pages/api/forms/generate-submission.js

// FORCE-REBUILD-V5

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

    // Load client from Supabase
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    console.log("🟩 Loaded client:", client);

    if (clientError || !client) {
      console.log("🟥 Client not found in Supabase:", clientError);
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    // Derive safe periodStart
    const safePeriodStart =
      periodStart ||
      client.periodStart ||
      client.accounting_period_start ||
      periodEnd;

    console.log("🟩 Derived safePeriodStart:", safePeriodStart);

    // Paths for CT600 and Computations
    const ct600XmlPath = `xml/CT600_${clientId}_${periodEnd}.xml`;
    const computationsPath = `ixbrl/CT_COMPUTATIONS_${clientId}_${periodEnd}.xhtml`;

    // 🔥 Dynamically detect the correct accounts file
    const { data: list } = await supabaseAdmin.storage
      .from("pdfs")
      .list("ixbrl");

    const accountsFileName = list?.find(f =>
      f.name.includes(`${clientId}_${periodEnd}`) &&
      f.name.startsWith("ACCOUNTS_")
    )?.name;

    if (!accountsFileName) {
      console.log("🟥 No accounts iXBRL found for this client/period");
      return res.status(500).json({
        success: false,
        message: "Accounts iXBRL file not found.",
      });
    }

    const accountsPath = `ixbrl/${accountsFileName}`;
    console.log("🟩 Using accounts file:", accountsPath);

    console.log("🟩 Artefact paths:", {
      ct600XmlPath,
      computationsPath,
      accountsPath,
    });

    // Download artefacts
    const [ct600XmlFile, computationsFile, accountsFile] = await Promise.all([
      supabaseAdmin.storage.from("pdfs").download(ct600XmlPath),
      supabaseAdmin.storage.from("pdfs").download(computationsPath),
      supabaseAdmin.storage.from("pdfs").download(accountsPath),
    ]);

    console.log("🟩 Artefact existence:", {
      ct600XmlExists: !!ct600XmlFile.data,
      computationsExists: !!computationsFile.data,
      accountsExists: !!accountsFile.data,
    });

    if (!ct600XmlFile.data || !computationsFile.data || !accountsFile.data) {
      console.log("🟥 Missing artefacts");
      return res.status(500).json({
        success: false,
        message: "Missing one or more CT artefacts.",
      });
    }

    const ct600Xml = await ct600XmlFile.data.text();
    const computationsIxbrl = await computationsFile.data.text();
    const accountsIxbrl = await accountsFile.data.text();

    console.log("🟩 XML lengths:", {
      ct600Xml: ct600Xml.length,
      computationsIxbrl: computationsIxbrl.length,
      accountsIxbrl: accountsIxbrl.length,
    });

    // Build envelope
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

    console.log("🟦 Envelope Input Object:", envelopeInput);

    let envelope;
    try {
      envelope = buildHmrcSubmissionEnvelope(envelopeInput);
    } catch (err) {
      console.log("🟥 Envelope builder crashed with:", err);
      console.log("🟥 Envelope builder stack:", err.stack);
      return res.status(500).json({
        success: false,
        message: "Envelope builder crashed. Check logs.",
      });
    }

    console.log("🟩 Envelope built successfully. Length:", envelope.length);

    // Upload final submission XML
    const submissionPath = `hmrc/CT600_SUBMISSION_${clientId}_${periodEnd}.xml`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("pdfs")
      .upload(submissionPath, envelope, {
        contentType: "application/xml",
        upsert: true,
      });

    if (uploadError) {
      console.log("🟥 Upload error:", uploadError);
      return res.status(500).json({
        success: false,
        message: "Failed to upload submission envelope.",
      });
    }

    console.log("🟩 Submission uploaded:", submissionPath);

    return res.status(200).json({
      success: true,
      submissionPath,
    });

  } catch (err) {
    console.log("🟥 TOP-LEVEL ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error generating submission envelope.",
    });
  }
}
