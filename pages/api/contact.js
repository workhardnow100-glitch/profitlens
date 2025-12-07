// pages/api/clients.js
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
      .select("amount, description, category, client_name")
      .eq("client_id", clientId); // ✅ strict scoping

    if (error) {
      console.error("Supabase fetch error:", error.message);
      return res.status(500).json({ error: "Failed to fetch transactions" });
    }

    const clientMap = {};

    for (const tx of transactions) {
      const name = tx.client_name || "Unassigned";
      if (!clientMap[name]) {
        clientMap[name] = { revenue: 0, expenses: 0 };
      }

      const amount = tx.amount !== null ? parseFloat(tx.amount) : 0;
      if (amount > 0) {
        clientMap[name].revenue += amount;
      } else {
        clientMap[name].expenses += -amount; // ✅ accumulate as positive
      }
    }

    const clients = Object.entries(clientMap).map(([name, stats]) => ({
      name,
      revenue: stats.revenue.toFixed(2),
      expenses: stats.expenses.toFixed(2),
      net: (stats.revenue - stats.expenses).toFixed(2),
    }));

    // Optional: audit log
    // await supabaseAdmin.from("audit").insert([{
    //   client_id: clientId,
    //   user: session.user.email,
    //   action: "FETCH_CLIENT_SUMMARY",
    //   details: `Returned ${transactions.length} transactions`,
    //   timestamp: new Date().toISOString(),
    // }]);

    res.status(200).json({ clients });
  } catch (err) {
    console.error("❌ Client summary API error:", err.message);
    res.status(500).json({ error: "Failed to generate client summary" });
  }
}
