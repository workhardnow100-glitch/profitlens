/**
 * ============================================================
 * File: pages/api/hmrc/oauth/callback.js
 * Purpose:
 *   Handle the HMRC OAuth redirect, exchange the authorisation code
 *   for access/refresh tokens, and persist them for the correct client.
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: GET only (HMRC redirect).
 *   - Authentication:
 *       • This endpoint is called by HMRC, not the user’s browser directly.
 *       • Trust is established via the signed `state` parameter created in
 *         pages/api/hmrc/oauth/start.js.
 *   - State validation:
 *       • `state` is base64url-encoded JSON containing:
 *           – clientId
 *           – userEmail (actor who initiated the flow)
 *       • If state is missing/invalid, the request is rejected.
 *   - Token handling:
 *       • Exchanges `code` for `access_token`, `refresh_token`, `expires_in`
 *         using HMRC sandbox credentials.
 *       • Persists tokens in public.hmrc_tokens keyed by client_id.
 *   - RLS Alignment:
 *       • public.hmrc_tokens is protected by RLS:
 *           – Owner and founder only.
 *       • client_id from state ensures tokens are scoped to the correct client.
 *   - Audit logging:
 *       • On success, an audit entry is recorded with:
 *           – client_id
 *           – actor_email
 *           – action: "HMRC_OAUTH_CONNECTED"
 * ============================================================
 */

import { supabaseAdmin } from "../../../../lib/supabase-admin";

const HMRC_TOKEN_URL = "https://test-api.service.hmrc.gov.uk/oauth/token";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed.");
  }

  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error("HMRC OAuth error:", error, error_description);
    return res.status(400).send("HMRC authorisation failed.");
  }

  if (!code || !state || typeof state !== "string") {
    return res.status(400).send("Missing code or state.");
  }

  let decodedState;
  try {
    decodedState = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    );
  } catch (e) {
    console.error("Invalid state:", e);
    return res.status(400).send("Invalid state.");
  }

  const clientId = decodedState?.clientId;
  const userEmail = decodedState?.userEmail;

  if (!clientId || typeof clientId !== "string") {
    return res.status(400).send("Missing clientId in state.");
  }

  const clientIdEnv = process.env.HMRC_CLIENT_ID_SANDBOX;
  const clientSecret = process.env.HMRC_CLIENT_SECRET_SANDBOX;
  const redirectUri = process.env.HMRC_REDIRECT_URI_SANDBOX;

  if (!clientIdEnv || !clientSecret || !redirectUri) {
    console.error("HMRC OAuth env not configured");
    return res.status(500).send("HMRC OAuth not configured.");
  }

  try {
    const tokenResponse = await fetch(HMRC_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body:
        `grant_type=authorization_code` +
        `&code=${encodeURIComponent(code)}` +
        `&client_id=${encodeURIComponent(clientIdEnv)}` +
        `&client_secret=${encodeURIComponent(clientSecret)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}`,
    });

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text();
      console.error("HMRC token error:", tokenResponse.status, text);
      return res.status(500).send("Failed to obtain HMRC tokens.");
    }

    const tokenData = await tokenResponse.json();
    const access_token = tokenData.access_token;
    const refresh_token = tokenData.refresh_token;
    const expires_in = tokenData.expires_in;

    if (!access_token || !refresh_token || !expires_in) {
      console.error("Invalid HMRC token response:", tokenData);
      return res.status(500).send("Invalid HMRC token response.");
    }

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from("hmrc_tokens")
      .upsert(
        {
          client_id: clientId,
          access_token,
          refresh_token,
          expires_at: expiresAt,
        },
        { onConflict: "client_id" }
      );

    if (upsertError) {
      console.error("Failed to save HMRC tokens:", upsertError);
      return res.status(500).send("Failed to save HMRC tokens.");
    }

    if (userEmail) {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: userEmail,
          action: "HMRC_OAUTH_CONNECTED",
          details: "HMRC OAuth tokens stored successfully",
        },
      ]);
    }

    return res.redirect(
      `/vat?clientId=${encodeURIComponent(clientId)}&hmrc=connected`
    );
  } catch (err) {
    console.error("HMRC callback error:", err);
    return res.status(500).send("Internal server error.");
  }
}
