// pages/api/chart-of-accounts/index.js

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

// NEW: canonical UK chart of accounts
import { UK_COA } from "../../../lib/constants/ukCoa";

async function getOrCreateCoaHeader(clientId, userId) {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from("chart_of_accounts")
    .select("*")
    .eq("client_id", clientId)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    throw new Error(fetchError.message);
  }

  if (existing) return existing;

  const { data: created, error: insertError } = await supabaseAdmin
    .from("chart_of_accounts")
    .insert([{ client_id: clientId }])
    .select("*")
    .single();

  if (insertError) throw new Error(insertError.message);
  return created;
}

async function generateCoaForClient(clientId, userId) {
  const coaHeader = await getOrCreateCoaHeader(clientId, userId);

  // Remove old entries
  await supabaseAdmin
    .from("chart_of_account_entries")
    .delete()
    .eq("coa_id", coaHeader.id);

  const now = new Date().toISOString();

  // Build entries from canonical UK_COA
  const entries = UK_COA.map((acc) => ({
    coa_id: coaHeader.id,
    account_code: acc.account_code,
    account_name: acc.account_name,
    account_type: acc.account_type,
    hmrc_bucket: acc.hmrc_bucket,
    description: acc.description || null,
    is_system: acc.is_system ?? true,
    has_activity: false,
    code_range_start: acc.code_range_start || null,
    code_range_end: acc.code_range_end || null,
    is_control_account: acc.is_control_account ?? false,
    is_bank_account: acc.is_bank_account ?? false,
    is_system_protected: acc.is_system_protected ?? acc.is_system ?? false,
    created_at: now,
    updated_at: now,
  }));

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("chart_of_account_entries")
    .insert(entries)
    .select("*");

  if (insertError) throw new Error(insertError.message);

  return { header: coaHeader, entries: inserted || [] };
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );
  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  const clientId =
    session.user.actingAsClientId || session.user.clientId;

  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  try {
    if (req.method === "GET") {
      const usedOnly = req.query.usedOnly === "true";

      const { data: header, error: headerError } = await supabaseAdmin
        .from("chart_of_accounts")
        .select("id, client_id, created_at, updated_at")
        .eq("client_id", clientId)
        .single();

      if (headerError && headerError.code === "PGRST116") {
        return res.status(200).json({ accounts: [], meta: { clientId, count: 0 } });
      }
      if (headerError) {
        console.error("CoA header fetch error:", headerError.message);
        return res.status(500).json({ error: headerError.message });
      }

      let query = supabaseAdmin
        .from("chart_of_account_entries")
        .select("*")
        .eq("coa_id", header.id)
        .order("account_code", { ascending: true });

      if (usedOnly) {
        query = query.eq("has_activity", true);
      }

      const { data: entries, error: entriesError } = await query;

      if (entriesError) {
        console.error("CoA entries fetch error:", entriesError.message);
        return res.status(500).json({ error: entriesError.message });
      }

      if (session.user.role === "accountant") {
        await supabaseAdmin.from("audit").insert([
          {
            client_id: clientId,
            actor_email: session.user.email,
            action: "ACCOUNTANT_VIEW_CHART_OF_ACCOUNTS",
            details: "Viewed chart of accounts",
          },
        ]);
      }

      return res.status(200).json({
        accounts: entries || [],
        meta: {
          clientId,
          count: (entries || []).length,
          header,
        },
      });
    }

    if (req.method === "POST") {
      const result = await generateCoaForClient(
        clientId,
        session.user.id || null
      );

      if (session.user.role === "accountant") {
        await supabaseAdmin.from("audit").insert([
          {
            client_id: clientId,
            actor_email: session.user.email,
            action: "ACCOUNTANT_GENERATE_CHART_OF_ACCOUNTS",
            details: "Generated chart of accounts",
          },
        ]);
      }

      return res.status(200).json({
        accounts: result.entries,
        meta: {
          clientId,
          count: result.entries.length,
          header: result.header,
        },
      });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("❌ CoA API error:", err.message || err);
    return res.status(500).json({ error: "Failed to process chart of accounts" });
  }
}
