// pages/api/mtd/vat/submit.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

const HMRC_BASE_URL = "https://test-api.service.hmrc.gov.uk";

async function getValidAccessToken(clientId) {
  const clientIdEnv = process.env.HMRC_CLIENT_ID_SANDBOX;
  const clientSecret = process.env.HMRC_CLIENT_SECRET_SANDBOX;

  if (!clientIdEnv || !clientSecret) {
    throw new Error("HMRC OAuth not configured");
  }

  const { data: tokenRow, error: tokenError } = await supabaseAdmin
    .from("hmrc_tokens")
    .select("id, access_token, refresh_token, expires_at")
    .eq("client_id", clientId)
    .single();

  if (tokenError || !tokenRow) {
    throw new Error("No HMRC tokens found for this client");
  }

  const now = new Date();
  const expiresAt = new Date(tokenRow.expires_at);

  if (expiresAt.getTime() - now.getTime() > 60 * 1000) {
    return tokenRow.access_token;
  }

  // Refresh token
  const tokenResponse = await fetch(`${HMRC_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      `grant_type=refresh_token` +
      `&refresh_token=${encodeURIComponent(tokenRow.refresh_token)}` +
      `&client_id=${encodeURIComponent(clientIdEnv)}` +
      `&client_secret=${encodeURIComponent(clientSecret)}`,
  });

  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    console.error("HMRC refresh error:", tokenResponse.status, text);
    throw new Error("Failed to refresh HMRC token");
  }

  const tokenData = await tokenResponse.json();
  const { access_token, refresh_token, expires_in } = tokenData;

  const newExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  await supabaseAdmin
    .from("hmrc_tokens")
    .update({
      access_token,
      refresh_token,
      expires_at: newExpiresAt,
    })
    .eq("id", tokenRow.id);

  return access_token;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { submissionId } = req.body || {};
  if (!submissionId) {
    return res.status(400).json({ error: "Missing submissionId" });
  }

  try {
    // 1. Fetch validated submission
    const { data: submission, error: submissionError } = await supabaseAdmin
      .from("vat_mtd_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (submissionError || !submission) {
      return res.status(404).json({ error: "Submission not found" });
    }

    if (submission.status !== "validated") {
      return res
        .status(400)
        .json({ error: "Submission must be in 'validated' state" });
    }

    const clientId = submission.client_id;

    // Accountant-aware access
    const actingClientId =
      session.user.actingAsClientId || session.user.clientId;
    const isFounder = session.user.role === "admin";

    if (!isFounder && actingClientId !== clientId) {
      return res
        .status(403)
        .json({ error: "You are not allowed to submit VAT for this client" });
    }

    // 2. Fetch client VAT number
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, name, vat_number")
      .eq("id", clientId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (!client.vat_number) {
      return res
        .status(400)
        .json({ error: "Client does not have a VAT number" });
    }

    const vrn = client.vat_number;

    // 3. Get valid HMRC access token
    const accessToken = await getValidAccessToken(clientId);

    // 4. Build HMRC VAT payload using REAL periodKey
    const outputVat = Number(submission.output_vat || 0);
    const inputVat = Number(submission.input_vat || 0);
    const netVat = Number(submission.net_vat || 0);

    // 🔥 REAL HMRC periodKey from validate.js
    const periodKey = submission.period_key;
    if (!periodKey) {
      return res.status(400).json({
        error:
          "Missing periodKey. Validate the VAT return again to fetch HMRC obligations.",
      });
    }

    const payload = {
      periodKey, // 🔥 REAL HMRC PERIOD KEY
      vatDueSales: outputVat.toFixed(2),
      vatDueAcquisitions: "0.00",
      totalVatDue: outputVat.toFixed(2),
      vatReclaimedCurrPeriod: inputVat.toFixed(2),
      netVatDue: netVat.toFixed(2),
      totalValueSalesExVAT: 0,
      totalValuePurchasesExVAT: 0,
      totalValueGoodsSuppliedExVAT: 0,
      totalValueGoodsAcquiredExVAT: 0,
      finalised: true,
    };

    const idempotencyKey = submissionId;

    // 5. Submit to HMRC
    const response = await fetch(
      `${HMRC_BASE_URL}/organisations/vat/${encodeURIComponent(vrn)}/returns`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.hmrc.1.0+json",
          "Gov-Client-Connection-Method": "WEB_APP_VIA_SERVER",
          CorrelationId: submissionId,
          "Gov-Test-Scenario": "DEFAULT",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      }
    );

    const hmrcBodyText = await response.text();
    let hmrcBody;
    try {
      hmrcBody = JSON.parse(hmrcBodyText || "{}");
    } catch {
      hmrcBody = { raw: hmrcBodyText };
    }

    if (!response.ok) {
      await supabaseAdmin
        .from("vat_mtd_submissions")
        .update({
          status: "rejected",
          updated_at: new Date().toISOString(),
          hmrc_response: hmrcBody,
        })
        .eq("id", submissionId);

      return res.status(response.status).json({
        error: "HMRC VAT submission failed",
        hmrc: hmrcBody,
      });
    }

    const hmrcReference =
      hmrcBody.formBundleNumber || hmrcBody.chargeRefNumber || null;

    // 6. Update submission record
    await supabaseAdmin
      .from("vat_mtd_submissions")
      .update({
        status: "submitted",
        hmrc_reference: hmrcReference,
        hmrc_response: hmrcBody,
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    // 7. Lock VAT transactions
    await supabaseAdmin
      .from("transactions")
      .update({ tax_locked: true })
      .eq("client_id", clientId)
      .gte("date", submission.period_start)
      .lte("date", submission.period_end)
      .eq("hmrc_category_id", "vat");

    // 8. Audit log
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: session.user.email,
        action: "MTD_VAT_SUBMIT",
        details: `Submitted VAT return to HMRC for ${submission.period_start} → ${submission.period_end}. HMRC ref: ${hmrcReference || "N/A"}`,
      },
    ]);

    return res.status(200).json({
      success: true,
      hmrcReference,
      hmrcResponse: hmrcBody,
    });
  } catch (err) {
    console.error("MTD VAT submit error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Internal server error" });
  }
}
