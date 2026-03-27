// pages/api/transactions/categorise.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { transaction_id, category_name } = req.body;

    if (!transaction_id || !category_name) {
      return res.status(400).json({
        error: "Missing transaction_id or category_name",
      });
    }

    // 1) Load the bank transaction
    const { data: tx, error: txErr } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("id", transaction_id)
      .single();

    if (txErr || !tx) throw txErr || new Error("Transaction not found");

    const amount = Number(tx.amount);
    if (!amount || amount === 0) {
      return res.status(400).json({
        error: "Transaction amount is zero or invalid",
      });
    }

    // 2) Resolve the COA account by account_name
    const { data: categoryAccount, error: catErr } = await supabaseAdmin
      .from("chart_of_account_entries")
      .select("id, account_name")
      .eq("account_name", category_name.trim())
      .single();

    if (catErr || !categoryAccount) {
      throw new Error(
        `No COA account found for category_name: ${category_name}`
      );
    }

    const categoryAccountId = categoryAccount.id;

    // 3) Resolve the bank account (assume single main bank for now)
    const { data: bankAccount, error: bankErr } = await supabaseAdmin
      .from("chart_of_account_entries")
      .select("id")
      .eq("is_bank_account", true)
      .limit(1)
      .single();

    if (bankErr || !bankAccount) {
      throw bankErr || new Error("Bank account not found");
    }

    const bankAccountId = bankAccount.id;

    // 4) Create journal entry
    const { data: je, error: jeErr } = await supabaseAdmin
      .from("journal_entries")
      .insert({
        date: tx.date,
        description: tx.description || `Categorised as ${category_name}`,
      })
      .select("id")
      .single();

    if (jeErr || !je) throw jeErr || new Error("Failed to create journal entry");

    const journalEntryId = je.id;

    // 5) Build double-entry lines
    const absAmount = Math.abs(amount);

    const lines =
      amount < 0
        ? [
            {
              journal_entry_id: journalEntryId,
              account_id: categoryAccountId,
              debit: absAmount,
              credit: 0,
            },
            {
              journal_entry_id: journalEntryId,
              account_id: bankAccountId,
              debit: 0,
              credit: absAmount,
            },
          ]
        : [
            {
              journal_entry_id: journalEntryId,
              account_id: bankAccountId,
              debit: absAmount,
              credit: 0,
            },
            {
              journal_entry_id: journalEntryId,
              account_id: categoryAccountId,
              debit: 0,
              credit: absAmount,
            },
          ];

    const { error: jlErr } = await supabaseAdmin
      .from("journal_lines")
      .insert(lines);

    if (jlErr) throw jlErr;

    // 6) Update transaction: link JE + mark reconciled + store category
    const { error: txUpdateErr } = await supabaseAdmin
      .from("transactions")
      .update({
        business_category: category_name,
        coa_id: categoryAccountId,
        journal_entry_id: journalEntryId,
        is_reconciled: true,
      })
      .eq("id", transaction_id);

    if (txUpdateErr) throw txUpdateErr;

    return res.status(200).json({
      success: true,
      journal_entry_id: journalEntryId,
    });
  } catch (err: any) {
    console.error("Categorise transaction error:", err);
    return res.status(500).json({ error: err.message });
  }
}
