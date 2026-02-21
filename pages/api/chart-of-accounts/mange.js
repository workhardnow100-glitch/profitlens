// pages/api/chart-of-accounts/manage.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

/**
 * Generate the next account code within a client's CoA.
 * For now: simple numeric increment, starting at 1000.
 * Later we can swap this for full UK range logic.
 */
async function generateNextCode(coaId) {
  const { data, error } = await supabaseAdmin
    .from("chart_of_account_entries")
    .select("account_code")
    .eq("coa_id", coaId)
    .order("account_code", { ascending: false })
    .limit(1);

  if (error) {
    console.error("generateNextCode error:", error);
    // Fallback to 1000 if we can't read existing codes
    return "1000";
  }

  if (!data || data.length === 0) {
    return "1000";
  }

  const lastCode = data[0].account_code;
  const lastNumeric = parseInt(lastCode, 10);

  if (isNaN(lastNumeric)) {
    // If last code isn't numeric, just start at 1000
    return "1000";
  }

  return String(lastNumeric + 1);
}

// Optional: guardrails for allowed types/buckets (aligned with your enums)
const ALLOWED_ACCOUNT_TYPES = [
  "INCOME",
  "EXPENSE",
  "SYSTEM",
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "BANK",
  "ACCOUNTS_RECEIVABLE",
  "ACCOUNTS_PAYABLE",
  "VAT_CONTROL",
  "CONTROL",
];

const ALLOWED_HMRC_BUCKETS = [
  "income",
  "allowable",
  "disallowable",
  "ignore",
  "system",
  "balance_sheet",
  "assets",
  "liabilities",
  "equity",
  "vat",
  "control",
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const clientId = session.user.actingAsClientId || session.user.clientId;
  if (!clientId) {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  const { action, payload } = req.body;

  // Fetch COA header for this client
  const { data: header, error: headerError } = await supabaseAdmin
    .from("chart_of_accounts")
    .select("id")
    .eq("client_id", clientId)
    .single();

  if (headerError || !header) {
    console.error("COA header error:", headerError);
    return res.status(400).json({ error: "No COA found for this client" });
  }

  // ---------------------------
  // ⭐ ADD ACCOUNT
  // ---------------------------
  if (action === "add") {
    try {
      const { name, type, bucket, description } = payload || {};

      if (!name || !type || !bucket) {
        return res
          .status(400)
          .json({ error: "Name, type, and HMRC bucket are required" });
      }

      if (!ALLOWED_ACCOUNT_TYPES.includes(type)) {
        return res.status(400).json({ error: "Invalid account type" });
      }

      if (!ALLOWED_HMRC_BUCKETS.includes(bucket)) {
        return res.status(400).json({ error: "Invalid HMRC bucket" });
      }

      const accountCode = await generateNextCode(header.id);

      const { error } = await supabaseAdmin
        .from("chart_of_account_entries")
        .insert([
          {
            coa_id: header.id,
            account_name: name,
            account_type: type,
            hmrc_bucket: bucket,
            description: description || null,
            is_system: false,
            has_activity: false,
            account_code: accountCode, // ✅ no longer null
          },
        ]);

      if (error) {
        console.error("ADD account error:", error);
        return res
          .status(500)
          .json({ error: error.message || "Failed to add account" });
      }

      return res.status(200).json({ success: true });
    } catch (e) {
      console.error("ADD account exception:", e);
      return res
        .status(500)
        .json({ error: e.message || "Failed to add account" });
    }
  }

  // ---------------------------
  // ⭐ UPDATE ACCOUNT
  // ---------------------------
  if (action === "update") {
    try {
      const { id, name, type, bucket, description } = payload || {};

      if (!id) {
        return res.status(400).json({ error: "Account ID is required" });
      }

      // Validate ownership + flags
      const { data: account, error: accountError } = await supabaseAdmin
        .from("chart_of_account_entries")
        .select("id, coa_id, is_system, has_activity, account_type, hmrc_bucket")
        .eq("id", id)
        .single();

      if (accountError || !account) {
        console.error("UPDATE fetch account error:", accountError);
        return res.status(404).json({ error: "Account not found" });
      }

      if (account.coa_id !== header.id) {
        return res.status(403).json({ error: "Not allowed" });
      }

      // Guardrails: system accounts cannot change type/bucket
      if (account.is_system) {
        // Allow name/description tweaks, but lock type/bucket
        const { error } = await supabaseAdmin
          .from("chart_of_account_entries")
          .update({
            account_name: name ?? account.account_name,
            description: description ?? account.description,
          })
          .eq("id", id);

        if (error) {
          console.error("UPDATE system account error:", error);
          return res
            .status(500)
            .json({ error: error.message || "Failed to update account" });
        }

        return res.status(200).json({ success: true });
      }

      // For non-system accounts, validate type/bucket if provided
      if (type && !ALLOWED_ACCOUNT_TYPES.includes(type)) {
        return res.status(400).json({ error: "Invalid account type" });
      }

      if (bucket && !ALLOWED_HMRC_BUCKETS.includes(bucket)) {
        return res.status(400).json({ error: "Invalid HMRC bucket" });
      }

      const updatePayload = {
        account_name: name ?? account.account_name,
        description: description ?? account.description,
      };

      if (type) updatePayload.account_type = type;
      if (bucket) updatePayload.hmrc_bucket = bucket;

      const { error } = await supabaseAdmin
        .from("chart_of_account_entries")
        .update(updatePayload)
        .eq("id", id);

      if (error) {
        console.error("UPDATE account error:", error);
        return res
          .status(500)
          .json({ error: error.message || "Failed to update account" });
      }

      return res.status(200).json({ success: true });
    } catch (e) {
      console.error("UPDATE account exception:", e);
      return res
        .status(500)
        .json({ error: e.message || "Failed to update account" });
    }
  }

  // ---------------------------
  // ⭐ DELETE ACCOUNT
  // ---------------------------
  if (action === "delete") {
    try {
      const { id } = payload || {};

      if (!id) {
        return res.status(400).json({ error: "Account ID is required" });
      }

      const { data: account, error: accountError } = await supabaseAdmin
        .from("chart_of_account_entries")
        .select("id, coa_id, is_system, has_activity")
        .eq("id", id)
        .single();

      if (accountError || !account) {
        console.error("DELETE fetch account error:", accountError);
        return res.status(404).json({ error: "Account not found" });
      }

      if (account.coa_id !== header.id) {
        return res.status(403).json({ error: "Not allowed" });
      }

      if (account.is_system) {
        return res
          .status(400)
          .json({ error: "Cannot delete system accounts" });
      }

      if (account.has_activity) {
        return res
          .status(400)
          .json({ error: "Cannot delete accounts with activity" });
      }

      const { error } = await supabaseAdmin
        .from("chart_of_account_entries")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("DELETE account error:", error);
        return res
          .status(500)
          .json({ error: error.message || "Failed to delete account" });
      }

      return res.status(200).json({ success: true });
    } catch (e) {
      console.error("DELETE account exception:", e);
      return res
        .status(500)
        .json({ error: e.message || "Failed to delete account" });
    }
  }

  return res.status(400).json({ error: "Unknown action" });
}
