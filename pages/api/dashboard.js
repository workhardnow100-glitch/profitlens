// pages/api/dashboard.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { CT_MAP } from "../../lib/constants/ctMap";
import { SYSTEM_CATEGORIES } from "../../lib/constants/systemCategories";

// ✅ Build unified allowed category list
const ALLOWED_CATEGORIES = new Set([
  ...CT_MAP.income,
  ...CT_MAP.allowable,
  ...CT_MAP.disallowable,
  ...CT_MAP.ignore,
  ...SYSTEM_CATEGORIES,
  "Uncategorised",
]);

// ✅ Build lowercase sets for classification
const MAP = {
  income: new Set(CT_MAP.income.map((c) => c.toLowerCase())),
  allowable: new Set(CT_MAP.allowable.map((c) => c.toLowerCase())),
  disallowable: new Set(CT_MAP.disallowable.map((c) => c.toLowerCase())),
  ignore: new Set(CT_MAP.ignore.map((c) => c.toLowerCase())),
};

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );
  if (!(isFounder || isSubscribedOrTrial))
    return res.status(403).json({ error: "Upgrade required" });

  const clientId = session.user.clientId;
  if (!clientId || clientId === "unknown-client")
    return res.status(400).json({ error: "Invalid client ID" });

  // ✅ PATCH — update category (validated)
  if (req.method === "PATCH") {
    try {
      const { id, category } = req.body || {};
      if (!id || !category)
        return res.status(400).json({ error: "Missing id or category" });

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
          user: session.user.email,
          action: "UPDATE_CATEGORY",
          details: `Updated transaction ${id} category to ${category}`,
          timestamp: new Date().toISOString(),
        },
      ]);

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("PATCH error:", err?.message || err);
      return res.status(500).json({ error: "Failed to update category" });
    }
  }

  // ✅ DELETE — delete all transactions
  if (req.method === "DELETE") {
    try {
      const { count, error } = await supabaseAdmin
        .from("transactions")
        .delete({ count: "exact" })
        .eq("client_id", clientId);
      if (error) throw error;

      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          user: session.user.email,
          action: "DELETE_TRANSACTIONS",
          details: `Deleted ${count} transactions`,
          timestamp: new Date().toISOString(),
        },
      ]);

      return res.status(200).json({ success: true, deleted: count });
    } catch (err) {
      console.error("DELETE error:", err?.message || err);
      return res.status(500).json({ error: "Failed to delete transactions" });
    }
  }

  // ✅ GET — dashboard data (RAW, MATCHES PROFILE EXACTLY)
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
          category,
          accountNumber: tx.account_number || "-",
          sortCode: tx.sort_code || "-",
          storagePath: tx.storage_path || null,
        });

        // ✅ Count EVERYTHING (match Profile)
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
          user: session.user.email,
          action: "FETCH_DASHBOARD",
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
      console.error("Dashboard API error:", err?.message || err);
      return res.status(500).json({ error: "Failed to load dashboard data" });
    }
  }
}
