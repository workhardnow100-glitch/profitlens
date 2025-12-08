// pages/api/dashboard.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const isFounder = session.user.role === "admin";
  const isSubscribed = ["basic", "pro"].includes(session.user.subscriptionStatus);

  if (!(isFounder || isSubscribed)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  const clientId = session.user.clientId;
  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  // --- DELETE route ---
  if (req.method === "DELETE") {
    try {
      const { count, error } = await supabaseAdmin
        .from("transactions")
        .delete({ count: "exact" })
        .eq("client_id", clientId);

      if (error) throw error;

      // Audit log
      await supabaseAdmin.from("audit").insert([{
        client_id: clientId,
        user: session.user.email,
        action: "DELETE_TRANSACTIONS",
        details: `Deleted ${count} transactions`,
        timestamp: new Date().toISOString(),
      }]);

      console.log("🧨 Deleted transactions for client:", clientId, "count:", count);
      return res.status(200).json({ success: true, deleted: count });
    } catch (err) {
      console.error("❌ DELETE error:", err.message || err);
      return res.status(500).json({ error: "Failed to delete transactions" });
    }
  }

  // --- GET route ---
  try {
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("id, date, amount, description, hmrc_category_id, account_number, sort_code, storage_path, type, is_reversal")
      .eq("client_id", clientId)
      .order("date", { ascending: false });
    if (txError) throw txError;

    // Fetch global HMRC categories
    const { data: hmrcCategories, error: catError } = await supabaseAdmin
      .from("hmrc_categories")
      .select("id, category_name, business_type, is_global, is_excluded")
      .eq("is_global", true);
    if (catError) throw catError;

    if (!transactions?.length) {
      return res.status(200).json({
        stats: [
          { label: "Total Revenue", value: "0.00" },
          { label: "Total Expenses", value: "0.00" },
          { label: "Net Profit", value: "0.00" },
        ],
        series: { months: [], revenue: [], expenses: [] },
        recent: [],
        breakdown: {},
      });
    }

    const monthly = {};
    const recent = [];
    const categoryBreakdown = {};

    let totalRevenue = 0;
    let totalExpenses = 0;

    for (const tx of transactions) {
      if (tx.is_reversal) continue;
      const date = new Date(tx.date);
      if (isNaN(date)) continue;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!monthly[monthKey]) monthly[monthKey] = { revenue: 0, expenses: 0 };

      const amount = tx.amount !== null ? parseFloat(tx.amount) : 0;
      const cat = hmrcCategories.find(c => c.id === tx.hmrc_category_id);
      const catName = cat?.category_name || "Uncategorised";

      // Skip excluded categories (Transfers, Insurance Payout, Disposal of Fixed Asset, etc.)
      if (cat?.is_excluded) continue;

      if (amount > 0) {
        totalRevenue += amount;
        monthly[monthKey].revenue += amount;
      } else if (amount < 0) {
        totalExpenses += Math.abs(amount);
        monthly[monthKey].expenses += Math.abs(amount);
        categoryBreakdown[catName] = (categoryBreakdown[catName] || 0) + Math.abs(amount);
      }

      if (amount !== 0) {
        recent.push({
          id: tx.id,
          date: date.toISOString().slice(0, 10),
          amount,
          description: tx.description || "",
          category: catName,
          accountNumber: tx.account_number || "-",
          sortCode: tx.sort_code || "-",
          storagePath: tx.storage_path || null,
        });
      }
    }

    const netProfit = totalRevenue - totalExpenses;

    // Audit log
    await supabaseAdmin.from("audit").insert([{
      client_id: clientId,
      user: session.user.email,
      action: "FETCH_DASHBOARD",
      details: `Returned ${transactions.length} transactions`,
      timestamp: new Date().toISOString(),
    }]);

    return res.status(200).json({
      stats: [
        { label: "Total Revenue", value: totalRevenue.toFixed(2) },
        { label: "Total Expenses", value: totalExpenses.toFixed(2) },
        { label: "Net Profit", value: netProfit.toFixed(2) },
      ],
      series: {
        months: Object.keys(monthly).sort(),
        revenue: Object.keys(monthly).sort().map(m => monthly[m].revenue),
        expenses: Object.keys(monthly).sort().map(m => monthly[m].expenses),
      },
      recent,
      breakdown: categoryBreakdown,
    });
  } catch (err) {
    console.error("Dashboard API error:", err.message || err);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
}
