// pages/api/journal/approve-unlock.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const isAdmin = session.user.role === "admin";
  if (!isAdmin) {
    return res.status(403).json({ error: "Only admins can approve unlocks" });
  }

  const { requestId } = req.body || {};
  if (!requestId) {
    return res.status(400).json({ error: "Missing request ID" });
  }

  try {
    const { data: reqRow, error: reqErr } = await supabaseAdmin
      .from("journal_unlock_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (reqErr || !reqRow) {
      return res.status(404).json({ error: "Unlock request not found" });
    }

    if (reqRow.status !== "pending") {
      return res.status(400).json({ error: "Request already processed" });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from("journal_period_locks")
      .delete()
      .eq("client_id", reqRow.client_id)
      .eq("period_start", reqRow.period_start)
      .eq("period_end", reqRow.period_end);

    if (deleteErr) {
      console.error("Approve unlock delete error:", deleteErr);
      return res.status(500).json({ error: "Failed to unlock period" });
    }

    const { error: updateReqErr } = await supabaseAdmin
      .from("journal_unlock_requests")
      .update({
        status: "approved",
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateReqErr) throw updateReqErr;

    await supabaseAdmin.from("audit").insert([
      {
        client_id: reqRow.client_id,
        actor_email: session.user.email,
        action: "JOURNAL_PERIOD_UNLOCK_APPROVE",
        details: `Approved unlock for journal period ${reqRow.period_start} → ${reqRow.period_end}`,
        timestamp: new Date().toISOString(),
      },
    ]);

    return res.status(200).json({ approved: true });
  } catch (err) {
    console.error("Approve unlock error:", err);
    return res.status(500).json({ error: "Failed to approve unlock" });
  }
}
