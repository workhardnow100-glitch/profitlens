// pages/api/mtd-dashboards.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Example calculation functions
function calculateCIS(expenses) {
  // e.g. 20% of subcontractor-related expenses
  return round2(expenses * 0.20);
}

function calculateVAT(income) {
  // e.g. 20% of vatable sales
  return round2(income * 0.20);
}

function calculateCorpTax(income, expenses) {
  const profit = income + expenses; // expenses are negative
  return round2(profit > 0 ? profit * 0.19 : 0);
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action, clientId } = req.body;
  if (!clientId) return res.status(400).json({ error: "Missing clientId" });

  try {
    switch (action) {
      case "fetchSummary": {
        const { data, error } = await supabaseAdmin
          .from("transactions")
          .select("amount, category, is_reversal")
          .eq("client_id", clientId);

        if (error) return res.status(500).json({ error: error.message });

        const valid = (data || []).filter(tx => !tx.is_reversal);

        const totalIncome = valid
          .filter(tx => tx.category === "income")
          .reduce((s, tx) => s + tx.amount, 0);

        const totalExpenses = valid
          .filter(tx => tx.category === "expense")
          .reduce((s, tx) => s + tx.amount, 0);

        const cis = calculateCIS(totalExpenses);
        const vat = calculateVAT(totalIncome);
        const corp = calculateCorpTax(totalIncome, totalExpenses);

        const netProfit = round2(totalIncome + totalExpenses - cis - vat - corp);

        return res.status(200).json({
          totals: {
            income: round2(totalIncome),
            expenses: round2(totalExpenses),
            cis,
            vat,
            corp,
            net_profit: netProfit,
          },
        });
      }

      default:
        return res.status(400).json({ error: "Unknown action" });
    }
  } catch (err) {
    console.error("MTD Dashboards API error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
