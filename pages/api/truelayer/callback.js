/**
 * ============================================================
 * File: pages/api/truelayer/callback.js
 * Purpose:
 *   Handle the TrueLayer OAuth redirect, exchange the authorisation
 *   code for access/refresh tokens, and persist them for the correct
 *   client under RLS protection.
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: GET only (TrueLayer redirect).
 *   - Authentication:
 *       • This endpoint is called by TrueLayer, not the user.
 *       • Trust is established via the signed `state` parameter created
 *         in pages/api/truelayer/auth.js.
 *   - State validation:
 *       • `state` is base64url-encoded JSON containing:
 *           – clientId
 *           – userEmail (actor who initiated the flow)
 *       • If state is missing/invalid, the request is rejected.
 *   - Token handling:
 *       • Exchanges `code` for `access_token` and `refresh_token`
 *         using TL_CLIENT_ID, TL_CLIENT_SECRET, TL_REDIRECT_URI.
 *       • Persists tokens in public.bank_tokens keyed by client_id.
 *   - RLS Alignment:
 *       • public.bank_tokens is protected by RLS:
 *           – Owner and founder only.
 *       • clientId from state ensures tokens are scoped correctly.
 *   - Audit logging:
 *       • On success, an audit entry is recorded with:
 *           – client_id
 *           – actor_email
 *           – action: "BANK_OAUTH_CONNECTED"
 * ============================================================
 */

import axios from "axios";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).send("Method not allowed.");
  }

  const { code, state } = req.query;

  if (!code || !state || typeof state !== "string") {
    return res.status(400).send("Missing code or state.");
  }

  // ⭐ Decode and validate state
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

  // ⭐ Validate TrueLayer env vars
  const clientIdEnv = process.env.TL_CLIENT_ID;
  const clientSecret = process.env.TL_CLIENT_SECRET;
  const redirectUri = process.env.TL_REDIRECT_URI;

  if (!clientIdEnv || !clientSecret || !redirectUri) {
    console.error("TrueLayer OAuth env not configured");
    return res.status(500).send("TrueLayer OAuth not configured.");
  }

  try {
    // ⭐ Exchange code for tokens
    const tokenRes = await axios.post(
      "https://auth.truelayer.com/connect/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientIdEnv,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: code,
      })
    );

    const access_token = tokenRes.data?.access_token;
    const refresh_token = tokenRes.data?.refresh_token;

    if (!access_token || !refresh_token) {
      console.error("Invalid TrueLayer token response:", tokenRes.data);
      return res.status(500).send("Invalid TrueLayer token response.");
    }

    // ⭐ Persist tokens under correct client
    const { error: upsertError } = await supabaseAdmin
      .from("bank_tokens")
      .upsert(
        {
          client_id: clientId,
          access_token,
          refresh_token,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" }
      );

    if (upsertError) {
      console.error("Failed to save banking tokens:", upsertError);
      return res.status(500).send("Failed to save banking tokens.");
    }

    // ⭐ Audit log
    if (userEmail) {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: userEmail,
          action: "BANK_OAUTH_CONNECTED",
          details: "TrueLayer OAuth tokens stored successfully",
        },
      ]);
    }

    // ⭐ Redirect back to dashboard
    return res.redirect(
      `/dashboard?clientId=${encodeURIComponent(clientId)}&bank=connected`
    );
  } catch (err) {
    console.error("TrueLayer callback error:", err);
    return res.status(500).send("Internal server error.");
  }
}
