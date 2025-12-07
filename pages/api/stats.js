// pages/api/stats.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isFounder = session.user.role === "admin";
  const isSubscribed = ["basic", "pro"].includes(session.user.subscriptionStatus);

  if (!(isFounder || isSubscribed)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  const clientId = session.user.clientId;
  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  try {
    const { data: transactions, error } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("client_id", clientId);   // ✅ scope by client_id

    if (error) {
      console.error("Supabase fetch error:", error.message);
      return res.status(500).json({ message: "Failed to load dashboard data" });
    }

    let totalRevenue = 0;
    let totalExpenses = 0;
    const revenueByCategoryMap = {};
    const expensesByCategoryMap = {};
    const monthlyProfitMap = {};

    for (const tx of transactions) {
      if (!tx?.date || typeof tx.amount !== "number") continue;

      const amount = tx.amount;
      const category = tx.category || "Uncategorized";
      const month = new Date(tx.date).toISOString().slice(0, 7); // YYYY-MM

      if (amount > 0) {
        totalRevenue += amount;
        revenueByCategoryMap[category] = (revenueByCategoryMap[category] || 0) + amount;
      } else {
        totalExpenses += amount;
        expensesByCategoryMap[category] = (expensesByCategoryMap[category] || 0) + Math.abs(amount);
      }

      monthlyProfitMap[month] = (monthlyProfitMap[month] || 0) + amount;
    }

    const revenueByCategory = Object.entries(revenueByCategoryMap).map(([category, value]) => ({
      category,
      value: parseFloat(value.toFixed(2)),
    }));

    const expensesByCategory = Object.entries(expensesByCategoryMap).map(([category, value]) => ({
      category,
      value: parseFloat(value.toFixed(2)),
    }));

    const monthlyProfit = Object.entries(monthlyProfitMap).map(([month, profit]) => ({
      month,
      profit: parseFloat(profit.toFixed(2)),
    }));

    // Optional: audit log
    // await supabaseAdmin.from("audit").insert([{
    //   client_id: clientId,
    //   user: session.user.email,
    //   action: "FETCH_STATS",
    //   details: `Returned ${transactions.length} transactions`,
    //   timestamp: new Date().toISOString(),
    // }]);

    res.status(200).json({
      revenue: totalRevenue.toFixed(2),
      expenses: Math.abs(totalExpenses).toFixed(2),
      netProfit: (totalRevenue + totalExpenses).toFixed(2),
      revenueByCategory,
      expensesByCategory,
      monthlyProfit,
    });
  } catch (err) {
    console.error("Error in /api/stats:", err);
    res.status(500).json({ message: "Failed to load dashboard data" });
  }
}
