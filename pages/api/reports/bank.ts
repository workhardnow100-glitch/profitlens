// pages/api/reports/bank.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";

type BankAccount = {
  id: string;
  account_code: string;
  account_name: string;
  opening_balance: number;
};

type UnifiedTx = {
  id: string;
  account_id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  is_reconciled: boolean;
  source: "bank" | "ledger" | "both";
  balance_after: number | null;
};

function normaliseDate(d: string | null | undefined): string {
  if (!d) return "";
  return d.slice(0, 10); // handles timestamps
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { from, to, show_unmatched } = req.query;

    const fromDate =
      typeof from === "string" && from.trim() !== "" ? normaliseDate(from) : null;
    const toDate =
      typeof to === "string" && to.trim() !== "" ? normaliseDate(to) : null;
    const onlyUnmatched = show_unmatched === "true";

    // 1) Fetch BANK accounts (with opening balance)
    const { data: accounts, error: accErr } = await supabaseAdmin
      .from("chart_of_account_entries")
      .select("id, account_code, account_name, opening_balance")
      .eq("is_bank_account", true);

    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) {
      return res.status(200).json({ accounts: [], transactions: [] });
    }

    const bankAccounts = accounts as BankAccount[];
    const bankAccountIds = bankAccounts.map((a) => a.id);
    const bankAccountNameById = Object.fromEntries(
      bankAccounts.map((a) => [a.id, a.account_name])
    );
    const openingMap = Object.fromEntries(
      bankAccounts.map((a) => [a.id, Number(a.opening_balance || 0)])
    );

    // 2) BANK FEED rows
    const { data: bankTx } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .in("coa_id", bankAccountIds)
      .order("date", { ascending: true });

    // 3) LEDGER rows for BANK accounts
    const { data: bankLedgerLines } = await supabaseAdmin
      .from("journal_lines")
      .select(
        `
        id,
        debit,
        credit,
        account_id,
        journal_entries (
          id,
          date,
          description
        )
      `
      )
      .in("account_id", bankAccountIds);

    // 4) Build reconciliation lookup
    const ledgerLookup = new Set<string>();
    (bankLedgerLines || []).forEach((l: any) => {
      const je = l.journal_entries;
      if (!je) return;
      const d = normaliseDate(je.date);
      const amt = Number(l.debit || 0) - Number(l.credit || 0);
      const key = `${d}|${amt}|${je.description || ""}`;
      ledgerLookup.add(key);
    });

    // 5) Build unified list
    const unified: UnifiedTx[] = [];

    // BANK FEED rows
    (bankTx || []).forEach((b: any) => {
      const d = normaliseDate(b.date);
      const amt = Number(b.amount);
      const reconKey = `${d}|${amt}|${b.description || ""}`;
      const matched = ledgerLookup.has(reconKey);

      unified.push({
        id: `${b.coa_id}:${b.id}`,
        account_id: b.coa_id,
        date: d,
        description: b.description,
        amount: amt,
        category: b.business_category || bankAccountNameById[b.coa_id] || null,
        is_reconciled: matched,
        source: matched ? "both" : "bank",
        balance_after: null,
      });
    });

    // LEDGER rows
    (bankLedgerLines || []).forEach((l: any) => {
      const je = l.journal_entries;
      if (!je) return;

      const d = normaliseDate(je.date);
      const amt = Number(l.debit || 0) - Number(l.credit || 0);
      const key = `${d}|${amt}|${je.description || ""}`;
      const matched = ledgerLookup.has(key);

      unified.push({
        id: `ledger:${l.id}`,
        account_id: l.account_id,
        date: d,
        description: je.description,
        amount: amt,
        category: bankAccountNameById[l.account_id] || null,
        is_reconciled: matched,
        source: matched ? "both" : "ledger",
        balance_after: null,
      });
    });

    // 6) Apply filters
    let filtered = unified;

    if (fromDate) filtered = filtered.filter((t) => t.date >= fromDate);
    if (toDate) filtered = filtered.filter((t) => t.date <= toDate);
    if (onlyUnmatched) filtered = filtered.filter((t) => t.source !== "both");

    // 7) Collapse duplicates (bank+ledger)
    const priority = { both: 3, bank: 2, ledger: 1 };
    const collapsed = new Map<string, UnifiedTx>();

    for (const tx of filtered) {
      const key = `${tx.date}|${tx.amount}|${tx.description}`;
      if (!collapsed.has(key)) {
        collapsed.set(key, tx);
        continue;
      }
      const existing = collapsed.get(key)!;
      if (priority[tx.source] > priority[existing.source]) {
        collapsed.set(key, tx);
      }
    }

    const finalList = Array.from(collapsed.values());

    // 8) Running balances (COA opening balance)
    const openingByAccount: Record<string, number> = {};
    const closingByAccount: Record<string, number> = {};

    bankAccountIds.forEach((accId) => {
      openingByAccount[accId] = openingMap[accId] ?? 0;
    });

    finalList.sort((a, b) => (a.date < b.date ? -1 : 1));

    const runningByAccount: Record<string, number> = { ...openingByAccount };

    const finalTx = finalList.map((t) => {
      const current = runningByAccount[t.account_id] ?? 0;
      const next = current + t.amount;
      runningByAccount[t.account_id] = next;
      return { ...t, balance_after: next };
    });

    bankAccountIds.forEach((accId) => {
      closingByAccount[accId] = runningByAccount[accId];
    });

    // 9) Response
    const responseAccounts = bankAccounts.map((a) => ({
      id: a.id,
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
