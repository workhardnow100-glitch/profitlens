/**
 * ============================================================
 * File: pages/api/forecasts.js
 * Purpose:
 *   Generate forward-looking revenue/expense/net profit forecasts
 *   for a specific client based on historical transactions.
 *
 *   Returns:
 *     - High-level forecast cards (Projected Revenue/Expenses/Net)
 *     - Time series (months, revenue, expenses, net)
 *     - Category-level breakdown (revenue/expenses/net per category)
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: GET only (read-only analytics).
 *   - Authentication:
 *       • Uses requireRole() to enforce USER / ACCOUNTANT / ADMIN / FOUNDER.
 *   - RBAC:
 *       • ACCOUNTANT:
 *           – May view forecasts for actingAsClientId.
 *       • USER:
 *           – May view forecasts for their own clientId/defaultClientId.
 *       • FOUNDER:
 *           – May view forecasts for any client via actingAsClientId/clientId.
 *   - Subscription gating:
 *       • USER must be subscribed/trialing to access forecasts.
 *       • ACCOUNTANT + FOUNDER bypass subscription gating.
 *   - Data handling:
 *       • Read-only access to transactions.
 *       • Ignores reversals and ignored categories.
 *   - Audit logging:
 *       • Logs VIEW_FORECASTS / ACCOUNTANT_VIEW_FORECASTS.
 *
 * Change Control:
 *   - Any change to:
 *     
 *       • transaction schema
 *       • forecast logic
 *     MUST be reflected here and in the Forecasts UI.
 * ============================================================
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { supabaseAdmin } from "../../lib/supabase-admin";
import { requireRole } from "../../lib/rbac";
import { CT_MAP } from "../../lib/constants/ctMap";

// ⭐ REAL revenue categories (Sales + trading income)
const REVENUE_CATEGORIES = new Set(
  CT_MAP.revenue || CT_MAP.income || [] // fallback if not yet renamed
);

// ⭐ Categories to ignore entirely (transfers, VAT, loan repayments, etc.)
const IGNORE_CATEGORIES = new Set(CT_MAP.ignore || []);

function formatMonthKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key) {
  const [year, month] = key.split("-");
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ⭐ RBAC
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

    const subscriptionStatus = req?.session?.user?.subscriptionStatus || null;
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
      subscriptionStatus
    );

    if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
      return res.status(403).json({ error: "Upgrade required" });
    }

    const clientId = guard.actingAsClientId || guard.clientId;
    if (!clientId || clientId === "unknown-client") {
      return res.status(400).json({ error: "Invalid client ID" });
    }

    // ⭐ Audit
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: req.session?.user?.email || null,
        action: isAccountant ? "ACCOUNTANT_VIEW_FORECASTS" : "VIEW_FORECASTS",
        details: "Viewed forecasts",
        timestamp: new Date().toISOString(),
      },
    ]);

    // ⭐ 1) Fetch transactions (MATCH DASHBOARD / REPORTS ENGINE)
    const { data: transactions, error } = await supabaseAdmin
      .from("transactions")
      .select(`
        id,
        date,
        amount,
        description,
        business_category,
        type,
        is_reversal,
        coa_id,
        includedinct
      `)
      .eq("client_id", clientId)
      .order("date", { ascending: true });

    if (error) {
      console.error("❌ Forecasts: transaction fetch error", error);
      return res.status(500).json({ error: "Failed to fetch transactions" });
    }

    const txs = transactions ?? [];
    if (!txs.length) {
      return res.status(200).json({
        forecast: [
          { label: "Projected Revenue", value: "£0.00" },
          { label: "Projected Expenses", value: "£0.00" },
          { label: "Projected Net Profit", value: "£0.00" },
        ],
        series: { months: [], revenue: [], expenses: [], net: [] },
        categories: [],
      });
    }

    // ⭐ 2) Build COA map
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

      if (coaErr) {
        console.error("❌ Forecasts: COA fetch error", coaErr);
        return res.status(500).json({ error: "Failed to fetch COA" });
      }

      (coaRows || []).forEach((row) => {
        coaMap.set(row.id, row);
      });
    }

    // ⭐ 3) COA‑driven maths + CT_MAP categories
    const monthly = {};
    const categoriesTotals = {};

    for (const tx of txs) {
      if (tx.is_reversal) continue;

      // ⭐ Dashboard/Reports rule: only includedinct matters
      if (tx.includedinct === false) continue;

      const key = formatMonthKey(tx.date);
      if (!key) continue;

      const amount = Number(tx.amount || 0);
      if (!amount) continue;

      const coa = tx.coa_id ? coaMap.get(tx.coa_id) : null;
      if (!coa) continue;

      const accType = (coa.account_type || "").toUpperCase();

      // ⭐ Ignore control/bank/balance sheet accounts
      const isControl =
        coa.is_control_account ||
        coa.is_bank_account ||
        ["control", "system", "balance_sheet", "equity", "liabilities", "assets"]
          .includes((coa.hmrc_bucket || "").toLowerCase());

      if (isControl) continue;

      if (accType !== "INCOME" && accType !== "EXPENSE") continue;

      // ⭐ Category label = CT_MAP category from transaction
      const category =
        (tx.business_category && String(tx.business_category).trim()) ||
        "Uncategorised";

      // Ignore transfers / non‑P&L movements
      if (IGNORE_CATEGORIES.has(category)) continue;

      if (!monthly[key]) monthly[key] = { revenue: 0, expenses: 0 };

      if (!categoriesTotals[category]) {
        categoriesTotals[category] = { revenue: 0, expenses: 0 };
      }

      // ⭐ REAL REVENUE ONLY (Sales + trading income)
      if (
        accType === "INCOME" &&
        amount > 0 &&
        REVENUE_CATEGORIES.has(category)
      ) {
        monthly[key].revenue += amount;
        categoriesTotals[category].revenue += amount;
      }

      // ⭐ REAL EXPENSES ONLY
      if (accType === "EXPENSE" && amount < 0) {
        const abs = Math.abs(amount);
        monthly[key].expenses += abs;
        categoriesTotals[category].expenses += abs;
      }
    }

    // ⭐ 4) Build series
    const keys = Object.keys(monthly).sort();
    const months = keys.map(formatMonthLabel);
    const revenue = keys.map((k) => monthly[k].revenue);
    const expenses = keys.map((k) => monthly[k].expenses);
    const net = revenue.map((r, i) => r - expenses[i]);

    // ⭐ 5) Forecast = average of last 3 months (REAL profit engine)
    const recentRevenue = revenue.slice(-3);
    const recentExpenses = expenses.slice(-3);

    const avgRevenue =
      recentRevenue.length > 0
        ? recentRevenue.reduce((a, b) => a + b, 0) / recentRevenue.length
        : 0;

    const avgExpenses =
      recentExpenses.length > 0
        ? recentExpenses.reduce((a, b) => a + b, 0) / recentExpenses.length
        : 0;

    const avgNet = avgRevenue - avgExpenses;

    const categories = Object.entries(categoriesTotals).map(
      ([name, vals]) => ({
        name,
        revenue: `£${vals.revenue.toFixed(2)}`,
        expenses: `£${vals.expenses.toFixed(2)}`,
        net: `£${(vals.revenue - vals.expenses).toFixed(2)}`,
      })
    );

    return res.status(200).json({
      forecast: [
        { label: "Projected Revenue", value: `£${avgRevenue.toFixed(2)}` },
        { label: "Projected Expenses", value: `£${avgExpenses.toFixed(2)}` },
        { label: "Projected Net Profit", value: `£${avgNet.toFixed(2)}` },
      ],
      series: { months, revenue, expenses, net },
      categories,
    });
  } catch (err) {
    console.error("❌ Forecast API error:", err);
    return res.status(500).json({ error: "Failed to generate forecast" });
  }
}
