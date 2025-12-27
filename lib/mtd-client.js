// lib/mtd-client.js
import { supabaseAdmin } from "./supabase-admin";

const HMRC_BASE_URL =
  process.env.HMRC_BASE_URL || "https://test-api.service.hmrc.gov.uk";

const CLIENT_ID = process.env.HMRC_CLIENT_ID_SANDBOX;
const CLIENT_SECRET = process.env.HMRC_CLIENT_SECRET_SANDBOX;

// ---------------------------------------------------------
// TOKEN REFRESH
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// MAIN CLIENT FACTORY
// ---------------------------------------------------------
export async function createClient(clientId) {
  if (!clientId) throw new Error("Missing clientId");

  // Load identifiers from clients table
  const { data: client, error } = await supabaseAdmin
    .from("clients")
    .select("vat_number, utr_number, nino, mtditsa_id")
    .eq("id", clientId)
    .single();

  if (error || !client) {
    throw new Error("Client not found");
  }

  const vrn = client.vat_number;
  const utr = client.utr_number;
  const nino = client.nino;
  const mtditid = client.mtditsa_id;

  async function hmrcGet(path) {
    const token = await getValidAccessToken(clientId);

    const resp = await fetch(`${HMRC_BASE_URL}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.hmrc.1.0+json"
      }
    });

    const text = await resp.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!resp.ok) {
      console.error("HMRC GET error:", json);
      throw new Error(json.message || "HMRC API error");
    }

    return json;
  }

  async function hmrcPost(path, body) {
    const token = await getValidAccessToken(clientId);

    const resp = await fetch(`${HMRC_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.hmrc.1.0+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const text = await resp.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!resp.ok) {
      console.error("HMRC POST error:", json);
      throw new Error(json.message || "HMRC API error");
    }

    return json;
  }

  // ---------------------------------------------------------
  // RETURN FULL MTD CLIENT
  // ---------------------------------------------------------
  return {
    // ---------------------------
    // VAT MTD
    // ---------------------------
    async getVATObligations() {
      if (!vrn) throw new Error("Client VAT number missing");
      return hmrcGet(`/organisations/vat/${vrn}/obligations`);
    },

    async getVATReturns() {
      if (!vrn) throw new Error("Client VAT number missing");
      return hmrcGet(`/organisations/vat/${vrn}/returns`);
    },

    // ---------------------------
    // SA MTD (NEW)
    // ---------------------------
    async getSAObligations() {
      if (!mtditid) throw new Error("Client MTD ITSA ID missing");
      return hmrcGet(`/income-tax/${mtditid}/obligations`);
    },

    async getSAPeriodSummaries() {
      if (!mtditid) throw new Error("Client MTD ITSA ID missing");
      return hmrcGet(`/income-tax/${mtditid}/periodic-summaries`);
    },

    async createSAPeriodSummary(body) {
      if (!mtditid) throw new Error("Client MTD ITSA ID missing");
      return hmrcPost(`/income-tax/${mtditid}/periodic-summaries`, body);
    },

    async submitEOPS(body) {
      if (!mtditid) throw new Error("Client MTD ITSA ID missing");
      return hmrcPost(`/income-tax/${mtditid}/end-of-period-statement`, body);
    },

    async getEOPS() {
      if (!mtditid) throw new Error("Client MTD ITSA ID missing");
      return hmrcGet(`/income-tax/${mtditid}/end-of-period-statement`);
    },

    async submitFinalDeclaration(body) {
      if (!mtditid) throw new Error("Client MTD ITSA ID missing");
      return hmrcPost(`/income-tax/${mtditid}/final-declaration`, body);
    },

    async getFinalDeclaration() {
      if (!mtditid) throw new Error("Client MTD ITSA ID missing");
      return hmrcGet(`/income-tax/${mtditid}/final-declaration`);
    },

    async getSAReturns() {
      if (!mtditid) throw new Error("Client MTD ITSA ID missing");
      return hmrcGet(`/income-tax/${mtditid}/returns`);
    }
  };
}
