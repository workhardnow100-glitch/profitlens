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

    // ⭐ Fetch transactions WITH COA JOIN
    const { data: transactions = [], error } = await supabaseAdmin
      .from("transactions")
      .select(
        `
        id,
        date,
        amount,
        is_reversal,
        includedinct,
        includedinvat,
        coa_id,
        chart_of_accounts (
          id,
          name,
          type
        )
      `
      )
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

    // ⭐ Process transactions (FULL COA ENGINE)
    for (const tx of transactions) {
      if (tx.is_reversal) continue;

      // Respect CT/VAT toggles
      if (tx.includedinct === false) continue;
      if (tx.includedinvat === false) continue;

      const key = formatMonthKey(tx.date);
      if (!key) continue;

      const amount = Number(tx.amount || 0);

      const coa = tx.chart_of_accounts;
      if (!coa) continue;

      const type = coa.type?.toLowerCase();

      // Ignore non-income/expense accounts
      if (type !== "income" && type !== "expense") continue;

      if (!monthly[key]) monthly[key] = { revenue: 0, expenses: 0 };

      // ⭐ COA-driven classification
      if (type === "income" && amount > 0) {
        monthly[key].revenue += amount;

        if (!categoriesTotals[coa.name])
          categoriesTotals[coa.name] = { revenue: 0, expenses: 0 };

        categoriesTotals[coa.name].revenue += amount;
      }

      if (type === "expense" && amount < 0) {
        const abs = Math.abs(amount);
        monthly[key].expenses += abs;

        if (!categoriesTotals[coa.name])
          categoriesTotals[coa.name] = { revenue: 0, expenses: 0 };

        categoriesTotals[coa.name].expenses += abs;
      }
    }

    // ⭐ Build forecast series
    const keys = Object.keys(monthly).sort();
    const months = keys.map(formatMonthLabel);
    const revenue = keys.map((k) => monthly[k].revenue);
    const expenses = keys.map((k) => monthly[k].expenses);
    const net = revenue.map((r, i) => r - expenses[i]);

    // ⭐ Forecast = average of last 3 months
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
