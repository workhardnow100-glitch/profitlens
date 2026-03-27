// pages/api/reports/bank.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";

type BankAccount = {
  id: string;
  account_code: string;
  account_name: string;
};

type UnifiedTx = {
  id: string;
  account_id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  is_reconciled: boolean;
  is_director_loan: boolean;
  source: "bank" | "ledger" | "both";
  balance_after: number | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // -------- 1. Read filters from query --------
    const { from, to, show_unmatched, show_director_loan } = req.query;

    const fromDate = typeof from === "string" && from.trim() !== "" ? from : null;
    const toDate = typeof to === "string" && to.trim() !== "" ? to : null;
    const onlyUnmatched = show_unmatched === "true";
    const onlyDirectorLoan = show_director_loan === "true";

    // -------- 2. Fetch bank accounts (COA) --------
    const { data: accounts, error: accErr } = await supabaseAdmin
      .from("chart_of_account_entries")
      .select("id, account_code, account_name")
      .eq("is_bank_account", true);

    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) {
      return res.status(200).json({ accounts: [], transactions: [] });
    }

    const bankAccounts = accounts as BankAccount[];
    const bankAccountIds = bankAccounts.map((a) => a.id);

    // -------- 3. Fetch bank feed (transactions) --------
    const { data: bankTx, error: bankErr } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .in("coa_id", bankAccountIds)
      .order("date", { ascending: true });

    if (bankErr) throw bankErr;

    // -------- 4. Fetch ledger (journal_lines + journal_entries) --------
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

    // -------- 5. Build ledger match lookup --------
    const ledgerLookup = new Set<string>();

    (ledgerLines || []).forEach((l: any) => {
      const je = l.journal_entries;
      if (!je) return;
      const amt = Number(l.debit || 0) - Number(l.credit || 0);
      const key = `${je.date}|${amt}|${je.description || ""}`;
      ledgerLookup.add(key);
    });

    // -------- 6. Build unified transaction list --------
    const unified: UnifiedTx[] = [];

    // Bank feed rows
    (bankTx || []).forEach((b: any) => {
      const key = `${b.date}|${Number(b.amount)}|${b.description || ""}`;
      const matched = ledgerLookup.has(key);

      unified.push({
        id: `${b.coa_id}:${b.id}`,
        account_id: b.coa_id,
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
        unified.push({
          id: `ledger:${l.id}`,
          account_id: l.account_id,
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

    // -------- 7. Apply date + toggle filters --------
    let filtered = unified;

    if (fromDate) {
      filtered = filtered.filter((t) => t.date >= fromDate);
    }
    if (toDate) {
      filtered = filtered.filter((t) => t.date <= toDate);
    }
    if (onlyUnmatched) {
      filtered = filtered.filter((t) => t.source !== "both");
    }
    if (onlyDirectorLoan) {
      filtered = filtered.filter((t) => t.is_director_loan);
    }

    // -------- 8. Compute opening + running + closing per account --------
    const openingByAccount: Record<string, number> = {};
    const closingByAccount: Record<string, number> = {};

    // Opening = sum of all movements BEFORE fromDate
    if (fromDate) {
      bankAccountIds.forEach((accId) => {
        const opening = unified
          .filter((t) => t.account_id === accId && t.date < fromDate)
          .reduce((sum, t) => sum + t.amount, 0);
        openingByAccount[accId] = opening;
      });
    } else {
      bankAccountIds.forEach((accId) => {
        openingByAccount[accId] = 0;
      });
    }

    // Sort filtered transactions by date
    filtered.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    // Running balance per account
    const runningByAccount: Record<string, number> = { ...openingByAccount };
    const finalTx: UnifiedTx[] = filtered.map((t) => {
      const current = runningByAccount[t.account_id] ?? 0;
      const next = current + t.amount;
      runningByAccount[t.account_id] = next;
      return { ...t, balance_after: next };
    });

    // Closing = last running balance per account (or opening if no tx)
    bankAccountIds.forEach((accId) => {
      const last = runningByAccount[accId] ?? openingByAccount[accId] ?? 0;
      closingByAccount[accId] = last;
    });

    // -------- 9. Build response --------
    const responseAccounts = bankAccounts.map((a) => ({
      account_code: a.account_code,
      account_name: a.account_name,
      opening_balance: openingByAccount[a.id] ?? 0,
      closing_balance: closingByAccount[a.id] ?? 0,
    }));

    return res.status(200).json({
      accounts: responseAccounts,
      transactions: finalTx,
    });
  } catch (err: any) {
    console.error("Bank report error:", err);
    return res.status(500).json({ error: err.message });
  }
}
