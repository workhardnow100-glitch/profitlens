// pages/api/hmrc/oauth/start.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseAdmin } from "../../../../lib/supabase-admin";


const HMRC_AUTH_URL = "https://test-api.service.hmrc.gov.uk/oauth/authorize";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { clientId } = req.query;
  if (!clientId) {
    return res.status(400).json({ error: "Missing clientId" });
  }

  // Accountant-aware: ensure user is allowed to act for this client
  const actingClientId = session.user.actingAsClientId || session.user.clientId;
  const isFounder = session.user.role === "admin";

  if (!isFounder && actingClientId !== clientId) {
    return res
      .status(403)
      .json({ error: "You are not allowed to connect HMRC for this client" });
  }

  // Optionally: verify client exists
  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, name, vat_number")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    return res.status(404).json({ error: "Client not found" });
  }

  // Optional but sensible: require VAT number before connecting HMRC
  if (!client.vat_number) {
    return res
      .status(400)
      .json({ error: "Client must have a VAT number before connecting HMRC" });
  }

  const clientIdEnv = process.env.HMRC_CLIENT_ID_SANDBOX;
  const redirectUri = process.env.HMRC_REDIRECT_URI_SANDBOX;

  if (!clientIdEnv || !redirectUri) {
    return res.status(500).json({ error: "HMRC OAuth not configured" });
  }

  // Encode state with clientId to link callback back to this client
  const statePayload = {
    clientId,
    userEmail: session.user.email,
  };
  const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

  const scope = encodeURIComponent("read:vat write:vat");
  const authUrl =
    `${HMRC_AUTH_URL}?response_type=code` +
    `&client_id=${encodeURIComponent(clientIdEnv)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${scope}` +
    `&state=${encodeURIComponent(state)}`;

  return res.redirect(authUrl);
}
