// pages/api/reports/bank.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";

/* -----------------------------
   TYPE DEFINITIONS
------------------------------ */

type BankReportAccount = {
  id: string;
  account_code: string;
  account_name: string;
};

type BankReportTransaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string | null;
  is_reconciled: boolean;
  is_director_loan: boolean;
  source: "bank" | "ledger" | "both";
  balance_after: number | null;
};

/* -----------------------------
   RUNNING BALANCE HELPER
------------------------------ */

function computeRunningBalance(
  transactions: BankReportTransaction[],
  opening: number
): BankReportTransaction[] {
  let balance = opening;

  return transactions.map((t) => {
    balance += t.amount;
    return { ...t, balance_after: balance };
  });
}

/* -----------------------------
   MAIN HANDLER
------------------------------ */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    /* -----------------------------
       1. FETCH BANK LEDGER ACCOUNTS
    ------------------------------ */
    const { data: accounts, error: accErr } = await supabaseAdmin
      .from("chart_of_account_entries")
      .select("id, account_code, account_name")
      .eq("is_bank_account", true);

    if (accErr) throw accErr;
    if (!accounts || accounts.length === 0) {
      return res.status(200).json({ accounts: [], transactions: [] });
    }

    const bankAccountIds = accounts.map((a) => a.id);
    const bankAccountCodes = accounts.map((a) => a.account_code);

    /* -----------------------------
       2. FETCH BANK FEED TRANSACTIONS
    ------------------------------ */
    const { data: bankTx, error: bankErr } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .in("coa_id", bankAccountIds)
      .order("date", { ascending: true });

    if (bankErr) throw bankErr;

    /* -----------------------------
       3. FETCH LEDGER JOURNAL LINES
          (JOIN JOURNAL ENTRIES)
    ------------------------------ */
    const { data: ledgerLines, error: ledErr } = await supabaseAdmin
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

    if (ledErr) throw ledErr;

    /* -----------------------------
       4. LEDGER MATCH LOOKUP
       (BANK vs LEDGER)
    ------------------------------ */

    const ledgerLookup = new Set<string>();

    (ledgerLines || []).forEach((l: any) => {
      const je = l.journal_entries;
      if (!je) return;
      const ledgerAmount =
        Number(l.debit || 0) - Number(l.credit || 0); // debit-positive for bank (asset) accounts
      const key = `${je.date}|${ledgerAmount}|${je.description || ""}`;
      ledgerLookup.add(key);
    });

    /* -----------------------------
       5. MERGE BANK + LEDGER
    ------------------------------ */

    const merged: BankReportTransaction[] = [];

    // Bank feed transactions
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

    // Ledger-only lines
    (ledgerLines || []).forEach((l: any) => {
      const je = l.journal_entries;
      if (!je) return;

      const ledgerAmount =
        Number(l.debit || 0) - Number(l.credit || 0); // debit-positive
      const key = `${je.date}|${ledgerAmount}|${je.description || ""}`;
      const matched = ledgerLookup.has(key);

      if (!matched) {
        merged.push({
          id: `ledger:${l.id}`,
          date: je.date,
          description: je.description,
          amount: ledgerAmount,
          category: l.account_id, // COA id reference
          is_reconciled: false,
          is_director_loan: false,
          source: "ledger",
          balance_after: null,
        });
      }
    });

    /* -----------------------------
       6. SORT BY DATE
    ------------------------------ */
    merged.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    /* -----------------------------
       7. RUNNING BALANCES PER ACCOUNT
    ------------------------------ */

    const finalTx: BankReportTransaction[] = [];

    for (const acc of accounts as BankReportAccount[]) {
      const txForAcc = merged.filter(
        (t) => t.id.startsWith(`${acc.id}:`) || t.category === acc.id
      );

      const withBalance = computeRunningBalance(txForAcc, 0);
      finalTx.push(...withBalance);
    }

    /* -----------------------------
       8. BUILD RESPONSE
    ------------------------------ */

    const response = {
      accounts: (accounts as BankReportAccount[]).map((a) => ({
        account_code: a.account_code,
        account_name: a.account_name,
        opening_balance: 0,
        closing_balance: 0,
      })),
      transactions: finalTx,
    };

    return res.status(200).json(response);
  } catch (err: any) {
    console.error("Bank report error:", err);
    return res.status(500).json({ error: err.message });
  }
}
