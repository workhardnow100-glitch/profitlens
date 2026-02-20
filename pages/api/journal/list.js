// pages/api/journal/list.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

function getMonthRange(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0–11

  const start = new Date(year, month, 1).toISOString().slice(0, 10);
  const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);

  return { start, end };
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const role = (session.user.role || "").toUpperCase();
  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId) return res.status(400).json({ error: "Invalid client ID" });

  // Load journals via RPC
  const { data, error } = await supabaseAdmin.rpc(
    "list_journals_for_client",
    { p_client_id: clientId }
  );

  if (error) {
    console.error("Journal list error:", error);
    return res.status(500).json({ error: "Failed to load journals" });
  }

  // ⭐ REAL monthly lock detection
  const { start, end } = getMonthRange();

  const { data: lockRecord } = await supabaseAdmin
    .from("journal_period_locks")
    .select("id")
    .eq("client_id", clientId)
    .eq("period_start", start)
    .eq("period_end", end)
    .maybeSingle();

  const periodLocked = !!lockRecord;

  return res.status(200).json({
    journals: data || [],
    periodLocked,
    periodStart: start,
    periodEnd: end,
  });
}
