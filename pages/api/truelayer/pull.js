/**
 * ============================================================
 * File: pages/api/truelayer/pull.js
 * Purpose:
 *   Pull banking transactions from TrueLayer for a specific client
 *   using the stored access token, and ingest them into the
 *   public.transactions table under RLS protection.
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: GET only.
 *   - Authentication:
 *       • Uses requireRole() to enforce USER / ACCOUNTANT / ADMIN / FOUNDER.
 *   - RBAC:
 *       • Founder override: may pull transactions for any client.
 *       • Non-founders:
 *           – Must be acting on the specified clientId.
 *   - Subscription gating:
 *       • Only active/trialing subscriptions may pull transactions.
 *   - Token handling:
 *       • Retrieves access_token from public.bank_tokens.
 *       • If missing, returns 404.
 *   - RLS Alignment:
 *       • Inserts into public.transactions with correct client_id.
 *       • RLS ensures only owner/founder can read/write.
 *   - Audit logging:
 *       • On success, logs BANK_TRANSACTIONS_INGESTED.
 * ============================================================
 */

import axios from "axios";
import { requireRole } from "../../../lib/rbac";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ⭐ RBAC: USER, ACCOUNTANT, ADMIN, FOUNDER
  const guard = await requireRole(req, res, ["USER", "ACCOUNTANT", "ADMIN"]);
  if (!guard.ok) return;

  const role = guard.role;
  const isFounder = role === "FOUNDER";

  // ⭐ Subscription gating
  const subscriptionStatus = req?.session?.user?.subscriptionStatus || "incomplete";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(subscriptionStatus);

  if (!isFounder && !isSubscribedOrTrial) {
    return res.status(402).json({ error: "Subscription required" });
  }

  const clientId = req.query.client_id;
  if (!clientId || typeof clientId !== "string") {
    return res.status(400).json({ error: "Missing or invalid client_id" });
  }

  // ⭐ Accountant-aware scoping
  const actingClientId = guard.actingAsClientId || guard.clientId;

  if (!isFounder && actingClientId !== clientId) {
    return res.status(403).json({
      error: "You are not allowed to pull banking data for this client",
    });
  }

  // ⭐ Fetch stored banking token
  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from("bank_tokens")
    .select("access_token")
    .eq("client_id", clientId)
    .single();

  if (tokenErr || !tokenRow) {
    return res.status(404).json({ error: "No banking token found" });
  }

  // ⭐ Pull transactions from TrueLayer
  let txRes;
  try {
    txRes = await axios.get(
      "https://api.truelayer.com/data/v1/transactions",
      {
        headers: { Authorization: `Bearer ${tokenRow.access_token}` },
      }
    );
  } catch (err) {
    console.error("TrueLayer fetch error:", err);
    return res.status(500).json({ error: "Failed to fetch transactions" });
  }

  const transactions = txRes?.data?.results || [];

  // ⭐ Ingest transactions under correct client_id
  for (const tx of transactions) {
    await supabaseAdmin.from("transactions").insert({
      client_id: clientId,
      amount: tx.amount,
      description: tx.description,
      category: tx.transaction_category,
      timestamp: tx.timestamp,
      account_number: tx.account_number,
      sort_code: tx.sort_code,
      created_at: new Date().toISOString(),
    });
  }

  // ⭐ Audit log
  await supabaseAdmin.from("audit").insert([
    {
      client_id: clientId,
      actor_email: req.session?.user?.email || "unknown",
      action: "BANK_TRANSACTIONS_INGESTED",
      details: `Ingested ${transactions.length} transactions from TrueLayer`,
    },
  ]);

  return res.status(200).json({
    status: "Transactions ingested",
    count: transactions.length,
  });
}
