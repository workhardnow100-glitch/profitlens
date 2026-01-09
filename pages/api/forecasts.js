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
 *       • CT_MAP / SYSTEM_CATEGORIES
 *       • transaction schema
 *       • forecast logic
 *     MUST be reflected here and in the Forecasts UI.
 * ============================================================
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { supabaseAdmin } from "../../lib/supabase-admin";
import { CT_MAP } from "../../lib/constants/ctMap";
import { SYSTEM_CATEGORIES } from "../../lib/constants/systemCategories";
import { requireRole } from "../../lib/rbac";

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

const ALLOWED_CATEGORIES = new Set([
  ...CT_MAP.income,
  ...CT_MAP.allowable,
  ...CT_MAP.disallowable,
  ...CT_MAP.ignore,
  ...SYSTEM_CATEGORIES,
  "Uncategorised",
]);

const MAP = {
  income: new Set(CT_MAP.income.map((c) => c.toLowerCase())),
  allowable: new Set(CT_MAP.allowable.map((c) => c.toLowerCase())),
  disallowable: new Set(CT_MAP.disallowable.map((c) => c.toLowerCase())),
  ignore: new Set(CT_MAP.ignore.map((c) => c.toLowerCase())),
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ⭐ RBAC: USER, ACCOUNTANT, ADMIN, FOUNDER
    const guard = await requireRole(req, res, ["USER", "ACCOUNTANT", "ADMIN"]);
    if (!guard.ok) return;

    const role = guard.role;
    const isFounder = role === "FOUNDER";
    const isAccountant = role === "ACCOUNTANT";

    const subscriptionStatus = req?.session?.user?.subscriptionStatus || null;
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
      subscriptionStatus
    );

    // ⭐ Subscription gating (accountants + founders bypass)
    if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
      return res.status(403).json({ error: "Upgrade required" });
    }

    // ⭐ Accountant-aware client ID
    const clientId = isAccountant
      ? guard.actingAsClientId
      : guard.clientId || guard.defaultClientId;

    if (!clientId || clientId === "unknown-client") {
      return res.status(400).json({ error: "Invalid client ID" });
    }

    // ⭐ Audit: view forecasts
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: req.session?.user?.email || null,
        action: isAccountant ? "ACCOUNTANT_VIEW_FORECASTS" : "VIEW_FORECASTS",
        details: "Viewed forecasts",
        timestamp: new Date().toISOString(),
      },
    ]);

    const { data: transactions = [], error } = await supabaseAdmin
      .from("transactions")
      .select("date, amount, business_category, is_reversal")
      .eq("client_id", clientId);

    if (error) {
      console.error("❌ Supabase fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch transactions" });
    }

    if (!transactions.length) {
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

    const monthly = {};
    const categoriesTotals = {};

    for (const cat of ALLOWED_CATEGORIES) {
      categoriesTotals[cat] = { revenue: 0, expenses: 0 };
    }

    for (const tx of transactions) {
      if (tx.is_reversal) continue;

      const key = formatMonthKey(tx.date);
      if (!key) continue;

      const amount = tx.amount !== null ? parseFloat(tx.amount) : 0;

      let category = tx.business_category?.trim() || "Uncategorised";
      if (!ALLOWED_CATEGORIES.has(category)) category = "Uncategorised";

      const lower = category.toLowerCase();
      if (MAP.ignore.has(lower)) continue;

      if (!monthly[key]) monthly[key] = { revenue: 0, expenses: 0 };

      if (amount > 0) {
        monthly[key].revenue += amount;
        categoriesTotals[category].revenue += amount;
      } else if (amount < 0) {
        const abs = Math.abs(amount);
        monthly[key].expenses += abs;
        categoriesTotals[category].expenses += abs;
      }
    }

    const keys = Object.keys(monthly).sort();
    const months = keys.map(formatMonthLabel);
    const revenue = keys.map((k) => monthly[k].revenue);
    const expenses = keys.map((k) => monthly[k].expenses);
    const net = revenue.map((r, i) => r - expenses[i]);

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

    const categories = Object.entries(categoriesTotals)
      .filter(([name]) => !MAP.ignore.has(name.toLowerCase()))
      .map(([name, vals]) => ({
        name,
        revenue: `£${vals.revenue.toFixed(2)}`,
        expenses: `£${vals.expenses.toFixed(2)}`,
        net: `£${(vals.revenue - vals.expenses).toFixed(2)}`,
      }));

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
