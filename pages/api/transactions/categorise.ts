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

    // 0) Ignore "Uncategorised" — no journal should be created
    if (category_name.trim() === "Uncategorised") {
      return res.status(200).json({
        success: true,
        journal_entry_id: null,
        message: "Uncategorised selected — no journal created",
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

    // 2) Prevent duplicate journals (re-categorisation)
    if (tx.journal_entry_id) {
      return res.status(200).json({
        success: true,
        journal_entry_id: tx.journal_entry_id,
        message: "Journal already exists — skipping creation",
      });
    }

    // 3) Resolve COA account by account_name
    const { data: categoryAccount, error: catErr } = await supabaseAdmin
      .from("chart_of_account_entries")
      .select("id, account_name")
      .ilike("account_name", category_name.trim()) // case-insensitive
      .single();

    if (catErr || !categoryAccount) {
      throw new Error(
        `No COA account found for category_name: ${category_name}`
      );
    }

    const categoryAccountId = categoryAccount.id;

    // 4) Resolve the bank account (first is_bank_account = true)
    const { data: bankAccount, error: bankErr } = await supabaseAdmin
      .from("chart_of_account_entries")
      .select("id")
      .eq("is_bank_account", true)
      .limit(1)
      .single();

    if (bankErr || !bankAccount) {
      throw new Error("Bank account not found");
    }

    const bankAccountId = bankAccount.id;

    // 5) Create journal entry (⭐ FIX: include client_id + user_id)
    const { data: je, error: jeErr } = await supabaseAdmin
      .from("journal_entries")
      .insert({
        date: tx.date,
        description: tx.description || `Categorised as ${category_name}`,
        client_id: tx.client_id,   // ⭐ REQUIRED
        user_id: tx.user_id,       // optional but recommended
      })
      .select("id")
      .single();

    if (jeErr || !je) throw jeErr || new Error("Failed to create journal entry");

    const journalEntryId = je.id;

    // 6) Build double-entry lines
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

    // 7) Update transaction
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
