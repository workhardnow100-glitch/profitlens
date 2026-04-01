// pages/api/forms/submit-to-hmrc.js

import { supabaseAdmin } from "../../../lib/supabase-admin";
import { sendToHmrcGateway } from "../../../lib/ct/gatewayClient";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  try {
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
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found.",
      });
    }

    // Paths to artefacts
    const ct600XmlPath = `xml/CT600_${clientId}_${periodEnd}.xml`;
    const computationsPath = `ixbrl/CT_COMPUTATIONS_${clientId}_${periodEnd}.xhtml`;

    // FIX: detect accounts file dynamically
    const { data: list } = await supabaseAdmin.storage
      .from("pdfs")
      .list("ixbrl", { search: `ACCOUNTS_` });

    const accountsFileName = list?.find(f =>
      f.name.includes(`${clientId}_${periodEnd}`)
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

    const envelopeXml = await ct600XmlFile.data.text();
    const computationsIxbrl = await computationsFile.data.text();
    const accountsIxbrl = await accountsFile.data.text();

    // Send to HMRC gateway
    const response = await sendToHmrcGateway({
      xml: envelopeXml,
      environment,
    });

    // Store HMRC response
    const responsePath = `hmrc/CT600_RESPONSE_${clientId}_${periodEnd}.xml`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("pdfs")
      .upload(responsePath, response.body, {
        contentType: "application/xml",
        upsert: true,
      });

    if (uploadError) {
      console.error("Failed to upload HMRC response:", uploadError);
    }

    return res.status(200).json({
      success: true,
      environment,
      statusCode: response.statusCode,
      hmrcResponsePath: responsePath,
    });

  } catch (err) {
    console.error("HMRC submission failed:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error submitting to HMRC.",
    });
  }
}
