// pages/api/journal/manage.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const clientId = session.user.actingAsClientId || session.user.clientId;
  if (!clientId) return res.status(400).json({ error: "Invalid client ID" });

  const { action, payload } = req.body;

  // Fetch COA header
  const { data: coaHeader } = await supabaseAdmin
    .from("chart_of_accounts")
    .select("id")
    .eq("client_id", clientId)
    .single();

  if (!coaHeader) return res.status(400).json({ error: "No COA found" });

  // ---------------------------
  // CREATE
  // ---------------------------
  if (action === "create") {
    const { date, description, reference, lines } = payload;

    // Validate
    const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.0001) {
      return res.status(400).json({ error: "Debits and credits must balance" });
    }

    // Insert journal
    const { data: journal } = await supabaseAdmin
      .from("journal_entries")
      .insert([
        {
          client_id: clientId,
          date,
          description,
          reference,
          created_by: session.user.id,
        },
      ])
      .select("*")
      .single();

    // Insert lines
    await supabaseAdmin.from("journal_lines").insert(
      lines.map((l) => ({
        journal_id: journal.id,
        account_id: l.account_id,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      }))
    );

    // Mark accounts active
    await supabaseAdmin
      .from("chart_of_account_entries")
      .update({ has_activity: true })
      .in(
        "id",
        lines.map((l) => l.account_id)
      );

    return res.status(200).json({ success: true, journalId: journal.id });
  }

  // ---------------------------
  // REVERSE
  // ---------------------------
  if (action === "reverse") {
    const { id } = payload;

    // Fetch journal
    const { data: journal } = await supabaseAdmin
      .from("journal_entries")
      .select("*")
      .eq("id", id)
      .eq("client_id", clientId)
      .single();

    if (!journal) return res.status(404).json({ error: "Journal not found" });
    if (journal.reversed)
      return res.status(400).json({ error: "Already reversed" });

    // Fetch lines
    const { data: lines } = await supabaseAdmin
      .from("journal_lines")
      .select("*")
      .eq("journal_id", id);

    // Create reversing journal
    const { data: rev } = await supabaseAdmin
      .from("journal_entries")
      .insert([
        {
          client_id: clientId,
          date: new Date().toISOString().slice(0, 10),
          description: `Reversal of journal ${id}`,
          reference: `REV-${id.slice(0, 6)}`,
          created_by: session.user.id,
        },
      ])
      .select("*")
      .single();

    // Insert reversed lines
    await supabaseAdmin.from("journal_lines").insert(
      lines.map((l) => ({
        journal_id: rev.id,
        account_id: l.account_id,
        debit: l.credit,
        credit: l.debit,
      }))
    );

    // Mark original as reversed
    await supabaseAdmin
      .from("journal_entries")
      .update({
        reversed: true,
        reversed_by: session.user.id,
        reversed_at: new Date().toISOString(),
      })
      .eq("id", id);

    return res.status(200).json({ success: true });
  }

  // ---------------------------
  // DELETE (only if no reversal + no activity)
  // ---------------------------
  if (action === "delete") {
    const { id } = payload;

    const { data: journal } = await supabaseAdmin
      .from("journal_entries")
      .select("*")
      .eq("id", id)
      .eq("client_id", clientId)
      .single();

    if (!journal) return res.status(404).json({ error: "Not found" });
    if (journal.reversed)
      return res.status(400).json({ error: "Cannot delete reversed journal" });

    await supabaseAdmin.from("journal_entries").delete().eq("id", id);

    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: "Unknown action" });
}
