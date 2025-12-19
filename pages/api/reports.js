// pages/api/reports.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { CT_MAP } from "../../lib/constants/ctMap";
import { SYSTEM_CATEGORIES } from "../../lib/constants/systemCategories";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 5000;

function getQuarter(date) {
  const d = new Date(date);
  if (isNaN(d)) return null;
  const year = d.getFullYear();
  const quarter = Math.floor(d.getMonth() / 3) + 1;
  return `${year}-Q${quarter}`;
}

function formatCurrency(n) {
  return Number(n || 0).toFixed(2);
}

function extractClientLabel(description = "") {
  const cleaned = String(description).trim();
  if (!cleaned) return "UNLABELED";
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2 && /^[A-Za-z]+$/.test(parts[0]) && /^[A-Za-z]+$/.test(parts[1])) {
    return `${parts[0].toUpperCase()} ${parts[1].toUpperCase()}`;
  }
  return parts[0].toUpperCase();
}

function parseLabelToDate(label) {
  if (!label) return new Date(0);
  const qMatch = label.match(/^(\d{4})-Q([1-4])$/);
  if (qMatch) return new Date(parseInt(qMatch[1], 10), (parseInt(qMatch[2], 10) - 1) * 3, 1);
  const monthYear = Date.parse(label);
  if (!isNaN(monthYear)) return new Date(monthYear);
  const yMatch = label.match(/^(\d{4})$/);
  if (yMatch) return new Date(parseInt(yMatch[1], 10), 0, 1);
  return new Date(0);
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
  ignore: new Set(CT_MAP.ignore.map((c) => c.toLowerCase())),
};

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

    const isFounder = session.user.role === "admin";
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
      session.user.subscriptionStatus
    );

    if (!(isFounder || isSubscribedOrTrial)) {
      return res.status(403).json({ error: "Upgrade required" });
    }

    // ✅ Accountant-aware client ID
    const clientId =
      session.user.actingAsClientId || session.user.clientId;

    if (!clientId || clientId === "unknown-client")
      return res.status(400).json({ error: "Invalid client ID" });

    const { from, to, page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, client: clientFilter } =
      req.query;

    // ✅ AUDIT LOG — Accountant viewing reports
    if (session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_REPORTS",
          details: `Viewed reports (from=${from}, to=${to}, clientFilter=${clientFilter || "none"})`,
        },
      ]);
    }

    const filters = {
      ...(from && !isNaN(new Date(from)) && { gte: new Date(from).toISOString() }),
      ...(to && !isNaN(new Date(to)) && { lte: new Date(to).toISOString() }),
    };

    let txQuery = supabaseAdmin
      .from("transactions")
      .select("id, date, description, amount, business_category, type, is_reversal")
      .eq("client_id", clientId);

    if (filters.gte) txQuery = txQuery.gte("date", filters.gte);
    if (filters.lte) txQuery = txQuery.lte("date", filters.lte);

    const { data: transactions = [], error: txErr } = await txQuery;
    if (txErr) return res.status(500).json({ error: "Failed to fetch transactions" });

    const monthly = {};
    const quarterly = {};
    const yearly = {};
    const clientSet = new Set();
    const categorySet = new Set();

    for (const tx of transactions) {
      if (tx.is_reversal) continue;

      const date = new Date(tx.date);
      if (isNaN(date)) continue;

      const month = date.toLocaleString("en-US", { month: "short", year: "numeric" });
      const quarter = getQuarter(tx.date);
      const year = String(date.getFullYear());

      const clientLabel = extractClientLabel(tx.description);

      // ✅ Use validated business_category only
      let category = tx.business_category?.trim() || "Uncategorised";
      if (!ALLOWED_CATEGORIES.has(category)) category = "Uncategorised";

      const lower = category.toLowerCase();

      // ✅ Exclude system categories from P&L
      if (MAP.ignore.has(lower)) continue;

      const amount = parseFloat(tx.amount || 0);

      if (clientFilter && clientLabel !== clientFilter) continue;

      clientSet.add(clientLabel);
      categorySet.add(category);

      const addTo = (map, key) => {
        if (!map[key]) {
          map[key] = {
            label: key,
            revenue: 0,
            expenses: 0,
            net: 0,
            categories: {},
            transactions: [],
          };
        }

        const bucket = map[key];

        if (amount >= 0) bucket.revenue += amount;
        else bucket.expenses += -amount;

        bucket.net = bucket.revenue - bucket.expenses;

        bucket.categories[category] = (bucket.categories[category] || 0) + amount;

        bucket.transactions.push({
          id: tx.id,
          date: tx.date,
          description: tx.description ? String(tx.description).trim() : "Unlabeled",
          amount: formatCurrency(tx.amount),
          category,
        });
      };

      addTo(monthly, month);
      if (quarter) addTo(quarterly, quarter);
      addTo(yearly, year);
    }

    const convert = (map) =>
      Object.values(map)
        .map((r) => ({
          label: r.label,
          revenue: formatCurrency(r.revenue),
          expenses: formatCurrency(r.expenses),
          net: formatCurrency(r.net),
          categories: Object.entries(r.categories).map(([name, amt]) => ({
            name,
            amount: formatCurrency(amt),
          })),
          transactions: r.transactions,
        }))
        .sort((a, b) => parseLabelToDate(b.label) - parseLabelToDate(a.label));

    const allMonthly = convert(monthly);
    const allQuarterly = convert(quarterly);
    const allYearly = convert(yearly);

    const pageNum = Math.max(1, parseInt(page, 10) || DEFAULT_PAGE);
    const limitNum = Math.max(1, parseInt(limit, 10) || DEFAULT_LIMIT);
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum;

    const paginated = allMonthly.slice(start, end);

    const returnedTxs = (clientFilter
      ? transactions.filter(
          (tx) => extractClientLabel(tx.description) === clientFilter && !tx.is_reversal
        )
      : transactions.filter((tx) => !tx.is_reversal)
    ).map((tx) => {
      let category = tx.business_category?.trim() || "Uncategorised";
      if (!ALLOWED_CATEGORIES.has(category)) category = "Uncategorised";

      return {
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: formatCurrency(tx.amount),
        category,
        type: tx.type,
      };
    });

    // ✅ AUDIT LOG — Accountant filtered reports
    if (session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_FILTER_REPORTS",
          details: `Filtered reports (from=${from}, to=${to}, clientFilter=${clientFilter || "none"})`,
        },
      ]);
    }

    return res.status(200).json({
      pagination: {
        total: allMonthly.length,
        page: pageNum,
        limit: limitNum,
        hasMore: end < allMonthly.length,
      },
      reports: {
        monthly: paginated,
        quarterly: allQuarterly,
        yearly: allYearly,
      },
      transactions: returnedTxs,
      clients: Array.from(clientSet).sort(),
      categories: Array.from(categorySet).sort(),
    });
  } catch (err) {
    console.error("❌ Reports API error:", err);
    return res.status(500).json({ error: "Failed to generate report" });
  }
}
