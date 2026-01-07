// pages/api/reconcile/[id].js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ⭐ Validate session
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const role = (session.user.role || "").toUpperCase();

  // ⭐ Subscription gating (consistent with all modules)
  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Determine clientId (accountant‑aware)
  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId;
  }

  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  const { tag, clientMatch, note } = req.body;

  if (!tag || !clientMatch || typeof tag !== "string" || typeof clientMatch !== "string") {
    return res.status(400).json({ error: "Missing or invalid fields" });
  }

  try {
    // ⭐ Validate statement belongs to this client
    const { data: statement, error: stmtErr } = await supabaseAdmin
      .from("bank_statements")
      .select("id")
      .eq("id", id)
      .eq("client_id", clientId)
      .single();

    if (stmtErr || !statement) {
      return res.status(404).json({ error: "Statement not found for this client" });
    }

    // ⭐ Save reconciliation entry
    const { error: reconError } = await supabaseAdmin.from("reconciliations").insert([
      {
        statement_id: id,
        client_id: clientId,
        user_id: session.user.id,
        tag,
        client_match: clientMatch,
        note: note || "",
        timestamp: new Date().toISOString(),
      },
    ]);

    if (reconError) throw reconError;

    // ⭐ Audit log (accountant-aware)
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: session.user.email,
        action: "RECONCILIATION_SUBMITTED",
        details: `Tag: ${tag}, ClientMatch: ${clientMatch}, Note: ${note || ""}`,
        timestamp: new Date().toISOString(),
      },
    ]);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Reconciliation error:", err.message);
    return res.status(500).json({ error: "Failed to save reconciliation" });
  }
}
