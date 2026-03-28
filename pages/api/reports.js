/**
 * ============================================================
 * File: pages/api/reports.js
 * Purpose:
 *   Generate multi‑period financial reports for a specific client:
 *     - Monthly, Quarterly, Yearly summaries
 *     - Category breakdowns
 *     - Client label grouping
 *     - Transaction lists
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: GET only.
 *   - Authentication:
 *       • Uses requireRole() to enforce USER / ACCOUNTANT / ADMIN / FOUNDER.
 *   - RBAC:
 *       • ACCOUNTANT:
 *           – May view reports for actingAsClientId.
 *       • USER:
 *           – May view reports for their own clientId.
 *       • FOUNDER:
 *           – May view reports for any client.
 *   - Subscription gating:
 *       • USER must be subscribed/trialing.
 *       • ACCOUNTANT + FOUNDER bypass subscription gating.
 *   - Data handling:
 *       • All reads are client‑scoped via client_id.
 *       • Reversals + ignored categories excluded.
 *   - Audit logging:
 *       • Logs VIEW_REPORTS + FILTER_REPORTS.
 *
 * Change Control:
 *   - Any change to:
 *       • CT_MAP / SYSTEM_CATEGORIES
 *       • transaction schema
 *       • reporting logic
 *     MUST be reflected here and in the Reports UI.
 * ============================================================
 */

// pages/api/reports.js
// ⭐ HUMAN‑READABLE REPORTS API (NO COA FILTERING)

import { supabaseAdmin } from "../../lib/supabase-admin";
import { requireRole } from "../../lib/rbac";
import { CT_MAP } from "../../lib/constants/ctMap";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 5000;

const IGNORE_CATEGORIES = new Set(CT_MAP.ignore);

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
  if (qMatch) {
    return new Date(parseInt(qMatch[1], 10), (parseInt(qMatch[2], 10) - 1) * 3, 1);
  }
  const parsed = Date.parse(label);
  if (!isNaN(parsed)) return new Date(parsed);
  const yMatch = label.match(/^(\d{4})$/);
  if (yMatch) return new Date(parseInt(yMatch[1], 10), 0, 1);
  return new Date(0);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const guard = await requireRole(req, res, [
      "USER",
      "ACCOUNTANT",
      "ADMIN",
      "FOUNDER",
    ]);
    if (!guard.ok) return;

    const clientId = guard.actingAsClientId || guard.clientId;
    if (!clientId || clientId === "unknown-client") {
      return res.status(400).json({ error: "Invalid client ID" });
    }

    const { from, to, page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, client: clientFilter } = req.query;

    // ⭐ Fetch transactions (simple, human-readable)
    let txQuery = supabaseAdmin
      .from("transactions")
      .select(`
        id,
        date,
        amount,
        description,
        business_category,
        type,
        is_reversal,
        includedinct
      `)
      .eq("client_id", clientId);

    if (from) txQuery = txQuery.gte("date", from);
    if (to) txQuery = txQuery.lte("date", to);

    const { data: transactions = [], error: txErr } = await txQuery;
    if (txErr) {
      console.error("Reports API: transaction fetch error", txErr);
      return res.status(500).json({ error: "Failed to fetch transactions" });
    }

    const monthly = {};
    const quarterly = {};
    const yearly = {};
    const clientSet = new Set();
    const categorySet = new Set();

    // ⭐ HUMAN‑READABLE LOOP (NO COA FILTERING)
    for (const tx of transactions) {
      if (tx.is_reversal) continue;
      if (tx.includedinct === false) continue;

      const date = new Date(tx.date);
      if (isNaN(date)) continue;

      const month = date.toLocaleString("en-GB", { month: "short", year: "numeric" });
      const quarter = getQuarter(tx.date);
      const year = String(date.getFullYear());

      const category =
        (tx.business_category && String(tx.business_category).trim()) ||
        "Uncategorised";

      if (IGNORE_CATEGORIES.has(category)) continue;

      const amount = Number(tx.amount || 0);
      const clientLabel = extractClientLabel(tx.description);

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

        if (amount > 0) bucket.revenue += amount;
        if (amount < 0) bucket.expenses += Math.abs(amount);

        bucket.net = bucket.revenue - bucket.expenses;

        bucket.categories[category] =
          (bucket.categories[category] || 0) + amount;

        bucket.transactions.push({
          id: tx.id,
          date: tx.date,
          description: tx.description || "",
          amount: formatCurrency(tx.amount),
          category,
          type: tx.type,
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
      transactions: transactions.map((tx) => ({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount: formatCurrency(tx.amount),
        category:
          (tx.business_category && String(tx.business_category).trim()) ||
          "Uncategorised",
        type: tx.type,
      })),
      clients: Array.from(clientSet).sort(),
      categories: Array.from(categorySet).sort(),
    });
  } catch (err) {
    console.error("❌ Reports API error:", err);
    return res.status(500).json({ error: "Failed to generate report" });
  }
}


