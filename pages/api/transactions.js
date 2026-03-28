import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { SYSTEM_CATEGORIES } from "../../lib/constants/systemCategories";
import { CT_MAP } from "../../lib/constants/ctMap";

// ✅ Unified allowed category list (UI dropdown)
const ALLOWED_CATEGORIES = new Set([
  ...CT_MAP.income,
  ...CT_MAP.allowable,
  ...CT_MAP.disallowable,
  ...CT_MAP.ignore,
  ...CT_MAP.other_income, // ⭐ Asset Sale Proceeds now selectable
  ...SYSTEM_CATEGORIES,
  "Uncategorised",
]);

// ✅ Fast lookup sets for CT_MAP groups (for profit logic)
const INCOME_SET = new Set(CT_MAP.income);
const ALLOWABLE_SET = new Set(CT_MAP.allowable);
const DISALLOWABLE_SET = new Set(CT_MAP.disallowable);
const IGNORE_SET = new Set(CT_MAP.ignore);

// ⭐ System-only inference (safe)
function inferSystemCategory(type = "", description = "") {
  const normalizedType = type?.trim().toUpperCase() || "";
  const desc = description?.toLowerCase?.() || "";

  if (normalizedType === "TFR") return "Transfers";
  if (normalizedType === "FPI" || normalizedType === "FPO") return "Transfers";
  if (normalizedType === "DD") return "Returned Direct Debit";
  if (normalizedType === "SO") return "Internal Transfers";
  if (normalizedType === "CPT") return "Cash Deposit";
  if (normalizedType === "CHG" || normalizedType === "FEE") return "Bank Charges";

  if (/\bRETURNED\s*DIRECT\s*DEBIT\b/i.test(description)) return "Returned Direct Debit";
  if (/\bTRANSFER\b/i.test(description)) return "Transfers";
  if (/\bCASH\s*(WITHDRAWAL|DEPOSIT|ATM)\b/i.test(description)) return "Cash Deposit";
  if (/\bCARD\s*PAYMENT\b/i.test(description)) return "Card Payment";

  if (/\bHMRC\b/i.test(description)) {
    if (/\bVAT\b/i.test(description)) return "VAT Paid";
    if (/\bCIS\b/i.test(description)) return "CIS Suffered";
    if (/\bCORP(ORATION)?\s*TAX\b/i.test(description)) return "Corporation Tax Payment";
    if (/\bSELF\s*ASSESSMENT\b/i.test(description) || /\bSA\b/i.test(description)) {
      return "SA Payment";
    }
    return "SA Payment";
  }

  if (/\bDIRECTOR\b/i.test(description) && /\bLOAN\b/i.test(description)) {
    if (/\bDRAW(ING)?S?\b/i.test(description)) return "Director Loan – Drawings";
    if (/\bREPAY(MENT)?S?\b/i.test(description)) return "Director Loan – Repayments";
    if (/\bINTEREST\b/i.test(description) && /\bCHARGED\b/i.test(description))
      return "Director Loan – Interest Charged";
    if (/\bINTEREST\b/i.test(description) && /\bPAID\b/i.test(description))
      return "Director Loan – Interest Paid";
  }

  return null;
}

function startOfDay(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(d) {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
}

function computeDateWindow(period, customFrom, customTo) {
  const now = new Date();
  const today = startOfDay(now);

  let from = null;
  let to = null;

  switch (period) {
    case "week": {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      from = weekAgo;
      to = endOfDay(today);
      break;
    }
    case "month": {
      from = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
      to = endOfDay(today);
      break;
    }
    case "quarter": {
      const q = Math.floor(today.getMonth() / 3);
      from = startOfDay(new Date(today.getFullYear(), q * 3, 1));
      to = endOfDay(today);
      break;
    }
    case "year": {
      from = startOfDay(new Date(today.getFullYear(), 0, 1));
      to = endOfDay(today);
      break;
    }
    case "last7": {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      from = start;
      to = endOfDay(today);
      break;
    }
    case "last30": {
      const start = new Date(today);
      start.setDate(today.getDate() - 29);
      from = start;
      to = endOfDay(today);
      break;
    }
    case "last90": {
      const start = new Date(today);
      start.setDate(today.getDate() - 89);
      from = start;
      to = endOfDay(today);
      break;
    }
    case "thisTimeLastYear": {
      const lastYear = today.getFullYear() - 1;
      const end = startOfDay(new Date(lastYear, today.getMonth(), today.getDate()));
      const start = new Date(end);
      start.setDate(end.getDate() - 29);
      from = start;
      to = endOfDay(end);
      break;
    }
    case "custom": {
      from = customFrom ? startOfDay(customFrom) : null;
      to = customTo ? endOfDay(customTo) : null;
      break;
    }
  }

  return { from, to };
}

function filterByDateWindow(transactions, from, to) {
  if (!from && !to) return transactions;

  return transactions.filter((tx) => {
    if (!tx.date) return false;
    const d = startOfDay(tx.date);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

// ⭐ Summary uses CT_MAP + COA guardrails (trading only)
function computeSummary(transactions, coaMap) {
  let income = 0;
  let expenses = 0;
  const categories = {};

  for (const tx of transactions) {
    const amount = Number(tx.amount) || 0;
    const category = tx.business_category || "Uncategorised";

    // 1. Ignore CT_MAP.ignore
    if (IGNORE_SET.has(category)) continue;

    // 2. COA guardrails
    const coa = coaMap.get(tx.coa_id);
    if (!coa) continue;

    const accType = coa.account_type;

    const isControl =
      coa.hmrc_bucket === "control" ||
      coa.hmrc_bucket === "system" ||
      coa.hmrc_bucket === "balance_sheet" ||
      coa.hmrc_bucket === "equity" ||
      coa.hmrc_bucket === "liabilities" ||
      coa.hmrc_bucket === "assets" ||
      coa.is_control_account ||
      coa.is_bank_account;

    if (isControl) continue;

    // 3. Respect CT toggle
    // Do not filter charts by CT flag
  if (tx.includedinct === false) continue;


    // 4. Ignore reversals
    if (tx.is_reversal) continue;

    const absAmount = Math.abs(amount);

    // 5. Revenue (trading only)
    if (INCOME_SET.has(category) && accType === "INCOME" && amount > 0) {
      income += amount;
      categories[category] = (categories[category] || 0) + absAmount;
      continue;
    }

    // 6. Expenses (trading only)
    const isExpenseCategory =
      ALLOWABLE_SET.has(category) || DISALLOWABLE_SET.has(category);

    if (isExpenseCategory && accType === "EXPENSE" && amount < 0) {
      expenses += absAmount;
      categories[category] = (categories[category] || 0) + absAmount;
      continue;
    }
  }

  return {
    income,
    expenses,
    net: income - expenses,
    categories,
  };
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );
  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Accountant-aware client ID
  const clientId =
    session.user.actingAsClientId || session.user.clientId;

  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  const { period = "month", from: fromParam, to: toParam } = req.query;

  try {
    // ⭐ AUDIT LOG — Accountant viewing transactions
    if (session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_TRANSACTIONS",
          details: `Viewed transactions (period=${period})`,
        },
      ]);
    }

    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("client_id", clientId)
      .order("date", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    // ⭐ Enrich with HMRC-aligned categories only
    const enriched = (data || []).map((tx) => {
      let category = tx.business_category?.trim() || null;

      if (category && !ALLOWED_CATEGORIES.has(category)) {
        category = "Uncategorised";
      }

      if (!category) {
        const sys = inferSystemCategory(tx.type, tx.description);
        if (sys && SYSTEM_CATEGORIES.includes(sys)) {
          category = sys;
        } else {
          category = "Uncategorised";
        }
      }

      return {
        ...tx,
        business_category: category,
        assetdisposaltype: tx.assetdisposaltype,
        assetpurchaseprice: tx.assetpurchaseprice,
        assetcapitalclaimed: tx.assetcapitalclaimed,
        assettwdv: tx.assettwdv,
        assetbalancingcharge: tx.assetbalancingcharge,
        assetbalancingallowance: tx.assetbalancingallowance,
      };
    });

    // ⭐ Build COA map once
    const distinctCoaIds = Array.from(
      new Set(enriched.map((t) => t.coa_id).filter(Boolean))
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
        console.error("COA fetch error:", coaErr.message);
        return res.status(500).json({ error: coaErr.message });
      }

      (coaRows || []).forEach((row) => {
        coaMap.set(row.id, row);
      });
    }

    const customFrom = fromParam ? new Date(fromParam) : null;
    const customTo = toParam ? new Date(toParam) : null;
    const { from, to } = computeDateWindow(period, customFrom, customTo);

    const filtered = filterByDateWindow(enriched, from, to);
    const summary = computeSummary(filtered, coaMap);

    // ⭐ AUDIT LOG — Accountant filtered view
    if (session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_FILTER_TRANSACTIONS",
          details: `Filtered transactions (period=${period}, from=${fromParam}, to=${toParam})`,
        },
      ]);
    }

    return res.status(200).json({
      transactions: enriched,
      filtered,
      summary,
      meta: {
        period,
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
        countAll: enriched.length,
        countFiltered: filtered.length,
      },
    });
  } catch (err) {
    console.error("❌ Transactions API error:", err.message || err);
    return res.status(500).json({ error: "Failed to fetch transactions" });
  }
}
