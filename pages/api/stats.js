/**
 * ============================================================
 * File: pages/api/stats.js
 * Purpose:
 *   Provide high‑level financial statistics for a specific client:
 *     - Total revenue
 *     - Total expenses
 *     - Net profit
 *     - Revenue/expenses by category
 *     - Monthly profit curve
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: GET only.
 *   - Authentication:
 *       • Uses requireRole() to enforce USER / ACCOUNTANT / ADMIN / FOUNDER.
 *   - RBAC:
 *       • ACCOUNTANT:
 *           – May view stats for actingAsClientId.
 *       • USER:
 *           – May view stats for their own clientId.
 *       • FOUNDER:
 *           – May view stats for any client.
 *   - Subscription gating:
 *       • USER must be subscribed/trialing.
 *       • ACCOUNTANT + FOUNDER bypass subscription gating.
 *   - Data handling:
 *       • All reads are client‑scoped via client_id.
 *       • Ignores malformed dates and non‑numeric amounts.
 *   - Audit logging:
 *       • Logs FETCH_STATS / ACCOUNTANT_FETCH_STATS.
 *
 * Change Control:
 *   - Any change to:
 *       • transaction schema
 *       • category semantics
 *     MUST be reflected here and in the Stats UI.
 * ============================================================
 */

import { supabaseAdmin } from "../../lib/supabase-admin";
import { requireRole } from "../../lib/rbac";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ⭐ RBAC: USER, ACCOUNTANT, ADMIN, FOUNDER
  const guard = await requireRole(req, res, ["USER", "ACCOUNTANT", "ADMIN"]);
  if (!guard.ok) return;

  const role = guard.role;
  const isFounder = role === "FOUNDER";
  const isAccountant = role === "ACCOUNTANT";

  const subscriptionStatus = req?.session?.user?.subscriptionStatus;
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    subscriptionStatus
  );

  // ⭐ Subscription gating (accountants + founders bypass)
  if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Accountant-aware client ID
  const clientId = isAccountant ? guard.actingAsClientId : guard.clientId;

  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  try {
    const { data: transactions, error } = await supabaseAdmin
      .from("transactions")
      .select("date, amount, business_category")
      .eq("client_id", clientId);

    if (error) {
      console.error("Supabase fetch error:", error);
      return res.status(500).json({ message: "Failed to load stats" });
    }

    let totalRevenue = 0;
    let totalExpenses = 0;

    const revenueByCategoryMap = {};
    const expensesByCategoryMap = {};
    const monthlyProfitMap = {};

    for (const tx of transactions) {
      if (!tx?.date || typeof tx.amount !== "number") continue;

      const amount = tx.amount;
      const category = tx.business_category || "Uncategorised";
      const month = new Date(tx.date).toISOString().slice(0, 7);

      if (amount > 0) {
        totalRevenue += amount;
        revenueByCategoryMap[category] =
          (revenueByCategoryMap[category] || 0) + amount;
      } else {
        totalExpenses += amount; // negative number
        expensesByCategoryMap[category] =
          (expensesByCategoryMap[category] || 0) + Math.abs(amount);
      }

      monthlyProfitMap[month] = (monthlyProfitMap[month] || 0) + amount;
    }

    const revenueByCategory = Object.entries(revenueByCategoryMap).map(
      ([category, value]) => ({
        category,
        value: parseFloat(value.toFixed(2)),
      })
    );

    const expensesByCategory = Object.entries(expensesByCategoryMap).map(
      ([category, value]) => ({
        category,
        value: parseFloat(value.toFixed(2)),
      })
    );

    const monthlyProfit = Object.entries(monthlyProfitMap).map(
      ([month, profit]) => ({
        month,
        profit: parseFloat(profit.toFixed(2)),
      })
    );

    // ⭐ Audit log
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: req.session?.user?.email || "unknown",
        action: isAccountant ? "ACCOUNTANT_FETCH_STATS" : "FETCH_STATS",
        details: `Returned ${transactions.length} transactions`,
        timestamp: new Date().toISOString(),
      },
    ]);

    return res.status(200).json({
      revenue: totalRevenue.toFixed(2),
      expenses: Math.abs(totalExpenses).toFixed(2),
      netProfit: (totalRevenue + totalExpenses).toFixed(2),
      revenueByCategory,
      expensesByCategory,
      monthlyProfit,
    });
  } catch (err) {
    console.error("Error in /api/stats:", err);
    return res.status(500).json({ message: "Failed to load stats" });
  }
}
