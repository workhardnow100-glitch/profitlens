// pages/api/hmrc/oauth/callback.js
import { supabaseAdmin } from "../../../../lib/supabase-admin";

const HMRC_TOKEN_URL = "https://test-api.service.hmrc.gov.uk/oauth/token";
const HMRC_USERINFO_URL = "https://test-api.service.hmrc.gov.uk/oauth/token/userinfo";

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error("HMRC OAuth error:", error, error_description);
    return res.status(400).send("HMRC authorisation failed.");
  }

  if (!code || !state) {
    return res.status(400).send("Missing code or state.");
  }

  let decodedState;
  try {
    decodedState = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch (e) {
    console.error("Invalid state:", e);
    return res.status(400).send("Invalid state.");
  }

  const { clientId } = decodedState;
  if (!clientId) {
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
    // 1️⃣ Exchange code for tokens
    const tokenResponse = await fetch(HMRC_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!access_token || !refresh_token || !expires_in) {
      console.error("Invalid HMRC token response:", tokenData);
      return res.status(500).send("Invalid HMRC token response.");
    }

    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // 2️⃣ Fetch VRN from HMRC userinfo endpoint
    const userinfoRes = await fetch(HMRC_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!userinfoRes.ok) {
      const text = await userinfoRes.text();
      console.error("Failed to fetch HMRC VRN:", text);
      return res.status(500).send("Failed to fetch HMRC VRN.");
    }

    const userinfo = await userinfoRes.json();
    const vrn = userinfo.vrn;

    if (!vrn) {
      console.error("No VRN returned from HMRC userinfo:", userinfo);
      return res.status(500).send("No VRN returned from HMRC.");
    }

    // 3️⃣ Save tokens + VRN
    const { error: upsertError } = await supabaseAdmin
      .from("hmrc_tokens")
      .upsert(
        {
          client_id: clientId,
          access_token,
          refresh_token,
          expires_at: expiresAt,
          vrn,
        },
        { onConflict: "client_id" }
      );

    if (upsertError) {
      console.error("Failed to save HMRC tokens:", upsertError);
      return res.status(500).send("Failed to save HMRC tokens.");
    }

    // 4️⃣ Redirect back to VAT page
    return res.redirect(`/vat?clientId=${clientId}&hmrc=connected`);

  } catch (err) {
    console.error("HMRC callback error:", err);
    return res.status(500).send("Internal server error.");
  }
}
