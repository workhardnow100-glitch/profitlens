// pages/api/forms/generate-submission.js

import { supabaseAdmin } from "../../../lib/supabase-admin";
import { buildHmrcSubmissionEnvelope } from "../../../lib/ct/submissionEnvelope";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res
        .status(405)
        .json({ success: false, message: "Method not allowed" });
    }

    // FIX 1: include periodStart
    const { clientId, periodStart, periodEnd } = req.body;

    if (!clientId || !periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: "Missing clientId, periodStart, or periodEnd.",
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

    // Paths for artefacts
    const ct600XmlPath = `xml/CT600_${clientId}_${periodEnd}.xml`;
    const computationsPath = `ixbrl/CT_COMPUTATIONS_${clientId}_${periodEnd}.xhtml`;
    const accountsPath = `ixbrl/ACCOUNTS_FRS102-1A_${clientId}_${periodEnd}.xhtml`;

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

    // Build envelope
    const envelope = buildHmrcSubmissionEnvelope({
      correlationId: `corr-${clientId}-${periodEnd}`,
      senderId: "YOUR_SENDER_ID",
      password: "YOUR_PASSWORD",

      // FIX 2: pass full client object
      client,

      companyNumber: client.companyNumber || client.company_number || "",
      companyName: client.business_name || client.name,

      // FIX 3: use periodStart from request, not client.periodStart
      periodStart,
      periodEnd,

      ct600Xml,
      computationsIxbrl,
      accountsIxbrl,
    });

    // Upload final submission XML
    const submissionPath = `hmrc/CT600_SUBMISSION_${clientId}_${periodEnd}.xml`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("pdfs")
      .upload(submissionPath, envelope, {
        contentType: "application/xml",
        upsert: true,
      });

    if (uploadError) {
      console.error("Failed to upload submission envelope:", uploadError);
      return res.status(500).json({
        success: false,
        message: "Failed to upload submission envelope.",
      });
    }

    return res.status(200).json({
      success: true,
      submissionPath,
    });

  } catch (err) {
    console.error("Submission envelope generation failed:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error generating submission envelope.",
    });
  }
}
