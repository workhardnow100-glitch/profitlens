// pages/api/journal/get.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

function getMonthRange(dateStr) {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth();

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

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Missing journal ID" });

  // Fetch journal header
  const { data: journal, error: jErr } = await supabaseAdmin
    .from("journal_entries")
    .select("*")
    .eq("id", id)
    .eq("client_id", clientId)
    .single();

  if (jErr) {
    console.error("Journal fetch error:", jErr);
    return res.status(500).json({ error: "Failed to load journal" });
  }

  if (!journal) return res.status(404).json({ error: "Journal not found" });

  // Fetch lines
  const { data: lines, error: lineErr } = await supabaseAdmin
    .from("journal_lines")
    .select(
      `
      id,
      debit,
      credit,
      account_id,
      chart_of_account_entries (account_name, account_code)
    `
    )
    .eq("journal_id", id);

  if (lineErr) {
    console.error("Journal lines error:", lineErr);
    return res.status(500).json({ error: "Failed to load journal lines" });
  }

  const formattedLines = (lines || []).map((l) => ({
    id: l.id,
    debit: l.debit,
    credit: l.credit,
    account_id: l.account_id,
    account_name: l.chart_of_account_entries.account_name,
    account_code: l.chart_of_account_entries.account_code,
  }));

  // ⭐ REAL monthly lock detection based on journal.date
  const { start, end } = getMonthRange(journal.date);

  const { data: lockRecord } = await supabaseAdmin
    .from("journal_period_locks")
    .select("id")
    .eq("client_id", clientId)
    .eq("period_start", start)
    .eq("period_end", end)
    .maybeSingle();

  const periodLocked = !!lockRecord;

  return res.status(200).json({
    journal,
    lines: formattedLines,
    periodLocked,
    periodStart: start,
    periodEnd: end,
  });
}
