/**
 * ============================================================
 * File: pages/api/truelayer/auth.js
 * Purpose:
 *   Initiate the TrueLayer OAuth flow for a specific client,
 *   redirecting the user to TrueLayer's authorization endpoint
 *   with a signed state payload.
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: GET only.
 *   - Authentication:
 *       • Uses requireRole() to enforce USER / ACCOUNTANT / ADMIN / FOUNDER.
 *   - RBAC:
 *       • Founder override: may initiate OAuth for any client.
 *       • Non-founders:
 *           – Must be acting on the specified clientId.
 *   - Accountant-aware:
 *       • ACCOUNTANT must have actingAsClientId/clientId matching the
 *         requested clientId.
 *   - Subscription gating:
 *       • Only active/trialing subscriptions may initiate OAuth.
 *   - State payload:
 *       • Encodes { clientId, userEmail } as base64url.
 *       • Used later in callback to validate token storage.
 *   - RLS Alignment:
 *       • clientId is used to store tokens in public.bank_tokens
 *         under correct RLS rules.
 * ============================================================
 */

import { requireRole } from "../../../lib/rbac";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ⭐ RBAC: USER, ACCOUNTANT, ADMIN, FOUNDER
  const guard = await requireRole(req, res, ["USER", "ACCOUNTANT", "ADMIN"]);
  if (!guard.ok) return;

  const role = guard.role;
  const isFounder = role === "FOUNDER";

  // ⭐ Subscription gating (server-side)
  const subscriptionStatus = req?.session?.user?.subscriptionStatus || "incomplete";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(subscriptionStatus);

  if (!isFounder && !isSubscribedOrTrial) {
    return res.status(402).json({ error: "Subscription required" });
  }

  const clientId = req.query.client_id;
  if (!clientId || typeof clientId !== "string") {
    return res.status(400).json({ error: "Missing or invalid client_id" });
  }

  // ⭐ Accountant-aware client scoping
  const actingClientId = guard.actingAsClientId || guard.clientId;

  if (!isFounder && actingClientId !== clientId) {
    return res.status(403).json({
      error: "You are not allowed to connect banking for this client",
    });
  }

  // ⭐ Optional: verify client exists
  const { data: client, error: clientErr } = await supabaseAdmin
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .single();

  if (clientErr || !client) {
    return res.status(404).json({ error: "Client not found" });
  }

  // ⭐ Build signed state payload
  const statePayload = {
    clientId,
    userEmail: req.session?.user?.email || null,
  };

  const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

  // ⭐ Build TrueLayer OAuth URL
  const authUrl =
    `https://auth.truelayer.com/?response_type=code` +
    `&client_id=${encodeURIComponent(process.env.TL_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(process.env.TL_REDIRECT_URI)}` +
    `&scope=${encodeURIComponent("info accounts transactions")}` +
    `&state=${encodeURIComponent(state)}` +
    `&nonce=${Date.now()}`;

  return res.redirect(authUrl);
}
