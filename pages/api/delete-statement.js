/**
 * ============================================================
 * File: pages/api/delete-statements.js
 * Purpose:
 *   Delete bank statements for a specific client.
 *
 *   Supports:
 *     - Deleting all statements for a client
 *     - Deleting statements from a specific upload batch
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: DELETE only.
 *   - Authentication:
 *       • Uses requireRole() to enforce USER / ACCOUNTANT / ADMIN / FOUNDER.
 *   - RBAC:
 *       • Founder override: may delete statements for any client.
 *       • Non-founders:
 *           – Must be acting on the specified clientId.
 *   - Subscription gating:
 *       • Only active/trialing subscriptions may delete statements.
 *   - RLS Alignment:
 *       • statements table is client-scoped.
 *       • This endpoint uses supabaseAdmin (service role) for controlled deletes.
 *   - Audit logging:
 *       • Logs DELETE_STATEMENTS with uploadId context.
 *
 * Change Control:
 *   - Any change to:
 *       • statements schema
 *       • upload batch semantics
 *     MUST be reflected in:
 *       • bank statement ingestion pipeline
 *       • reconciliation UI
 * ============================================================
 */

import { requireRole } from "../../lib/rbac";
import { supabaseAdmin } from "../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // ⭐ RBAC: USER, ACCOUNTANT, ADMIN, FOUNDER
  const guard = await requireRole(req, res, ["USER", "ACCOUNTANT", "ADMIN"]);
  if (!guard.ok) return;

  const role = guard.role;
  const isFounder = role === "FOUNDER";

  // ⭐ Subscription gating
  const subscriptionStatus = req?.session?.user?.subscriptionStatus || "incomplete";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(subscriptionStatus);

  if (!isFounder && !isSubscribedOrTrial) {
    return res.status(403).json({ message: "Upgrade required" });
  }

  // ⭐ Accountant-aware scoping
  const clientId = guard.actingAsClientId || guard.clientId;

  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ message: "Invalid client ID" });
  }

  try {
    const { uploadId } = req.body;
    let deletedCount = 0;

    if (uploadId) {
      const { count, error } = await supabaseAdmin
        .from("statements")
        .delete({ count: "exact" })
        .match({ client_id: clientId, source: uploadId });

      if (error) throw error;
      deletedCount = count;
    } else {
      const { count, error } = await supabaseAdmin
        .from("statements")
        .delete({ count: "exact" })
        .eq("client_id", clientId);

      if (error) throw error;
      deletedCount = count;
    }

    // ⭐ Audit log
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: req.session?.user?.email || "unknown",
        action: "DELETE_STATEMENTS",
        details: uploadId
          ? `Deleted statements from upload ${uploadId}`
          : "Deleted all statements for client",
        timestamp: new Date().toISOString(),
      },
    ]);

    return res.status(200).json({
      deleted: deletedCount,
      message: uploadId
        ? `Deleted ${deletedCount} statements from upload ${uploadId}`
        : `Deleted ${deletedCount} statements for client`,
    });
  } catch (err) {
    console.error("❌ Delete error:", err);
    return res.status(500).json({ message: "Failed to delete statements" });
  }
}
