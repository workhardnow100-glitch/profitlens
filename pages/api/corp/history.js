/**
 * ============================================================
 * File: pages/api/corp/history.js
 * Purpose:
 *   Return Corporation Tax history for a specific client:
 *     - CT submissions (corp_submissions)
 *     - CT payments (ct_payments)
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: POST only.
 *   - Authentication:
 *       • Uses NextAuth session.
 *   - RBAC:
 *       • ACCOUNTANT:
 *           – May view CT history for actingAsClientId.
 *       • USER:
 *           – May view CT history for their own clientId.
 *       • FOUNDER:
 *           – May view CT history for any client.
 *   - Subscription gating:
 *       • USER must be subscribed/trialing.
 *       • ACCOUNTANT + FOUNDER bypass subscription gating.
 *   - Data handling:
 *       • All reads are client‑scoped via client_id.
 *   - Audit logging:
 *       • Logs VIEW_CT_HISTORY / ACCOUNTANT_VIEW_CT_HISTORY.
 *
 * Change Control:
 *   - Any change to:
 *       • corp_submissions schema
 *       • ct_payments schema
 *     MUST be reflected here and in the CT History UI.
 * ============================================================
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ⭐ Session required
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ⭐ Normalize role
  const role = (session.user.role || "").toUpperCase();
  const isFounder = role === "FOUNDER";
  const isAccountant = role === "ACCOUNTANT";

  const subscriptionStatus = session.user.subscriptionStatus;
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    subscriptionStatus
  );

  // ⭐ Subscription gating (accountants + founders bypass)
  if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Accountant-aware client ID
  const clientId = isAccountant
    ? session.user.actingAsClientId
    : session.user.clientId || session.user.defaultClientId;

  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "No client selected" });
  }

  try {
    // ⭐ Audit log — all roles
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: session.user.email,
        action: isAccountant ? "ACCOUNTANT_VIEW_CT_HISTORY" : "VIEW_CT_HISTORY",
        details: "Viewed Corporation Tax history",
        timestamp: new Date().toISOString(),
      },
    ]);

    // ⭐ Load submissions
    const { data: submissions, error: subError } = await supabaseAdmin
      .from("corp_submissions")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (subError) throw subError;

    // ⭐ Load payments
    const { data: payments, error: payError } = await supabaseAdmin
      .from("ct_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("payment_date", { ascending: false });

    if (payError) throw payError;

    return res.status(200).json({
      submissions,
      payments,
    });
  } catch (err) {
    console.error("CT history error:", err);
    return res.status(500).json({ error: err.message });
  }
}
