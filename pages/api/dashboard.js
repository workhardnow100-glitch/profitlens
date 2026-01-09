/**
 * ============================================================
 * File: pages/api/dashboard.js
 * Purpose:
 *   Provide cockpit-grade dashboard data for a specific client:
 *     - Category updates (PATCH)
 *     - Bulk transaction deletion (DELETE)
 *     - Dashboard metrics + recent transactions (GET)
 *
 * Security / RBAC / SOC2 Notes:
 *   - Methods: GET, PATCH, DELETE only.
 *   - Authentication:
 *       • Uses requireRole() to enforce USER / ACCOUNTANT / ADMIN / FOUNDER.
 *   - RBAC:
 *       • ACCOUNTANT:
 *           – May READ dashboard data.
 *           – May NOT modify or delete transactions.
 *       • USER:
 *           – May READ + MODIFY + DELETE their own client’s data.
 *       • FOUNDER:
 *           – May act on any client via actingAsClientId/clientId.
 *   - Subscription gating:
 *       • USER must be subscribed/trialing to access dashboard.
 *       • ACCOUNTANT + FOUNDER bypass subscription gating.
 *   - Data handling:
 *       • All operations are client-scoped via client_id.
 *   - Audit logging:
 *       • Logs category updates, deletions, and dashboard fetches.
 *
 * Change Control:
 *   - Any change to:
 *       • CT_MAP / SYSTEM_CATEGORIES
 *       • transaction schema
 *     MUST be reflected here and in the Dashboard UI.
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

export default async function handler(req, res) {
  // ⭐ RBAC: USER, ACCOUNTANT, ADMIN, FOUNDER
  const guard = await requireRole(req, res, ["USER", "ACCOUNTANT", "ADMIN", "FOUNDER"]);
  if (!guard.ok) return;

  const role = guard.role;
  const isFounder = role === "FOUNDER";
  const isAccountant = role === "ACCOUNTANT";

  const subscriptionStatus = req?.session?.user?.subscriptionStatus || "incomplete";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(subscriptionStatus);

  // ⭐ Subscription gating (accountants + founders bypass)
  if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Accountant-aware client ID
  const clientId = guard.actingAsClientId || guard.clientId;

  // Everyone, including founders, must have a valid clientId for this endpoint
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
          action: isAccountant ? "ACCOUNTANT_UPDATE_CATEGORY" : "UPDATE_CATEGORY",
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
          action: isAccountant ? "ACCOUNTANT_DELETE_TRANSACTIONS" : "DELETE_TRANSACTIONS",
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
     ⭐ GET — dashboard data (everyone allowed)
  ------------------------------------------------------- */
  if (req.method === "GET") {
    try {
      const { data: transactions, error } = await supabaseAdmin
        .from("transactions")
        .select(
          "id, date, amount, description, business_category, account_number, sort_code, storage_path, type, is_reversal"
        )
        .eq("client_id", clientId)
        .order("date", { ascending: false });

      if (error) throw error;

      const monthly = {};
      const recent = [];
      const categoryBreakdown = {};

      for (const tx of transactions ?? []) {
        if (tx.is_reversal) continue;

        const date = new Date(tx.date);
        if (isNaN(date.getTime())) continue;

        const monthKey = `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;

        if (!monthly[monthKey]) {
          monthly[monthKey] = { revenue: 0, expenses: 0 };
        }

        const amount = tx.amount !== null ? parseFloat(tx.amount) : 0;
        const category = tx.business_category?.trim() || "Uncategorised";

        if (!categoryBreakdown[category]) categoryBreakdown[category] = 0;

        recent.push({
          id: tx.id,
          date: date.toISOString().slice(0, 10),
          amount,
          description: tx.description || "",
          business_category: category,
          accountNumber: tx.account_number || "-",
          sortCode: tx.sort_code || "-",
          storagePath: tx.storage_path || null,
        });

        if (amount > 0) {
          monthly[monthKey].revenue += amount;
        } else if (amount < 0) {
          monthly[monthKey].expenses += -amount;
          categoryBreakdown[category] += -amount;
        }
      }

      const months = Object.keys(monthly).sort();
      const revenue = months.map((m) => monthly[m].revenue);
      const expenses = months.map((m) => monthly[m].expenses);
      const totalRevenue = revenue.reduce((a, b) => a + b, 0);
      const totalExpenses = expenses.reduce((a, b) => a + b, 0);
      const netProfit = totalRevenue - totalExpenses;

      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: req.session?.user?.email || "unknown",
          action: isAccountant ? "ACCOUNTANT_FETCH_DASHBOARD" : "FETCH_DASHBOARD",
          details: `Returned ${transactions?.length ?? 0} transactions`,
          timestamp: new Date().toISOString(),
        },
      ]);

      return res.status(200).json({
        stats: [
          { label: "Total Revenue", value: totalRevenue.toFixed(2) },
          { label: "Total Expenses", value: totalExpenses.toFixed(2) },
          { label: "Net Profit", value: netProfit.toFixed(2) },
        ],
        series: { months, revenue, expenses },
        recent,
        breakdown: categoryBreakdown,
        categories: Object.keys(categoryBreakdown),
      });
    } catch (err) {
      console.error("Dashboard API error:", err);
      return res.status(500).json({ error: "Failed to load dashboard data" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
