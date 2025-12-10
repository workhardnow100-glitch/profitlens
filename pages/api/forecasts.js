import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

function formatMonthKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
}

function formatMonthLabel(key) {
  const [year, month] = key.split("-");
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1));
}

function inferCategory(type = "", description = "") {
  const normalized = type.trim().toUpperCase();

  // Banking transaction codes
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
  if (normalized === "CPT") return "Cash Withdrawl";

  // Merchant/keyword rules
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
    if (rule.regex.test(description)) {
      return rule.category;
    }
  }

  return "Other";
}

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const isFounder = session.user.role === "admin";
const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(session.user.subscriptionStatus);
if (!(isFounder || isSubscribedOrTrial)) {
  return res.status(403).json({ error: "Upgrade required" });
}


    const clientId = session.user.clientId;
    if (!clientId || clientId === "unknown-client") {
      console.error("❌ Invalid or missing clientId in session:", session?.user);
      return res.status(400).json({ error: "Invalid client ID" });
    }

    const { data: transactions, error } = await supabaseAdmin
      .from("transactions")
      .select("date, amount, type, description, is_reversal") // ✅ include is_reversal
      .eq("client_id", clientId);

    if (error) {
      console.error("❌ Supabase fetch error:", error.message);
      return res.status(500).json({ error: "Failed to fetch transactions" });
    }

    if (!transactions.length) {
      return res.status(200).json({
        forecast: [
          { label: "Projected Revenue", value: "£0.00" },
          { label: "Projected Expenses", value: "£0.00" },
          { label: "Projected Net Profit", value: "£0.00" },
        ],
        series: { months: [], revenue: [], expenses: [], net: [] },
        categories: [],
      });
    }

    const monthly = {};
    const categoriesTotals = {};

    for (const tx of transactions) {
      const key = formatMonthKey(tx.date);
      if (!key) continue;

      const amount = tx.amount !== null ? parseFloat(tx.amount) : 0;
      const category = inferCategory(tx.type || "", tx.description || "");

      // ✅ Skip reversals universally
      if (tx.is_reversal) {
        continue;
      }

      if (!monthly[key]) monthly[key] = { revenue: 0, expenses: 0 };

      if (amount > 0) {
        monthly[key].revenue += amount;
      } else {
        monthly[key].expenses += -amount;
      }

      if (!categoriesTotals[category]) {
        categoriesTotals[category] = { revenue: 0, expenses: 0 };
      }

      if (amount > 0) {
        categoriesTotals[category].revenue += amount;
      } else {
        categoriesTotals[category].expenses += -amount;
      }
    }

    const keys = Object.keys(monthly).sort();
    const months = keys.map(formatMonthLabel);
    const revenue = keys.map((k) => monthly[k].revenue);
    const expenses = keys.map((k) => monthly[k].expenses);
    const net = revenue.map((r, i) => r - expenses[i]);

    const recentRevenue = revenue.slice(-3);
    const recentExpenses = expenses.slice(-3);

    const avgRevenue = recentRevenue.length
      ? recentRevenue.reduce((a, b) => a + b, 0) / recentRevenue.length
      : 0;

    const avgExpenses = recentExpenses.length
      ? recentExpenses.reduce((a, b) => a + b, 0) / recentExpenses.length
      : 0;

    const avgNet = avgRevenue - avgExpenses;

    // Prepare categories array with formatted values
    const categories = Object.entries(categoriesTotals).map(([name, vals]) => ({
      name,
      revenue: `£${vals.revenue.toFixed(2)}`,
      expenses: `£${vals.expenses.toFixed(2)}`,
      net: `£${(vals.revenue - vals.expenses).toFixed(2)}`,
    }));

    return res.status(200).json({
      forecast: [
        { label: "Projected Revenue", value: `£${avgRevenue.toFixed(2)}` },
        { label: "Projected Expenses", value: `£${avgExpenses.toFixed(2)}` },
        { label: "Projected Net Profit", value: `£${avgNet.toFixed(2)}` },
      ],
      series: { months, revenue, expenses, net },
      categories,
    });
  } catch (err) {
    console.error("❌ Forecast API error:", err.message || err);
    return res.status(500).json({ error: "Failed to generate forecast" });
  }
}
