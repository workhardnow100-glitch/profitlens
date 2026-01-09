/**
 * ============================================================
 * File: pages/api/audit.js
 * Purpose:
 *   Read and write audit log entries for a specific client.
 *
 *   Supports:
 *     - POST: Create audit entry (business owners only)
 *     - GET:  Fetch audit log for the current client
 *
 * Security / RBAC / SOC2 Notes:
 *   - Methods: GET, POST only.
 *   - Authentication:
 *       • Uses requireRole() to enforce USER / ACCOUNTANT / ADMIN / FOUNDER.
 *   - RBAC:
 *       • ACCOUNTANT:
 *           – May READ audit logs for actingAsClientId.
 *           – May NOT create audit entries.
 *       • USER:
 *           – May READ + WRITE audit logs for their own clientId.
 *       • FOUNDER:
 *           – May READ + WRITE for any client (via actingAsClientId/clientId).
 *   - Subscription gating:
 *       • USER must be subscribed/trialing to access audit.
 *       • ACCOUNTANT + FOUNDER bypass subscription gating.
 *   - RLS Alignment:
 *       • public.audit is client-scoped.
 *       • This endpoint uses supabaseAdmin (service role) for controlled writes.
 *
 * Change Control:
 *   - Any change to:
 *       • accountant acting-as semantics
 *       • subscription gating
 *       • audit schema
 *     MUST be reflected here and in the Audit UI.
 * ============================================================
 */

import crypto from "crypto";
import { requireRole } from "../../lib/rbac";
import { supabaseAdmin } from "../../lib/supabase-admin";

export default async function handler(req, res) {
  // ⭐ RBAC: USER, ACCOUNTANT, ADMIN, FOUNDER
  const guard = await requireRole(req, res, ["USER", "ACCOUNTANT", "ADMIN"]);
  if (!guard.ok) return;

  const role = guard.role;
  const isFounder = role === "FOUNDER";
  const isAccountant = role === "ACCOUNTANT";

  const subscriptionStatus = req?.session?.user?.subscriptionStatus || "incomplete";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    subscriptionStatus
  );

  // ⭐ Subscription gating (accountants + founders bypass)
  if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Accountant-aware client ID
  const clientId = isAccountant ? guard.actingAsClientId : guard.clientId;

  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  /* -------------------------------------------------------
     ⭐ POST — Create audit entry (business owners only)
  ------------------------------------------------------- */
  if (req.method === "POST") {
    if (isAccountant) {
      return res
        .status(403)
        .json({ error: "Accountants cannot create audit entries" });
    }

    const { action, details } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const entry = {
      id: crypto.randomUUID(),
      client_id: clientId,
      actor_email: req.session?.user?.email || "unknown",
      action,
      details: details || "",
      timestamp: new Date().toISOString(),
      user: null,
      user_id: null,
    };

    const { error } = await supabaseAdmin.from("audit").insert([entry]);

    if (error) {
      console.error("❌ Audit insert error:", error);
      return res.status(500).json({ error: "Failed to log audit entry" });
    }

    return res.status(200).json({ success: true, entry });
  }

  /* -------------------------------------------------------
     ⭐ GET — Fetch audit logs (all roles)
  ------------------------------------------------------- */
  if (req.method === "GET") {
    // ⭐ Log the view itself
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: req.session?.user?.email || "unknown",
        action: isAccountant ? "ACCOUNTANT_VIEW_AUDIT" : "VIEW_AUDIT",
        details: "Viewed audit log",
        timestamp: new Date().toISOString(),
      },
    ]);

    const { data, error } = await supabaseAdmin
      .from("audit")
      .select("*")
      .eq("client_id", clientId)
      .order("timestamp", { ascending: false });

    if (error) {
      console.error("❌ Audit fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch audit logs" });
    }

    return res.status(200).json(data);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
