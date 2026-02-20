// pages/api/journal/request-unlock.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const role = (session.user.role || "").toUpperCase();

  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId) return res.status(400).json({ error: "Invalid client ID" });

  const { periodStart, periodEnd, reason } = req.body || {};
  if (!periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing period range" });
  }

  try {
    const { error: insertErr } = await supabaseAdmin
      .from("journal_unlock_requests")
      .insert([
        {
          client_id: clientId,
          period_start: periodStart,
          period_end: periodEnd,
          requested_by: session.user.id,
          reason: reason || null,
        },
      ]);

    if (insertErr) throw insertErr;

    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: session.user.email,
        action: "JOURNAL_PERIOD_UNLOCK_REQUEST",
        details: `Requested unlock for journal period ${periodStart} → ${periodEnd}${
          reason ? ` (reason: ${reason})` : ""
        }`,
        timestamp: new Date().toISOString(),
      },
    ]);

    return res.status(200).json({ requested: true, message: "Unlock requested" });
  } catch (err) {
    console.error("Request unlock error:", err);
    return res.status(500).json({ error: "Failed to request unlock" });
  }
}
