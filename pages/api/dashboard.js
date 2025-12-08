import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

// --- inferCategory logic ---
function inferCategory(type = "", description = "") {
  const normalized = type?.trim().toUpperCase() || "";

  if (normalized === "FPO") return "Payment";
  if (normalized === "TFR") return "Transfer";
  if (normalized === "CHG") return "Bank Charges";
  if (normalized === "DEB") return "Debit";
  if (normalized === "DD") return "Direct Debit";
  if (normalized === "SO") return "Standing Order";
  if (normalized === "INT") return "Interest";
  if (normalized === "FPI") return "Transfer In";
  if (normalized === "BP") return "Savings";
  if (normalized === "DEP") return "Bank Charge Waived";
  if (normalized === "PAY") return "Charges";
  if (normalized === "FEE") return "Bank Account Fee";
  if (normalized === "CPT") return "Cash Withdrawal";

  const rules = [
    { regex: /\bTESCO|SAINSBURY|MORRISONS|ASDA|ALDI|LIDL|WAITROSE\b/i, category: "Groceries" },
    { regex: /\bJUST\s*EAT|DELIVEROO|UBER\s*EATS|DOMINOS|MCDONALDS|KFC|SUBWAY|NANDO/i, category: "Food & Drink" },
    { regex: /\bAMAZON|EBAY|ARGOS|ETSY\b/i, category: "Shopping" },
    { regex: /\bUBER|LYFT|TAXI|TRAINLINE|NATIONAL\s*RAIL|TFL\b/i, category: "Transport" },
    { regex: /\bRYANAIR|EASYJET|JET2|BRITISH\s*AIRWAYS\b/i, category: "Travel" },
    { regex: /\bBP|SHELL|ESSO|TEXACO|PETROL|FUEL\b/i, category: "Fuel" },
    { regex: /\bBT|VODAFONE|O2|EE|THREE|SKY|VIRGIN\s*MEDIA\b/i, category: "Utilities" },
    { regex: /\bEON|EDF|SCOTTISH\s*POWER|NPOWER|OCTOPUS\s*ENERGY|BRITISH\s*GAS\b/i, category: "Utilities" },
    { regex: /\bNETFLIX|SPOTIFY|DISNEY|APPLE\s*MUSIC|AMAZON\s*PRIME|NOW\s*TV|YOUTUBE\s*PREMIUM\b/i, category: "Subscriptions" },
    { regex: /\bFACEBK|META\s*ADS|GOOGLE\s*ADS|LINKEDIN\s*ADS|TWITTER\s*ADS\b/i, category: "Advertising" },
    { regex: /\bHMRC|TAX|VAT|COMPANIES\s*HOUSE\b/i, category: "Business & Tax" },
    { regex: /\bBOOTS|SUPERDRUG|PHARMACY|NHS\b/i, category: "Health" },
    { regex: /\bAVIVA|AXA|DIRECT\s*LINE|LV=|INSURANCE\b/i, category: "Insurance" },
    { regex: /\bCINEMA|ODEON|VUE|THEATRE|TICKETMASTER|EVENTBRITE\b/i, category: "Entertainment" },
    { regex: /\bGYM|PUREGYM|DAVID\s*LLOYD|FITNESS\b/i, category: "Fitness" },
  ];

  for (const rule of rules) {
    if (rule.regex.test(description)) return rule.category;
  }
  return "Other";
}
// --- End inferCategory ---

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const isFounder = session.user.role === "admin";
  const isSubscribed = ["basic", "pro"].includes(session.user.subscriptionStatus);
  if (!(isFounder || isSubscribed)) return res.status(403).json({ error: "Upgrade required" });

  const clientId = session.user.clientId;
  if (!clientId || clientId === "unknown-client") return res.status(400).json({ error: "Invalid client ID" });

  // PATCH: update transaction category in-place
  if (req.method === "PATCH") {
    try {
      const { id, category } = req.body || {};
      if (!id || !category) return res.status(400).json({ error: "Missing id or category" });

      const { error: updateErr } = await supabaseAdmin
        .from("transactions")
        .update({ category })
        .eq("id", id)
        .eq("client_id", clientId);

      if (updateErr) throw updateErr;

      await supabaseAdmin.from("audit").insert([{
        client_id: clientId,
        user: session.user.email,
        action: "UPDATE_CATEGORY",
        details: `Updated transaction ${id} category to ${category}`,
        timestamp: new Date().toISOString(),
      }]);

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("PATCH error:", err.message || err);
      return res.status(500).json({ error: "Failed to update category" });
    }
  }

  if (req.method === "DELETE") {
    try {
      const { count, error } = await supabaseAdmin
        .from("transactions")
        .delete({ count: "exact" })
        .eq("client_id", clientId);
      if (error) throw error;

      await supabaseAdmin.from("audit").insert([{
        client_id: clientId,
        user: session.user.email,
        action: "DELETE_TRANSACTIONS",
        details: `Deleted ${count} transactions`,
        timestamp: new Date().toISOString(),
      }]);

      return res.status(200).json({ success: true, deleted: count });
    } catch (err) {
      console.error("DELETE error:", err.message || err);
      return res.status(500).json({ error: "Failed to delete transactions" });
    }
  }

  try {
    const { data: transactions, error } = await supabaseAdmin
      .from("transactions")
      .select("id, date, amount, description, category, account_number, sort_code, storage_path, type, is_reversal")
      .eq("client_id", clientId)
      .order("date", { ascending: false });
    if (error) throw error;

    const monthly = {};
    const recent = [];

    // ✅ All possible categories included (for dropdown)
    const categoryBreakdown = {
      "Payment": 0, "Transfer": 0, "Bank Charges": 0, "Debit": 0, "Direct Debit": 0,
      "Standing Order": 0, "Interest": 0, "Groceries": 0, "Food & Drink": 0, "Shopping": 0,
      "Transport": 0, "Travel": 0, "Fuel": 0, "Utilities": 0, "Subscriptions": 0, "Advertising": 0,
      "Business & Tax": 0, "Health": 0, "Insurance": 0, "Entertainment": 0, "Fitness": 0,
      "Other": 0, "Asset Disposal": 0, "Insurance Payout": 0, "Internal Transfer": 0,
      "Returned Direct Debit": 0, "Transfer Between Accounts": 0
    };

    // ❗ Unified exclusion set: visible in UI, zeroed in totals (income & expenses)
    const excludedCategories = new Set([
      "Asset Disposal",
      "Insurance Payout",
      "Internal Transfer",
      "Returned Direct Debit",
      "Transfer Between Accounts",
    ]);

    for (const tx of transactions) {
      if (tx.is_reversal) continue;

      const date = new Date(tx.date);
      if (isNaN(date)) continue;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!monthly[monthKey]) monthly[monthKey] = { revenue: 0, expenses: 0 };

      const amount = tx.amount !== null ? parseFloat(tx.amount) : 0;
      const category = tx.category?.trim() || inferCategory(tx.type, tx.description);

      // Always include in recent for table
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

      // ✅ Apply unified exclusions to totals (not to visibility)
      if (amount > 0) {
        if (!excludedCategories.has(category)) {
          monthly[monthKey].revenue += amount;
        }
      } else if (amount < 0) {
        if (!excludedCategories.has(category)) {
          monthly[monthKey].expenses += -amount;
          categoryBreakdown[category] = (categoryBreakdown[category] || 0) + -amount;
        }
      }
    }

    const months = Object.keys(monthly).sort();
    const revenue = months.map(m => monthly[m].revenue);
    const expenses = months.map(m => monthly[m].expenses);
    const totalRevenue = revenue.reduce((a, b) => a + b, 0);
    const totalExpenses = expenses.reduce((a, b) => a + b, 0);
    const netProfit = totalRevenue - totalExpenses;

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
      series: { months, revenue, expenses },
      recent,
      breakdown: categoryBreakdown,
      categories: Object.keys(categoryBreakdown), // ✅ full category list for dropdown
      excludedIncomeCategories: Array.from(excludedCategories), // for frontend drilldown filtering if needed
    });
  } catch (err) {
    console.error("Dashboard API error:", err.message || err);
    return res.status(500).json({ error: "Failed to load dashboard data" });
  }
}
