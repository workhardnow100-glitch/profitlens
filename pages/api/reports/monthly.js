// pages/api/monthly-reports.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { format } from "date-fns";

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
      .select("date, amount, category")
      .eq("client_id", clientId); // ✅ strict scoping

    if (error) {
      console.error("Supabase fetch error:", error.message);
      return res.status(500).json({ error: "Failed to fetch transactions" });
    }

    const monthlyMap = {};

    for (const tx of transactions) {
      const month = format(new Date(tx.date), "MMMM yyyy");
      if (!monthlyMap[month]) {
        monthlyMap[month] = { revenue: 0, expenses: 0, categories: {} };
      }

      const amount = parseFloat(tx.amount) || 0;
      const category = tx.category || "Uncategorized";

      if (!monthlyMap[month].categories[category]) {
        monthlyMap[month].categories[category] = 0;
      }
      monthlyMap[month].categories[category] += amount;

      if (amount > 0) {
        monthlyMap[month].revenue += amount;
      } else {
        monthlyMap[month].expenses += -amount; // ✅ accumulate as positive
      }
    }

    const monthlyReports = Object.entries(monthlyMap).map(([month, stats]) => ({
      month,
      revenue: stats.revenue.toFixed(2),
      expenses: stats.expenses.toFixed(2),
      net: (stats.revenue - stats.expenses).toFixed(2),
      categories: Object.entries(stats.categories).map(([name, amount]) => ({
        name,
        amount: amount.toFixed(2),
      })),
    }));

    // ✅ Audit log
    await supabaseAdmin.from("audit").insert([{
      client_id: clientId,
      user: session.user.email,
      action: "FETCH_MONTHLY_REPORTS",
      details: `Returned ${transactions.length} transactions`,
      timestamp: new Date().toISOString(),
    }]);

    res.status(200).json({ monthlyReports });
  } catch (err) {
    console.error("Monthly report error:", err.message);
    res.status(500).json({ error: "Failed to generate monthly report" });
  }
}
