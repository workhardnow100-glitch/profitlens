// pages/api/reconcile/[id].js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isFounder = session.user.role === "admin";
  const isSubscribed = ["basic", "pro"].includes(session.user.subscriptionStatus);

  if (!(isFounder || isSubscribed)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  const clientId = session.user.clientId;
  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  const { tag, clientMatch, note } = req.body;
  if (!tag || !clientMatch) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // ✅ Save reconciliation entry, scoped by client_id
    const { error: reconError } = await supabaseAdmin.from("reconciliations").insert([{
      statement_id: id,
      client_id: clientId,
      user_id: session.user.id,
      tag,
      client_match: clientMatch,
      note,
      timestamp: new Date().toISOString(),
    }]);

    if (reconError) throw reconError;

    // ✅ Log audit trail
    await supabaseAdmin.from("audit").insert([{
      client_id: clientId,
      user: session.user.email,
      action: "RECONCILIATION_SUBMITTED",
      details: `Tag: ${tag}, ClientMatch: ${clientMatch}, Note: ${note}`,
      timestamp: new Date().toISOString(),
    }]);

    console.log(`✅ Reconciliation saved for statement ${id}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ Reconciliation error:", err.message);
    return res.status(500).json({ error: "Failed to save reconciliation" });
  }
}
