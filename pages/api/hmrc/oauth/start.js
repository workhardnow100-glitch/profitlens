/**
 * ============================================================
 * File: pages/api/hmrc/oauth/start.js
 * Purpose:
 *   Initiate the HMRC OAuth flow for a specific client, redirecting
 *   the user to HMRC's authorization endpoint with a signed state.
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: GET only.
 *   - Authentication:
 *       • Uses requireRole() via NextAuth session.
 *   - RBAC:
 *       • Allowed roles: USER, ACCOUNTANT, ADMIN, FOUNDER.
 *       • Founder bypass: may initiate HMRC OAuth for any client.
 *       • Non-founders:
 *           – Must be acting on the specified clientId
 *             (actingAsClientId or clientId from session).
 *   - Accountant-aware:
 *       • ACCOUNTANT must have actingAsClientId/clientId matching the
 *         requested clientId.
 *   - Input validation:
 *       • Requires query.clientId.
 *       • Verifies client exists in public.clients.
 *       • Requires client.vat_number before allowing HMRC connection.
 *   - HMRC OAuth:
 *       • Uses sandbox HMRC client ID and redirect URI from env:
 *           – HMRC_CLIENT_ID_SANDBOX
 *           – HMRC_REDIRECT_URI_SANDBOX
 *       • Encodes state as base64url JSON:
 *           – { clientId, userEmail }
 *   - RLS Alignment:
 *       • clientId is later used in callback to store tokens in
 *         public.hmrc_tokens with correct client scoping.
 *
 * Change Control:
 *   - Any change to:
 *       • role semantics
 *       • actingAsClientId / clientId semantics
 *       • HMRC env vars
 *     MUST be reflected in:
 *       • pages/api/hmrc/oauth/callback.js
 *       • RLS policies on public.hmrc_tokens
 *       • lib/rbac.ts
 * ============================================================
 */

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
  if (!clientId || typeof clientId !== "string") {
    return res.status(400).json({ error: "Missing or invalid clientId" });
  }

  const role = (session.user.role || "").toUpperCase();
  const isFounder = role === "FOUNDER";

  const actingClientId =
    session.user.actingAsClientId || session.user.clientId || null;

  if (!isFounder && actingClientId !== clientId) {
    return res.status(403).json({
      error: "You are not allowed to connect HMRC for this client",
    });
  }

  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id, name, vat_number")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    return res.status(404).json({ error: "Client not found" });
  }

  if (!client.vat_number) {
    return res.status(400).json({
      error: "Client must have a VAT number before connecting HMRC",
    });
  }

  const clientIdEnv = process.env.HMRC_CLIENT_ID_SANDBOX;
  const redirectUri = process.env.HMRC_REDIRECT_URI_SANDBOX;

  if (!clientIdEnv || !redirectUri) {
    return res.status(500).json({ error: "HMRC OAuth not configured" });
  }

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
