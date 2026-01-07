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

  const role = (session.user.role || "").toUpperCase();
  const isFounder = role === "ADMIN" || role === "FOUNDER";
  const isAccountant = role === "ACCOUNTANT";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  // ⭐ Accountants + founders bypass subscription checks
  if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Accountant-aware client ID
  const clientId = isAccountant
    ? session.user.actingAsClientId
    : session.user.clientId;

  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  try {
    const { data: transactions, error } = await supabaseAdmin
      .from("transactions")
      .select("date, amount, business_category")
      .eq("client_id", clientId);

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
      const category = tx.business_category || "Uncategorised";

      if (!monthlyMap[month].categories[category]) {
        monthlyMap[month].categories[category] = 0;
      }
      monthlyMap[month].categories[category] += amount;

      if (amount > 0) {
        monthlyMap[month].revenue += amount;
      } else {
        monthlyMap[month].expenses += -amount;
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

    // ⭐ Audit log (accountant-aware)
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: session.user.email,
        action: isAccountant
          ? "ACCOUNTANT_FETCH_MONTHLY_REPORTS"
          : "FETCH_MONTHLY_REPORTS",
        details: `Returned ${transactions.length} transactions`,
        timestamp: new Date().toISOString(),
      },
    ]);

    res.status(200).json({ monthlyReports });
  } catch (err) {
    console.error("Monthly report error:", err.message);
    res.status(500).json({ error: "Failed to generate monthly report" });
  }
}
