// pages/api/forecasts.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { CT_MAP } from "../../lib/constants/ctMap";
import { SYSTEM_CATEGORIES } from "../../lib/constants/systemCategories";

function formatMonthKey(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key) {
  const [year, month] = key.split("-");
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1));
}

// ✅ Unified allowed categories
const ALLOWED_CATEGORIES = new Set([
  ...CT_MAP.income,
  ...CT_MAP.allowable,
  ...CT_MAP.disallowable,
  ...CT_MAP.ignore,
  ...SYSTEM_CATEGORIES,
  "Uncategorised",
]);

// ✅ Lowercase sets for classification
const MAP = {
  income: new Set(CT_MAP.income.map((c) => c.toLowerCase())),
  allowable: new Set(CT_MAP.allowable.map((c) => c.toLowerCase())),
  disallowable: new Set(CT_MAP.disallowable.map((c) => c.toLowerCase())),
  ignore: new Set(CT_MAP.ignore.map((c) => c.toLowerCase())),
};

export default async function handler(req, res) {
  try {
    // ✅ Session guard
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // ✅ Role + subscription guard
    const isFounder = session.user.role === "admin";
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
      session.user.subscriptionStatus
    );

    if (!(isFounder || isSubscribedOrTrial)) {
      return res.status(403).json({ error: "Upgrade required" });
    }

    // ✅ Accountant‑aware client ID (matches Reports/Profile)
    const clientId =
      session.user.actingAsClientId || session.user.clientId;

    if (!clientId || clientId === "unknown-client") {
      return res.status(400).json({ error: "Invalid client ID" });
    }

    // ✅ Optional: audit log for accountants
    if (session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_FORECASTS",
          details: "Viewed forecasts",
        },
      ]);
    }

    // ✅ Fetch transactions
    const { data: transactions = [], error } = await supabaseAdmin
      .from("transactions")
      .select("date, amount, business_category, is_reversal")
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

    // ✅ Initialise category totals for all allowed categories
    for (const cat of ALLOWED_CATEGORIES) {
      categoriesTotals[cat] = { revenue: 0, expenses: 0 };
    }

    for (const tx of transactions) {
      if (tx.is_reversal) continue;

      const key = formatMonthKey(tx.date);
      if (!key) continue;

      const amount = tx.amount !== null ? parseFloat(tx.amount) : 0;

      // ✅ Unified category handling
      let category = tx.business_category?.trim() || "Uncategorised";
      if (!ALLOWED_CATEGORIES.has(category)) category = "Uncategorised";

      const lower = category.toLowerCase();

      // ✅ Skip system/ignored categories entirely
      if (MAP.ignore.has(lower)) continue;

      if (!monthly[key]) monthly[key] = { revenue: 0, expenses: 0 };

      if (amount > 0) {
        monthly[key].revenue += amount;
        categoriesTotals[category].revenue += amount;
      } else if (amount < 0) {
        const abs = Math.abs(amount);
        monthly[key].expenses += abs;
        categoriesTotals[category].expenses += abs;
      }
    }

    const keys = Object.keys(monthly).sort();
    const months = keys.map(formatMonthLabel);
    const revenue = keys.map((k) => monthly[k].revenue);
    const expenses = keys.map((k) => monthly[k].expenses);
    const net = revenue.map((r, i) => r - expenses[i]);

    // ✅ Use recent months for projection (last 3, if available)
    const recentRevenue = revenue.slice(-3);
    const recentExpenses = expenses.slice(-3);

    const avgRevenue =
      recentRevenue.length > 0
        ? recentRevenue.reduce((a, b) => a + b, 0) / recentRevenue.length
        : 0;

    const avgExpenses =
      recentExpenses.length > 0
        ? recentExpenses.reduce((a, b) => a + b, 0) / recentExpenses.length
        : 0;

    const avgNet = avgRevenue - avgExpenses;

    // ✅ Category‑level breakdown (ignoring system categories)
    const categories = Object.entries(categoriesTotals)
      .filter(([name]) => !MAP.ignore.has(name.toLowerCase()))
      .map(([name, vals]) => ({
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
