/**
 * ============================================================
 * File: pages/api/dashboard.js
 * Purpose:
 *   COA-driven cockpit dashboard for a specific client:
 *     - Category updates (PATCH)
 *     - Bulk transaction deletion (DELETE)
 *     - Dashboard metrics + recent transactions (GET)
 *
 * Notes:
 *   - UI still shows transaction.business_category (user-facing)
 *   - All calculations use COA + HMRC buckets + toggles
 *   - Mirrors CT/VAT logic: ignores transfers, loans, bank, control, BS
 * ============================================================
 */
import { supabaseAdmin } from "../../lib/supabase-admin";
import { CT_MAP } from "../../lib/constants/ctMap";
import { SYSTEM_CATEGORIES } from "../../lib/constants/systemCategories";
import { requireRole } from "../../lib/rbac";

const ALLOWED_CATEGORIES = new Set([
  ...CT_MAP.income,
  ...CT_MAP.allowable,
  ...CT_MAP.disallowable,
  ...CT_MAP.ignore,
  ...SYSTEM_CATEGORIES,
  "Uncategorised",
]);

// ✅ Fast lookup sets for CT_MAP groups
const INCOME_SET = new Set(CT_MAP.income);
const ALLOWABLE_SET = new Set(CT_MAP.allowable);
const DISALLOWABLE_SET = new Set(CT_MAP.disallowable);
const IGNORE_SET = new Set(CT_MAP.ignore);

export default async function handler(req, res) {
  // ⭐ RBAC: USER, ACCOUNTANT, ADMIN, FOUNDER
  const guard = await requireRole(req, res, [
    "USER",
    "ACCOUNTANT",
    "ADMIN",
    "FOUNDER",
  ]);
  if (!guard.ok) return;

  const role = guard.role;
  const isFounder = role === "FOUNDER";
  const isAccountant = role === "ACCOUNTANT";

  const subscriptionStatus =
    req?.session?.user?.subscriptionStatus || "incomplete";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    subscriptionStatus
  );

  // ⭐ Subscription gating (accountants + founders bypass)
  if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Accountant-aware client ID
  const clientId = guard.actingAsClientId || guard.clientId;

  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  /* -------------------------------------------------------
     ⭐ PATCH — update category (business owners only)
  ------------------------------------------------------- */
  if (req.method === "PATCH") {
    if (isAccountant) {
      return res.status(403).json({ error: "Accountants cannot modify data" });
    }

    try {
      const { id, category } = req.body || {};
      if (!id || !category) {
        return res.status(400).json({ error: "Missing id or category" });
      }

      if (!ALLOWED_CATEGORIES.has(category)) {
        return res.status(400).json({
          error: `Invalid category: "${category}". Must be a defined HMRC category.`,
        });
      }

      const { error: updateErr } = await supabaseAdmin
        .from("transactions")
        .update({ business_category: category })
        .eq("id", id)
        .eq("client_id", clientId);

      if (updateErr) throw updateErr;

      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: req.session?.user?.email || "unknown",
          action: isAccountant
            ? "ACCOUNTANT_UPDATE_CATEGORY"
            : "UPDATE_CATEGORY",
          details: `Updated transaction ${id} category to ${category}`,
          timestamp: new Date().toISOString(),
        },
      ]);

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("PATCH error:", err);
      return res.status(500).json({ error: "Failed to update category" });
    }
  }

  /* -------------------------------------------------------
     ⭐ DELETE — delete all transactions (business owners only)
  ------------------------------------------------------- */
  if (req.method === "DELETE") {
    if (isAccountant) {
      return res.status(403).json({ error: "Accountants cannot delete data" });
    }

    try {
      const { count, error } = await supabaseAdmin
        .from("transactions")
        .delete({ count: "exact" })
        .eq("client_id", clientId);

      if (error) throw error;

      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: req.session?.user?.email || "unknown",
          action: isAccountant
            ? "ACCOUNTANT_DELETE_TRANSACTIONS"
            : "DELETE_TRANSACTIONS",
          details: `Deleted ${count} transactions`,
          timestamp: new Date().toISOString(),
        },
      ]);

      return res.status(200).json({ success: true, deleted: count });
    } catch (err) {
      console.error("DELETE error:", err);
      return res.status(500).json({ error: "Failed to delete transactions" });
    }
  }

  /* -------------------------------------------------------
     ⭐ GET — CT_MAP + COA‑driven dashboard data
  ------------------------------------------------------- */
  if (req.method === "GET") {
    try {
      // 1) Fetch transactions with COA + toggles
      const { data: transactions, error } = await supabaseAdmin
        .from("transactions")
        .select(
          `
          id,
          date,
          amount,
          description,
          business_category,
          account_number,
          sort_code,
          storage_path,
          type,
          is_reversal,
          coa_id,
          includedinct,
          includedinvat
        `
        )
        .eq("client_id", clientId)
        .order("date", { ascending: false });

      if (error) throw error;

      const txs = transactions ?? [];

      // 2) Build COA map
      const distinctCoaIds = Array.from(
        new Set(txs.map((t) => t.coa_id).filter(Boolean))
      );

      const coaMap = new Map();
      if (distinctCoaIds.length > 0) {
        const { data: coaRows, error: coaErr } = await supabaseAdmin
          .from("chart_of_account_entries")
          .select(
            "id, account_type, hmrc_bucket, is_control_account, is_bank_account"
          )
          .in("id", distinctCoaIds);

        if (coaErr) throw coaErr;
        (coaRows || []).forEach((row) => {
          coaMap.set(row.id, row);
        });
      }

      // 3) Aggregations (CT_MAP‑driven)
      const monthly = {};
      const recent = [];
      const categoryBreakdown = {}; // CT_MAP category names

      let totalRevenue = 0;
      let totalExpenses = 0;

      for (const tx of txs) {
        if (tx.is_reversal) continue;

        const date = new Date(tx.date);
        if (isNaN(date.getTime())) continue;

        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;

        if (!monthly[monthKey]) {
          monthly[monthKey] = { revenue: 0, expenses: 0 };
        }

        const amount = tx.amount !== null ? Number(tx.amount) : 0;

        // UI category (user-facing, CT_MAP‑driven)
        const uiCategory = (tx.business_category || "Uncategorised").trim();

        // Recent list: keep user category for UI
        recent.push({
          id: tx.id,
          date: date.toISOString().slice(0, 10),
          amount,
          description: tx.description || "",
          business_category: uiCategory,
          accountNumber: tx.account_number || "-",
          sortCode: tx.sort_code || "-",
          storagePath: tx.storage_path || null,
        });

        // COA‑driven guardrails (control / balance sheet)
        const coa = coaMap.get(tx.coa_id);
        if (!coa) continue;

        const bucket = coa.hmrc_bucket;
        const accType = coa.account_type;

        const isControl =
          bucket === "control" ||
          bucket === "system" ||
          bucket === "balance_sheet" ||
          bucket === "equity" ||
          bucket === "liabilities" ||
          bucket === "assets" ||
          coa.is_control_account ||
          coa.is_bank_account;

        if (isControl) continue;

        // Respect CT toggles for profit maths
        const includeForProfit = tx.includedinct !== false; // default true
        if (!includeForProfit) continue;

        // ❌ Ignore categories explicitly marked as ignore
        if (IGNORE_SET.has(uiCategory)) continue;

        const absAmount = Math.abs(amount);

        // ✅ Revenue: CT_MAP.income only, positive amounts, INCOME accounts
        if (INCOME_SET.has(uiCategory) && accType === "INCOME" && amount > 0) {
          totalRevenue += amount;
          monthly[monthKey].revenue += amount;

          if (!categoryBreakdown[uiCategory]) categoryBreakdown[uiCategory] = 0;
          categoryBreakdown[uiCategory] += absAmount;
          continue;
        }

        // ✅ Expenses: CT_MAP.allowable + CT_MAP.disallowable, negative amounts, EXPENSE accounts
        const isExpenseCategory =
          ALLOWABLE_SET.has(uiCategory) || DISALLOWABLE_SET.has(uiCategory);

        if (isExpenseCategory && accType === "EXPENSE" && amount < 0) {
          totalExpenses += absAmount;
          monthly[monthKey].expenses += absAmount;

          if (!categoryBreakdown[uiCategory]) categoryBreakdown[uiCategory] = 0;
          categoryBreakdown[uiCategory] += absAmount;
          continue;
        }

        // Anything else (non‑trading, transfers, weird buckets) is ignored for CT profit
      }

      const months = Object.keys(monthly).sort();
      const revenueSeries = months.map((m) => monthly[m].revenue);
      const expensesSeries = months.map((m) => monthly[m].expenses);
      const netProfit = totalRevenue - totalExpenses;

      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: req.session?.user?.email || "unknown",
          action: isAccountant
            ? "ACCOUNTANT_FETCH_DASHBOARD"
            : "FETCH_DASHBOARD",
          details: `Returned ${txs.length} transactions (CT_MAP + COA dashboard)`,
          timestamp: new Date().toISOString(),
        },
      ]);

      return res.status(200).json({
        stats: [
          { label: "Total Revenue", value: totalRevenue.toFixed(2) },
          { label: "Total Expenses", value: totalExpenses.toFixed(2) },
          { label: "Net Profit", value: netProfit.toFixed(2) },
        ],
        series: { months, revenue: revenueSeries, expenses: expensesSeries },
        recent,
        breakdown: categoryBreakdown, // CT_MAP category breakdown
        categories: Object.keys(categoryBreakdown),
      });
    } catch (err) {
      console.error("Dashboard API error:", err);
      return res.status(500).json({ error: "Failed to load dashboard data" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
