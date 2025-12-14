// lib/db.js
import { supabaseAdmin } from "./supabase-admin";

export async function getTransactionsByClient(clientId) {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("id, date, description, amount, category, vat_rate, is_reversal")
    .eq("client_id", clientId);

  if (error) throw error;
  return (data || []).filter(tx => !tx.is_reversal);
}

export async function updateTransactionCategory(rowId, category) {
  const { error } = await supabaseAdmin
    .from("transactions")
    .update({ category })
    .eq("id", rowId);

  if (error) throw error;
}

export async function checkVatLock(clientId) {
  const { data, error } = await supabaseAdmin
    .from("vat_locks")
    .select("locked")
    .eq("client_id", clientId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data?.locked || false;
}

export async function lockVatPeriod(clientId) {
  const { error } = await supabaseAdmin
    .from("vat_locks")
    .upsert({ client_id: clientId, locked: true }, { onConflict: "client_id" });

  if (error) throw error;
}
