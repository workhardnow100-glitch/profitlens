// pages/api/journal/manage.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

async function isDateLocked(clientId, date) {
  const { data, error } = await supabaseAdmin
    .from("journal_period_locks")
    .select("id, period_start, period_end")
    .eq("client_id", clientId)
    .lte("period_start", date)
    .gte("period_end", date)
    .maybeSingle();

  if (error) {
    console.error("Lock check error:", error);
    return false;
  }
  return !!data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const role = (session.user.role || "").toUpperCase();

  const isFounder = role === "FOUNDER";
  const isAdmin = role === "ADMIN";
  const isAccountant = role === "ACCOUNTANT";

  // optional: trustStatus on the user (if you set this at login/session time)
  const trustStatus = session.user.trustStatus || "none";
  const isTrustedAccountant =
    isAccountant && (trustStatus === "global" || trustStatus === "client");

  const isOverride = isFounder || isAdmin || isTrustedAccountant;

  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isAdmin || isSubscribedOrTrial || isTrustedAccountant)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId) return res.status(400).json({ error: "Invalid client ID" });

  const { action, payload } = req.body;
  if (!action) return res.status(400).json({ error: "Missing action" });

  const { data: coaHeader, error: coaError } = await supabaseAdmin
    .from("chart_of_accounts")
    .select("id")
    .eq("client_id", clientId)
    .single();

  if (coaError) {
    console.error("COA fetch error:", coaError);
    return res.status(500).json({ error: "Error loading chart of accounts" });
  }

  if (!coaHeader) return res.status(400).json({ error: "No COA found" });

  async function audit(actionCode, details) {
    try {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: actionCode,
          details,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error("Audit log error (journal):", err);
    }
  }

  // CREATE
  if (action === "create") {
    const { date, description, reference, lines } = payload || {};

    if (!date || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: "Missing journal data" });
    }

    // 🔒 Block posting into locked month (except override)
    const locked = await isDateLocked(clientId, date);
    if (locked && !isOverride) {
      return res
        .status(400)
        .json({ error: "This period is locked. Journals cannot be posted." });
    }

    const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.0001) {
      return res
        .status(400)
        .json({ error: "Debits and credits must balance" });
    }

    try {
      const { data: journal, error: jErr } = await supabaseAdmin
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

      if (jErr) throw jErr;

      const { error: lineErr } = await supabaseAdmin
        .from("journal_lines")
        .insert(
          lines.map((l) => ({
            journal_id: journal.id,
            account_id: l.account_id,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          }))
        );

      if (lineErr) throw lineErr;

      const { error: coaUpdateErr } = await supabaseAdmin
        .from("chart_of_account_entries")
        .update({ has_activity: true })
        .in(
          "id",
          lines.map((l) => l.account_id)
        );

      if (coaUpdateErr) throw coaUpdateErr;

      await audit(
        role === "ACCOUNTANT" ? "ACCOUNTANT_JOURNAL_CREATE" : "JOURNAL_CREATE",
        `Created journal ${journal.id} on ${date}`
      );

      return res.status(200).json({ success: true, journalId: journal.id });
    } catch (err) {
      console.error("Journal create error:", err);
      return res.status(500).json({ error: "Failed to create journal" });
    }
  }

  // REVERSE
  if (action === "reverse") {
    const { id } = payload || {};
    if (!id) return res.status(400).json({ error: "Missing journal ID" });

    try {
      const { data: journal, error: jErr } = await supabaseAdmin
        .from("journal_entries")
        .select("*")
        .eq("id", id)
        .eq("client_id", clientId)
        .single();

      if (jErr) throw jErr;
      if (!journal) return res.status(404).json({ error: "Journal not found" });
      if (journal.reversed)
        return res.status(400).json({ error: "Already reversed" });

      // 🔒 Block reversing if original journal date is in locked month (except override)
      const locked = await isDateLocked(clientId, journal.date);
      if (locked && !isOverride) {
        return res.status(400).json({
          error: "This period is locked. Journals cannot be reversed.",
        });
      }

      const { data: lines, error: lineErr } = await supabaseAdmin
        .from("journal_lines")
        .select("*")
        .eq("journal_id", id);

      if (lineErr) throw lineErr;

      const today = new Date().toISOString().slice(0, 10);

      const { data: rev, error: revErr } = await supabaseAdmin
        .from("journal_entries")
        .insert([
          {
            client_id: clientId,
            date: today,
            description: `Reversal of journal ${id}`,
            reference: `REV-${String(id).slice(0, 6)}`,
            created_by: session.user.id,
          },
        ])
        .select("*")
        .single();

      if (revErr) throw revErr;

      const { error: revLinesErr } = await supabaseAdmin
        .from("journal_lines")
        .insert(
          lines.map((l) => ({
            journal_id: rev.id,
            account_id: l.account_id,
            debit: l.credit,
            credit: l.debit,
          }))
        );

      if (revLinesErr) throw revLinesErr;

      const { error: markErr } = await supabaseAdmin
        .from("journal_entries")
        .update({
          reversed: true,
          reversed_by: session.user.id,
          reversed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (markErr) throw markErr;

      await audit(
        role === "ACCOUNTANT" ? "ACCOUNTANT_JOURNAL_REVERSE" : "JOURNAL_REVERSE",
        `Reversed journal ${id} with reversal ${rev.id}`
      );

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("Journal reverse error:", err);
      return res.status(500).json({ error: "Failed to reverse journal" });
    }
  }

  // DELETE
  if (action === "delete") {
    const { id } = payload || {};
    if (!id) return res.status(400).json({ error: "Missing journal ID" });

    try {
      const { data: journal, error: jErr } = await supabaseAdmin
        .from("journal_entries")
        .select("*")
        .eq("id", id)
        .eq("client_id", clientId)
        .single();

      if (jErr) throw jErr;
      if (!journal) return res.status(404).json({ error: "Not found" });

      // 🔒 Non-override users cannot delete reversed journals
      if (journal.reversed && !isOverride) {
        return res
          .status(400)
          .json({ error: "Cannot delete reversed journal" });
      }

      // 🔒 Block deleting if journal date is in locked month (except override)
      const locked = await isDateLocked(clientId, journal.date);
      if (locked && !isOverride) {
        return res.status(400).json({
          error: "This period is locked. Journals cannot be deleted.",
        });
      }

      const { error: delErr } = await supabaseAdmin
        .from("journal_entries")
        .delete()
        .eq("id", id);

      if (delErr) throw delErr;

      await audit(
        role === "ACCOUNTANT" ? "ACCOUNTANT_JOURNAL_DELETE" : "JOURNAL_DELETE",
        `Deleted journal ${id}`
      );

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("Journal delete error:", err);
      return res.status(500).json({ error: "Failed to delete journal" });
    }
  }

  return res.status(400).json({ error: "Unknown action" });
}
