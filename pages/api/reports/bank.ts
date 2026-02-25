// pages/api/reports/bank.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { data: accounts, error: accErr } = await supabaseAdmin
      .from("chart_of_account_entries")
      .select("id, account_code, account_name")
      .eq("is_bank_account", true);

    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) {
      return res.status(200).json({ accounts: [], transactions: [] });
    }

    const bankAccountIds = accounts.map((a) => a.id);

    // BANK FEED – from transactions table, linked by coa_id
    const { data: bankTx, error: bankErr } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .in("coa_id", bankAccountIds)
      .order("date", { ascending: true });

    if (bankErr) throw bankErr;

    // LEDGER – from journal_lines + journal_entries
    const { data: ledgerLines, error: ledErr } = await supabaseAdmin
      .from("journal_lines")
      .select(`
        id,
        debit,
        credit,
        account_id,
        journal_entries (
          id,
          date,
          description
        )
      `)
      .in("account_id", bankAccountIds);

    if (ledErr) throw ledErr;

    const ledgerLookup = new Set<string>();

    (ledgerLines || []).forEach((l: any) => {
      const je = l.journal_entries;
      if (!je) return;
      const amt = Number(l.debit || 0) - Number(l.credit || 0);
      ledgerLookup.add(`${je.date}|${amt}|${je.description || ""}`);
    });

    const merged: any[] = [];

    // Bank feed rows
    (bankTx || []).forEach((b: any) => {
      const key = `${b.date}|${Number(b.amount)}|${b.description || ""}`;
      const matched = ledgerLookup.has(key);

      merged.push({
        id: `${b.coa_id}:${b.id}`,
        date: b.date,
        description: b.description,
        amount: Number(b.amount),
        category: b.business_category,
        is_reconciled: matched,
        is_director_loan: b.business_category === "Director Loan",
        source: matched ? "both" : "bank",
        balance_after: null,
      });
    });

    // Ledger-only rows
    (ledgerLines || []).forEach((l: any) => {
      const je = l.journal_entries;
      if (!je) return;

      const amt = Number(l.debit || 0) - Number(l.credit || 0);
      const key = `${je.date}|${amt}|${je.description || ""}`;
      const matched = ledgerLookup.has(key);

      if (!matched) {
        merged.push({
          id: `ledger:${l.id}`,
          date: je.date,
          description: je.description,
          amount: amt,
          category: l.account_id,
          is_reconciled: false,
          is_director_loan: false,
          source: "ledger",
          balance_after: null,
        });
      }
    });

    merged.sort((a, b) => (a.date < b.date ? -1 : 1));

    let balance = 0;
    const finalTx = merged.map((t) => {
      balance += t.amount;
      return { ...t, balance_after: balance };
    });

    return res.status(200).json({
      accounts: accounts.map((a) => ({
        account_code: a.account_code,
        account_name: a.account_name,
        opening_balance: 0,
        closing_balance: balance,
      })),
      transactions: finalTx,
    });
  } catch (err: any) {
    console.error("Bank report error:", err);
    return res.status(500).json({ error: err.message });
  }
}
