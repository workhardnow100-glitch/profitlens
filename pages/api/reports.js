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
import { supabaseAdmin } from "../../lib/supabase-admin";
import { requireRole } from "../../lib/rbac";
import { CT_MAP } from "../../lib/constants/ctMap";

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
  if (
    parts.length >= 2 &&
    /^[A-Za-z]+$/.test(parts[0]) &&
    /^[A-Za-z]+$/.test(parts[1])
  ) {
    return `${parts[0].toUpperCase()} ${parts[1].toUpperCase()}`;
  }
  return parts[0].toUpperCase();
}

function parseLabelToDate(label) {
  if (!label) return new Date(0);

  const qMatch = label.match(/^(\d{4})-Q([1-4])$/);
  if (qMatch) {
    return new Date(
      parseInt(qMatch[1], 10),
      (parseInt(qMatch[2], 10) - 1) * 3,
      1
    );
  }

  const parsed = Date.parse(label);
  if (!isNaN(parsed)) return new Date(parsed);

  const yMatch = label.match(/^(\d{4})$/);
  if (yMatch) return new Date(parseInt(yMatch[1], 10), 0, 1);

  return new Date(0);
}

// ⭐ Map HMRC bucket → CT_MAP label
function mapBucketToLabel(bucket) {
  if (!bucket) return "Uncategorised";

  const lower = bucket.toLowerCase();

  if (CT_MAP.income.includes(bucket)) return bucket;
  if (CT_MAP.allowable.includes(bucket)) return bucket;
  if (CT_MAP.disallowable.includes(bucket)) return bucket;

  return bucket;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // ⭐ RBAC
    const guard = await requireRole(req, res, [
      "USER",
      "ACCOUNTANT",
      "ADMIN",
      "FOUNDER",
    ]);
    if (!guard.ok) return;

    const role = guard.role;
    const isFounder = role === "FOUNDER";
    const isAccountant = role === "ACCOUNTANT";

    const subscriptionStatus = req?.session?.user?.subscriptionStatus;
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
      subscriptionStatus
    );

    if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
      return res.status(403).json({ error: "Upgrade required" });
    }

    const clientId = guard.actingAsClientId || guard.clientId;
    if (!clientId || clientId === "unknown-client") {
      return res.status(400).json({ error: "Invalid client ID" });
    }

    const {
      from,
      to,
      page = DEFAULT_PAGE,
      limit = DEFAULT_LIMIT,
      client: clientFilter,
    } = req.query;

    // ⭐ Audit log
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: req.session?.user?.email || "unknown",
        action: isAccountant ? "ACCOUNTANT_VIEW_REPORTS" : "VIEW_REPORTS",
        details: `Viewed reports`,
        timestamp: new Date().toISOString(),
      },
    ]);

    // ⭐ Build filters
    const filters = {
      ...(from &&
        !isNaN(new Date(from)) && { gte: new Date(from).toISOString() }),
      ...(to && !isNaN(new Date(to)) && { lte: new Date(to).toISOString() }),
    };

    // ⭐ 1) Fetch transactions (MATCH DASHBOARD EXACTLY)
    let txQuery = supabaseAdmin
      .from("transactions")
      .select(
        `
        id,
        date,
        amount,
        description,
        business_category,
        account_number,
        sort_code,
        storage_path,
        type,
        is_reversal,
        coa_id,
        includedinct,
        includedinvat
      `
      )
      .eq("client_id", clientId);

    if (filters.gte) txQuery = txQuery.gte("date", filters.gte);
    if (filters.lte) txQuery = txQuery.lte("date", filters.lte);

    const { data: transactions = [], error: txErr } = await txQuery;
    if (txErr) {
      console.error("Reports API: transaction fetch error", txErr);
      return res.status(500).json({ error: "Failed to fetch transactions" });
    }

    const txs = transactions ?? [];

    // ⭐ 2) Build COA map (MATCH DASHBOARD EXACTLY)
    const distinctCoaIds = Array.from(
      new Set(txs.map((t) => t.coa_id).filter(Boolean))
    );

    const coaMap = new Map();
    if (distinctCoaIds.length > 0) {
      const { data: coaRows, error: coaErr } = await supabaseAdmin
        .from("chart_of_account_entries")
        .select(
          "id, account_type, hmrc_bucket, is_control_account, is_bank_account"
        )
        .in("id", distinctCoaIds);

      if (coaErr) {
        console.error("Reports API: COA fetch error", coaErr);
        return res.status(500).json({ error: "Failed to fetch COA" });
      }

      (coaRows || []).forEach((row) => {
        coaMap.set(row.id, row);
      });
    }

    const monthly = {};
    const quarterly = {};
    const yearly = {};
    const clientSet = new Set();
    const categorySet = new Set();

    // ⭐ 3) COA‑driven maths (MATCH DASHBOARD EXACTLY)
    for (const tx of txs) {
      if (tx.is_reversal) continue;

      // ⭐ Dashboard rule: only includedinct matters
      if (tx.includedinct === false) continue;

      const date = new Date(tx.date);
      if (isNaN(date)) continue;

      const month = date.toLocaleString("en-GB", {
        month: "short",
        year: "numeric",
      });
      const quarter = getQuarter(tx.date);
      const year = String(date.getFullYear());

      const clientLabel = extractClientLabel(tx.description);

      const coa = tx.coa_id ? coaMap.get(tx.coa_id) : null;
      if (!coa) continue;

      const accType = (coa.account_type || "").toUpperCase();

      // ⭐ Ignore control/bank/balance sheet accounts
      const isControl =
        coa.is_control_account ||
        coa.is_bank_account ||
        ["control", "system", "balance_sheet", "equity", "liabilities", "assets"]
          .includes((coa.hmrc_bucket || "").toLowerCase());

      if (isControl) continue;

      // ⭐ Only INCOME / EXPENSE accounts
      if (accType !== "INCOME" && accType !== "EXPENSE") continue;

      const amount = Number(tx.amount || 0);

      if (amount > 0) clientSet.add(clientLabel);
      if (clientFilter && clientLabel !== clientFilter) continue;

      // ⭐ Category label = CT_MAP bucket label
      const bucket = coa.hmrc_bucket || (accType === "INCOME" ? "income" : "expenses");
      const categoryLabel = mapBucketToLabel(bucket);

      categorySet.add(categoryLabel);

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

        const bucketObj = map[key];

        if (accType === "INCOME" && amount > 0) {
          bucketObj.revenue += amount;
        } else if (accType === "EXPENSE" && amount < 0) {
          bucketObj.expenses += Math.abs(amount);
        }

        bucketObj.net = bucketObj.revenue - bucketObj.expenses;

        bucketObj.categories[categoryLabel] =
          (bucketObj.categories[categoryLabel] || 0) + Math.abs(amount);

        bucketObj.transactions.push({
          id: tx.id,
          date: tx.date,
          description: tx.description || "",
          amount: formatCurrency(tx.amount),
          category: categoryLabel,
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

    const returnedTxs = txs
      .filter((tx) => {
        const coa = tx.coa_id ? coaMap.get(tx.coa_id) : null;
        if (!coa) return false;

        const accType = (coa.account_type || "").toUpperCase();
        if (accType !== "INCOME" && accType !== "EXPENSE") return false;

        const isControl =
          coa.is_control_account ||
          coa.is_bank_account ||
          ["control", "system", "balance_sheet", "equity", "liabilities", "assets"]
            .includes((coa.hmrc_bucket || "").toLowerCase());

        if (isControl) return false;

        if (tx.includedinct === false) return false;
        if (tx.is_reversal) return false;

        const clientLabel = extractClientLabel(tx.description);
        if (clientFilter && clientLabel !== clientFilter) return false;

        return true;
      })
      .map((tx) => {
        const coa = coaMap.get(tx.coa_id);
        const accType = (coa.account_type || "").toUpperCase();
        const bucket = coa.hmrc_bucket || (accType === "INCOME" ? "income" : "expenses");
        const categoryLabel = mapBucketToLabel(bucket);

        return {
          id: tx.id,
          date: tx.date,
          description: tx.description,
          amount: formatCurrency(tx.amount),
          category: categoryLabel,
          type: tx.type,
        };
      });

    // ⭐ Audit filtered reports
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: req.session?.user?.email || "unknown",
        action: isAccountant ? "ACCOUNTANT_FILTER_REPORTS" : "FILTER_REPORTS",
        details: `Filtered reports`,
        timestamp: new Date().toISOString(),
      },
    ]);

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
