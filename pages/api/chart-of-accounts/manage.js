// pages/api/chart-of-accounts/manage.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

/**
 * UK code range configuration by account type.
 * This is opinionated but aligned with UK expectations.
 */
const RANGE_CONFIG = {
  BANK: { start: 1100, end: 1199 },
  ACCOUNTS_RECEIVABLE: { start: 1200, end: 1299 },
  ASSET: { start: 1300, end: 1999 },

  ACCOUNTS_PAYABLE: { start: 2100, end: 2199 },
  VAT_CONTROL: { start: 2200, end: 2299 },
  LIABILITY: { start: 2300, end: 2999 },

  EQUITY: { start: 3000, end: 3999 },

  INCOME: { start: 4000, end: 4999 },   // Sales
  EXPENSE: { start: 5000, end: 7999 },  // CoS + overheads

  CONTROL: { start: 9000, end: 9999 },
  SYSTEM: { start: 9000, end: 9999 },
};

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

/**
 * Get all existing numeric codes for a CoA within a range.
 */
async function getExistingCodesInRange(coaId, start, end) {
  const { data, error } = await supabaseAdmin
    .from("chart_of_account_entries")
    .select("account_code")
    .eq("coa_id", coaId);

  if (error || !data) return new Set();

  const used = new Set();
  for (const row of data) {
    const n = parseInt(row.account_code, 10);
    if (!isNaN(n) && n >= start && n <= end) {
      used.add(n);
    }
  }
  return used;
}

/**
 * Find the next available code in a given range.
 */
async function getNextCodeInRange(coaId, start, end) {
  const used = await getExistingCodesInRange(coaId, start, end);

  for (let code = start; code <= end; code++) {
    if (!used.has(code)) return code;
  }

  // Fallback: if range is exhausted, just go one above end
  return end + 1;
}

/**
 * Allocate a code for a new account based on its type.
 * Returns { code, rangeStart, rangeEnd, flags }.
 */
async function allocateCodeForAccount(coaId, type) {
  const cfg = RANGE_CONFIG[type] || RANGE_CONFIG.EXPENSE;
  const code = await getNextCodeInRange(coaId, cfg.start, cfg.end);

  const flags = {
    is_bank_account: type === "BANK",
    is_control_account:
      type === "CONTROL" || type === "VAT_CONTROL" || type === "SYSTEM",
    is_system_protected: false,
  };

  return {
    code: String(code),
    rangeStart: cfg.start,
    rangeEnd: cfg.end,
    flags,
  };
}

/**
 * Ensure system accounts exist for this CoA.
 * Auto-creates: 1100, 1200, 2100, 2200, 3200, 9998, 9999.
 */
async function ensureSystemAccounts(coaId) {
  const SYSTEM_ACCOUNTS = [
    {
      code: "1100",
      name: "Bank",
      type: "BANK",
      bucket: "balance_sheet",
      is_bank_account: true,
      is_control_account: false,
    },
    {
      code: "1200",
      name: "Accounts Receivable",
      type: "ACCOUNTS_RECEIVABLE",
      bucket: "assets",
      is_bank_account: false,
      is_control_account: false,
    },
    {
      code: "2100",
      name: "Accounts Payable",
      type: "ACCOUNTS_PAYABLE",
      bucket: "liabilities",
      is_bank_account: false,
      is_control_account: false,
    },
    {
      code: "2200",
      name: "VAT Control",
      type: "VAT_CONTROL",
      bucket: "vat",
      is_bank_account: false,
      is_control_account: true,
    },
    {
      code: "3200",
      name: "Retained Earnings",
      type: "EQUITY",
      bucket: "equity",
      is_bank_account: false,
      is_control_account: false,
    },
    {
      code: "9998",
      name: "Suspense",
      type: "CONTROL",
      bucket: "control",
      is_bank_account: false,
      is_control_account: true,
    },
    {
      code: "9999",
      name: "Rounding",
      type: "CONTROL",
      bucket: "control",
      is_bank_account: false,
      is_control_account: true,
    },
  ];

  const { data: existing, error } = await supabaseAdmin
    .from("chart_of_account_entries")
    .select("account_code")
    .eq("coa_id", coaId);

  if (error) {
    console.error("ensureSystemAccounts read error:", error);
    return;
  }

  const existingCodes = new Set(
    (existing || []).map((r) => String(r.account_code))
  );

  const toInsert = SYSTEM_ACCOUNTS.filter(
    (acc) => !existingCodes.has(acc.code)
  ).map((acc) => ({
    coa_id: coaId,
    account_code: acc.code,
    account_name: acc.name,
    account_type: acc.type,
    hmrc_bucket: acc.bucket,
    description: null,
    is_system: true,
    has_activity: false,
    code_range_start: RANGE_CONFIG[acc.type]?.start ?? null,
    code_range_end: RANGE_CONFIG[acc.type]?.end ?? null,
    is_bank_account: acc.is_bank_account,
    is_control_account: acc.is_control_account,
    is_system_protected: true,
  }));

  if (toInsert.length === 0) return;

  const { error: insertError } = await supabaseAdmin
    .from("chart_of_account_entries")
    .insert(toInsert);

  if (insertError) {
    console.error("ensureSystemAccounts insert error:", insertError);
  }
}

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

  const { action, payload } = req.body || {};

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

  // Always ensure system accounts exist before any operation
  await ensureSystemAccounts(header.id);

  // ---------------------------
  // ADD ACCOUNT
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

      const allocation = await allocateCodeForAccount(header.id, type);

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
            account_code: allocation.code,
            code_range_start: allocation.rangeStart,
            code_range_end: allocation.rangeEnd,
            is_bank_account: allocation.flags.is_bank_account,
            is_control_account: allocation.flags.is_control_account,
            is_system_protected: allocation.flags.is_system_protected,
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
  // UPDATE ACCOUNT
  // ---------------------------
  if (action === "update") {
    try {
      const { id, name, type, bucket, description } = payload || {};

      if (!id) {
        return res.status(400).json({ error: "Account ID is required" });
      }

      const { data: account, error: accountError } = await supabaseAdmin
        .from("chart_of_account_entries")
        .select(
          "id, coa_id, is_system, is_system_protected, has_activity, account_type, hmrc_bucket"
        )
        .eq("id", id)
        .single();

      if (accountError || !account) {
        console.error("UPDATE fetch account error:", accountError);
        return res.status(404).json({ error: "Account not found" });
      }

      if (account.coa_id !== header.id) {
        return res.status(403).json({ error: "Not allowed" });
      }

      // System-protected accounts: only allow name/description tweaks
      if (account.is_system || account.is_system_protected) {
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
  // DELETE ACCOUNT
  // ---------------------------
  if (action === "delete") {
    try {
      const { id } = payload || {};

      if (!id) {
        return res.status(400).json({ error: "Account ID is required" });
      }

      const { data: account, error: accountError } = await supabaseAdmin
        .from("chart_of_account_entries")
        .select("id, coa_id, is_system, is_system_protected, has_activity")
        .eq("id", id)
        .single();

      if (accountError || !account) {
        console.error("DELETE fetch account error:", accountError);
        return res.status(404).json({ error: "Account not found" });
      }

      if (account.coa_id !== header.id) {
        return res.status(403).json({ error: "Not allowed" });
      }

      if (account.is_system || account.is_system_protected) {
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
