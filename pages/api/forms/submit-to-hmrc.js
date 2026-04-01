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

    // Path to submission envelope
    const submissionPath = `hmrc/CT600_SUBMISSION_${clientId}_${periodEnd}.xml`;

    // Download envelope
    const submissionFile = await supabaseAdmin.storage
      .from("pdfs")
      .download(submissionPath);

    if (!submissionFile.data) {
      return res.status(500).json({
        success: false,
        message: "Submission envelope not found.",
      });
    }

    const envelopeXml = await submissionFile.data.text();

    // Send to HMRC gateway
    const response = await sendToHmrcGateway({
      xml: envelopeXml,
      environment, // "test" or "live"
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
