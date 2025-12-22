// lib/mtd-client.js
import { supabaseAdmin } from "./supabase-admin";

const HMRC_BASE_URL = process.env.HMRC_BASE_URL || "https://test-api.service.hmrc.gov.uk";
const CLIENT_ID = process.env.HMRC_CLIENT_ID_SANDBOX;
const CLIENT_SECRET = process.env.HMRC_CLIENT_SECRET_SANDBOX;

async function getValidAccessToken(clientId) {
  const { data: tokenRow, error } = await supabaseAdmin
    .from("hmrc_tokens")
    .select("*")
    .eq("client_id", clientId)
    .single();

  if (error || !tokenRow) {
    throw new Error("No HMRC tokens found for this client");
  }

  const now = Date.now();
  const expiresAt = new Date(tokenRow.expires_at).getTime();

  // Token still valid?
  if (expiresAt - now > 60 * 1000) {
    return tokenRow.access_token;
  }

  // Refresh token
  const resp = await fetch(`${HMRC_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      `grant_type=refresh_token` +
      `&refresh_token=${encodeURIComponent(tokenRow.refresh_token)}` +
      `&client_id=${encodeURIComponent(CLIENT_ID)}` +
      `&client_secret=${encodeURIComponent(CLIENT_SECRET)}`
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("HMRC token refresh failed:", text);
    throw new Error("Failed to refresh HMRC token");
  }

  const json = await resp.json();

  const newExpiresAt = new Date(Date.now() + json.expires_in * 1000).toISOString();

  await supabaseAdmin
    .from("hmrc_tokens")
    .update({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: newExpiresAt
    })
    .eq("id", tokenRow.id);

  return json.access_token;
}

export async function createClient(clientId) {
  return {
    async getObligations() {
      const accessToken = await getValidAccessToken(clientId);

      const { data: client } = await supabaseAdmin
        .from("clients")
        .select("vat_number")
        .eq("id", clientId)
        .single();

      if (!client?.vat_number) {
        throw new Error("Client VAT number missing");
      }

      const vrn = client.vat_number;

      const resp = await fetch(
        `${HMRC_BASE_URL}/organisations/vat/${vrn}/obligations`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.hmrc.1.0+json"
          }
        }
      );

      const text = await resp.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }

      if (!resp.ok) {
        console.error("HMRC obligations error:", json);
        throw new Error("Failed to fetch HMRC obligations");
      }

      return json;
    }
  };
}
