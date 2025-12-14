// pages/api/hmrc/callback.js
import fetch from "node-fetch";
import { supabase } from "../../../lib/supabase";

export default async function handler(req, res) {
  const { code, state } = req.query;
  const clientId = process.env.HMRC_CLIENT_ID;
  const clientSecret = process.env.HMRC_CLIENT_SECRET;
  const redirectUri = process.env.HMRC_REDIRECT_URI;

  const tokenRes = await fetch("https://test-api.service.hmrc.gov.uk/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret
    })
  });

  const tokenData = await tokenRes.json();

  // Save to database
  await supabase.from("hmrc_tokens").insert({
    client_id: state, // client ID passed in state parameter
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: new Date(Date.now() + tokenData.expires_in * 1000)
  });

  res.send("HMRC authorization successful!");
}
