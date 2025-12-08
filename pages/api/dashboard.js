// File: pages/api/dashboard.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

// Master category list with simple semantic type for validation
const MASTER_CATEGORIES = [
  { name: "Salary", type: "income" },
  { name: "HMRC", type: "income" },
  { name: "Refund", type: "both" },
  { name: "Gift", type: "income" },
  { name: "Family", type: "both" },
  { name: "Gambling", type: "expense" },
  { name: "Business Income", type: "income" },
  { name: "Other Income", type: "income" },

  { name: "Groceries", type: "expense" },
  { name: "Food & Drink", type: "expense" },
  { name: "Dining & Takeaway", type: "expense" },
  { name: "Shopping", type: "expense" },
  { name: "Clothing", type: "expense" },
  { name: "Health", type: "expense" },
  { name: "Fitness", type: "expense" },
  { name: "Entertainment", type: "expense" },
  { name: "Subscriptions", type: "expense" },
  { name: "Utilities", type: "expense" },
  { name: "Rent", type: "expense" },
  { name: "Mortgage", type: "expense" },
  { name: "Council Tax", type: "expense" },
  { name: "Insurance", type: "expense" },
  { name: "Transport", type: "expense" },
  { name: "Fuel", type: "expense" },
  { name: "Travel", type: "expense" },
  { name: "Education", type: "expense" },
  { name: "Childcare", type: "expense" },

  { name: "Bank Charge", type: "expense" },
  { name: "Bank Charge Waived", type: "expense" },
  { name: "Charges", type: "expense" },
  { name: "Standing Order", type: "neutral" },
  { name: "Direct Debit", type: "neutral" },
  { name: "Returned Direct Debit", type: "neutral" },
  { name: "Internal Transfer", type: "neutral" },
  { name: "Savings", type: "both" },
  { name: "Transfers", type: "neutral" },
  { name: "Investments", type: "both" },

  { name: "Business & Tax", type: "expense" },
  { name: "Advertising", type: "expense" },
  { name: "Tools & Equipment", type: "expense" },
  { name: "Office Supplies", type: "expense" },

  { name: "Unknown", type: "neutral" },
  { name: "Other", type: "neutral" },
];

const MASTER_CATEGORY_NAMES = MASTER_CATEGORIES.map((c) => c.name);
const CATEGORY_MAP = Object.fromEntries(MASTER_CATEGORIES.map((c) => [c.name, c.type]));

function inferCategory(type = "", description = "") {
  const normalized = type?.trim().toUpperCase() || "";

  if (normalized === "FPO") return "Standing Order";
  if (normalized === "TFR") return "Transfers";
  if (normalized === "CHG") return "Bank Charge";
  if (normalized === "DEB") return "Debit"; // maps to Other-ish
  if (normalized === "DD") return "Direct Debit";
  if (normalized === "SO") return "Standing Order";
  if (normalized === "INT") return "Interest";
  if (normalized === "FPI") return "Transfers";
  if (normalized === "BP") return "Savings";
  if (normalized === "DEP") return "Bank Charge Waived";
  if (normalized === "PAY") return "Charges";
  if (normalized === "FEE") return "Bank Charge";
  if (normalized === "CPT") return "Bank Charge";

  const desc = (description || "").toLowerCase();
  if (/tesco|sainsbur|aldi|lidl|waitrose|morrisons/.test(desc)) return "Groceries";
  if (/just\s*eat|deliveroo|uber\s*eats|dominos|mcdonalds|kfc|subway|nando/.test(desc)) return "Food & Drink";
  if (/amazon|ebay|argos|etsy/.test(desc)) return "Shopping";
  if (/uber|lyft|taxi|trainline|national\s*rail|tfl/.test(desc)) return "Transport";
  if (/ryanair|easyjet|jet2|british\s*airways/.test(desc)) return "Travel";
  if (/bp|shell|esso|texaco|petrol|fuel/.test(desc)) return "Fuel";
  if (/netflix|spotify|disney|apple\s*music|amazon\s*prime|now\s*tv|youtube\s*premium/.test(desc)) return "Subscriptions";
  if (/hmrc|tax|vat|companies\s*house/.test(desc)) return "Business & Tax";
  if (/nhs|clinic|dentist|boots|superdrug|pharmacy/.test(desc)) return "Health";
  if (/aviva|axa|direct\s*line|lv=|insurance/.test(desc)) return "Insurance";
  if (/cinema|odeon|vue|theatre|ticketmaster|eventbrite/.test(desc)) return "Entertainment";
  if (/gym|puregym|david\s*lloyd|fitness/.test(desc)) return "Fitness";

  return "Other";
}

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

  // GET
  try {
    const { data: transactions, error } = await supabaseAdmin
      .from("transactions")
      .select(
        "id, date, amount, description, category, account_number, sort_code, storage_path, type, is_reversal"
      )
      .eq("client_id", clientId)
      .order("date", { ascending: false });

    if (error) throw error;

    if (!transactions?.length) {
      // still return the full category list so frontend dropdown shows all
      return res.status(200).json({
        stats: [
          { label: "Total Revenue", value: "0.00" },
          { label: "Total Expenses", value: "0.00" },
          { label: "Net Profit", value: "0.00" },
        ],
        series: { months: [], revenue: [], expenses: [] },
        recent: [],
        breakdown: {},
        categories: MASTER_CATEGORY_NAMES,
      });
    }

    const monthly = {};
    const recent = [];

    // start from zero for all master categories
    const categoryBreakdown = Object.fromEntries(MASTER_CATEGORY_NAMES.map((c) => [c, 0]));

    const excludedCategories = new Set([
      // keep these in dropdown but exclude from revenue/expense totals if you want
      "Internal Transfer",
      "Standing Order",
      "Direct Debit",
      "Returned Direct Debit",
      "Transfers",
    ]);

    for (const tx of transactions) {
      if (tx.is_reversal) continue;

      const date = new Date(tx.date);
      if (isNaN(date)) continue;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!monthly[monthKey]) monthly[monthKey] = { revenue: 0, expenses: 0 };

      const amount = tx.amount !== null ? parseFloat(tx.amount) : 0;
      const category = tx.category?.trim() || inferCategory(tx.type, tx.description) || "Other";

      // store recent row (always)
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

      if (excludedCategories.has(category)) continue; // don't add to totals/breakdown

      if (amount > 0) {
        monthly[monthKey].revenue += amount;
        // income categories optionally contribute to breakdown too; we'll only add positive amounts into their category
        categoryBreakdown[category] = (categoryBreakdown[category] || 0) + amount;
      } else if (amount < 0) {
        monthly[monthKey].expenses += -amount;
        categoryBreakdown[category] = (categoryBreakdown[category] || 0) + -amount;
      }
    }

    const months = Object.keys(monthly).sort();
    const revenue = months.map((m) => monthly[m].revenue);
    const expenses = months.map((m) => monthly[m].expenses);
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
      categories: MASTER_CATEGORY_NAMES,
    });
  } catch (err) {
    console.error("Dashboard API error:", err.message || err);
    res.status(500).json({ error: "Failed to load dashboard data" });
  }
}


// File: pages/api/update-category.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

// Must match the master list used in dashboard.js
const MASTER_CATEGORIES = [
  "Salary","HMRC","Refund","Gift","Family","Gambling","Business Income","Other Income",
  "Groceries","Food & Drink","Dining & Takeaway","Shopping","Clothing","Health","Fitness","Entertainment","Subscriptions","Utilities","Rent","Mortgage","Council Tax","Insurance","Transport","Fuel","Travel","Education","Childcare",
  "Bank Charge","Bank Charge Waived","Charges","Standing Order","Direct Debit","Returned Direct Debit","Internal Transfer","Savings","Transfers","Investments",
  "Business & Tax","Advertising","Tools & Equipment","Office Supplies","Unknown","Other"
];

const CATEGORY_MAP = Object.fromEntries(MASTER_CATEGORIES.map((c) => [c, c]));

export default async function handler(req, res) {
  if (req.method !== "PATCH") return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const { id, category } = req.body || {};
  if (!id || !category) return res.status(400).json({ error: "Missing id or category" });
  if (!MASTER_CATEGORIES.includes(category)) return res.status(400).json({ error: "Unknown category" });

  try {
    // check transaction belongs to client and fetch amount to enforce income/expense rules
    const { data: txs, error: selectErr } = await supabaseAdmin
      .from("transactions")
      .select("id, amount, client_id")
      .eq("id", id)
      .single();

    if (selectErr || !txs) return res.status(404).json({ error: "Transaction not found" });
    if (txs.client_id !== session.user.clientId) return res.status(403).json({ error: "Forbidden" });

    const amount = Number(txs.amount || 0);

    // Simple income/expense validation: optional but enforces "obviously some categories cannot be income"
    const expenseOnly = new Set([
      "Groceries","Food & Drink","Dining & Takeaway","Shopping","Clothing","Health","Fitness","Entertainment","Utilities","Rent","Mortgage","Council Tax","Insurance","Transport","Fuel","Travel","Education","Childcare","Bank Charge","Charges","Advertising","Tools & Equipment","Office Supplies"
    ]);

    const incomeOnly = new Set([
      "Salary","HMRC","Business Income","Other Income","Refund","Gift"
    ]);

    if (amount > 0 && expenseOnly.has(category)) {
      return res.status(400).json({ error: "Cannot label a positive amount as an expense-only category" });
    }
    if (amount < 0 && incomeOnly.has(category)) {
      return res.status(400).json({ error: "Cannot label a negative amount as an income-only category" });
    }

    const { error: updateErr } = await supabaseAdmin
      .from("transactions")
      .update({ category })
      .eq("id", id);

    if (updateErr) throw updateErr;

    await supabaseAdmin.from("audit").insert([{
      client_id: session.user.clientId,
      user: session.user.email,
      action: "UPDATE_CATEGORY",
      details: `Updated tx ${id} -> ${category}`,
      timestamp: new Date().toISOString(),
    }]);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Update category error:", err.message || err);
    return res.status(500).json({ error: "Failed to update category" });
  }
}
