// pages/api/journal/get.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const clientId = session.user.actingAsClientId || session.user.clientId;
  if (!clientId) return res.status(400).json({ error: "Invalid client ID" });

  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Missing journal ID" });

  // Fetch journal header
  const { data: journal } = await supabaseAdmin
    .from("journal_entries")
    .select("*")
    .eq("id", id)
    .eq("client_id", clientId)
    .single();

  if (!journal) return res.status(404).json({ error: "Journal not found" });

  // Fetch lines with account names
  const { data: lines } = await supabaseAdmin
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

  const formattedLines = lines.map((l) => ({
    id: l.id,
    debit: l.debit,
    credit: l.credit,
    account_id: l.account_id,
    account_name: l.chart_of_account_entries.account_name,
    account_code: l.chart_of_account_entries.account_code,
  }));

  return res.status(200).json({
    journal,
    lines: formattedLines,
  });
}
