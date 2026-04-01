// pages/api/forms/submit-to-hmrc.js

import { supabaseAdmin } from "../../../lib/supabase-admin";
import { sendToHmrcGateway } from "../../../lib/ct/gatewayClient";

export default async function handler(req, res) {
  try {
    console.log("🟦 [HMRC] submit-to-hmrc invoked");
    console.log("🟦 [HMRC] Incoming BODY:", req.body);

    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const { clientId, periodEnd, environment = "test" } = req.body;

    if (!clientId || !periodEnd) {
      console.log("🟥 [HMRC] Missing required fields:", { clientId, periodEnd });
      return res.status(400).json({
        success: false,
        message: "Missing clientId or periodEnd.",
      });
    }

    // Load client from Supabase
    console.log("🟦 [HMRC] Loading client:", clientId);
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    console.log("🟩 [HMRC] Loaded client:", client);

    if (clientError || !client) {
      console.log("🟥 [HMRC] Client not found in Supabase:", clientError);
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    // Paths to CT600 and Computations
    const ct600XmlPath = `xml/CT600_${clientId}_${periodEnd}.xml`;
    const computationsPath = `ixbrl/CT_COMPUTATIONS_${clientId}_${periodEnd}.xhtml`;

    console.log("🟦 [HMRC] Artefact paths:", {
      ct600XmlPath,
      computationsPath,
    });

    // 🔥 Dynamically detect the correct accounts file
    const { data: list } = await supabaseAdmin.storage
      .from("pdfs")
      .list("ixbrl");

    const accountsFileName = list?.find(f =>
      f.name.includes(`${clientId}_${periodEnd}`) &&
      f.name.startsWith("ACCOUNTS_")
    )?.name;

    if (!accountsFileName) {
      console.log("🟥 [HMRC] No accounts iXBRL found");
      return res.status(500).json({
        success: false,
        message: "Accounts iXBRL file not found.",
      });
    }

    const accountsPath = `ixbrl/${accountsFileName}`;
    console.log("🟩 [HMRC] Using accounts file:", accountsPath);

    // Download artefacts
    console.log("🟦 [HMRC] Downloading artefacts…");
    const [ct600XmlFile, computationsFile, accountsFile] = await Promise.all([
      supabaseAdmin.storage.from("pdfs").download(ct600XmlPath),
      supabaseAdmin.storage.from("pdfs").download(computationsPath),
      supabaseAdmin.storage.from("pdfs").download(accountsPath),
    ]);

    console.log("🟩 [HMRC] Artefact existence:", {
      ct600XmlExists: !!ct600XmlFile.data,
      computationsExists: !!computationsFile.data,
      accountsExists: !!accountsFile.data,
    });

    if (!ct600XmlFile.data || !computationsFile.data || !accountsFile.data) {
      console.log("🟥 [HMRC] Missing artefacts");
      return res.status(500).json({
        success: false,
        message: "Missing one or more CT artefacts.",
      });
    }

    const envelopeXml = await ct600XmlFile.data.text();
    const computationsIxbrl = await computationsFile.data.text();
    const accountsIxbrl = await accountsFile.data.text();

    console.log("🟩 [HMRC] Artefact sizes:", {
      envelopeXml: envelopeXml.length,
      computationsIxbrl: computationsIxbrl.length,
      accountsIxbrl: accountsIxbrl.length,
    });

    // Send to HMRC gateway
    console.log("🟦 [HMRC] Sending to HMRC gateway:", environment);
    const response = await sendToHmrcGateway({
      xml: envelopeXml,
      environment,
    });

    console.log("🟩 [HMRC] Gateway response:", {
      statusCode: response.statusCode,
      bodyLength: response.body?.length,
    });

    // Store HMRC response
    const responsePath = `hmrc/CT600_RESPONSE_${clientId}_${periodEnd}.xml`;

    console.log("🟦 [HMRC] Uploading HMRC response to:", responsePath);

    const { error: uploadError } = await supabaseAdmin.storage
      .from("pdfs")
      .upload(responsePath, response.body, {
        contentType: "application/xml",
        upsert: true,
      });

    if (uploadError) {
      console.log("🟥 [HMRC] Upload error:", uploadError);
    } else {
      console.log("🟩 [HMRC] Response uploaded successfully");
    }

    return res.status(200).json({
      success: true,
      environment,
      statusCode: response.statusCode,
      hmrcResponsePath: responsePath,
    });

  } catch (err) {
    console.log("🟥 [HMRC] TOP-LEVEL ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error submitting to HMRC.",
    });
  }
}
