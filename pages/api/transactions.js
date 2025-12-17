// pages/api/transactions.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { SYSTEM_CATEGORIES } from "../../lib/constants/systemCategories";

// --- New inferSystemCategory (MTD-safe, system-only) ---
function inferSystemCategory(type = "", description = "") {
  const normalizedType = type?.trim().toUpperCase() || "";
  const desc = description?.toLowerCase?.() || "";

  // ✅ Banking codes → system movements
  if (normalizedType === "TFR") return "Transfers";
  if (normalizedType === "FPI" || normalizedType === "FPO") {
    // Can't reliably know direction from code alone ⇒ treat as generic transfer
    return "Transfers";
  }
  if (normalizedType === "DD") return "Returned Direct Debit"; // if bank flags as returned, handled by desc
  if (normalizedType === "SO") return "Internal Transfers";
  if (normalizedType === "CPT") return "Cash Deposit";
  if (normalizedType === "CHG" || normalizedType === "FEE") return "Bank Charges";

  // ✅ Description-based, but only for system/tax/DLA-safe categories
  if (/\bRETURNED\s*DIRECT\s*DEBIT\b/i.test(description)) {
    return "Returned Direct Debit";
  }

  if (/\bTRANSFER\b/i.test(description)) {
    return "Transfers";
  }

  if (/\bCASH\s*(WITHDRAWAL|DEPOSIT|ATM)\b/i.test(description)) {
    return "Cash Deposit";
  }

  if (/\bCARD\s*PAYMENT\b/i.test(description)) {
    return "Card Payment";
  }

  if (/\bHMRC\b/i.test(description)) {
    if (/\bVAT\b/i.test(description)) return "VAT Paid";
    if (/\bCIS\b/i.test(description)) return "CIS Suffered";
    if (/\bCORP(ORATION)?\s*TAX\b/i.test(description)) return "Corporation Tax Payment";
    if (/\bSELF\s*ASSESSMENT\b/i.test(description) || /\bSA\b/i.test(description)) {
      return "SA Payment";
    }
    // Generic HMRC payment → treat as tax payment movement, not expense
    return "SA Payment";
  }

  if (/\bDIRECTOR\b/i.test(description) && /\bLOAN\b/i.test(description)) {
    if (/\bDRAW(ING)?S?\b/i.test(description)) return "Director Loan – Drawings";
    if (/\bREPAY(MENT)?S?\b/i.test(description)) return "Director Loan – Repayments";
    if (/\bINTEREST\b/i.test(description) && /\bCHARGED\b/i.test(description)) {
      return "Director Loan – Interest Charged";
    }
    if (/\bINTEREST\b/i.test(description) && /\bPAID\b/i.test(description)) {
      return "Director Loan – Interest Paid";
    }
  }

  // ✅ If we can't safely say it's a system/tax/DLA movement, don't guess
  return null;
}
// --- End inferSystemCategory ---

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

// Compute date window for a given period + optional custom from/to
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
    default: {
      from = null;
      to = null;
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

// ✅ Unified computeSummary using business_category (HMRC-aligned categories)
function computeSummary(transactions) {
  let income = 0;
  let expenses = 0;
  const categories = {};

  // ✅ Exclude all system movements from P&L-style summary
  const excludedCategories = new Set([
    ...SYSTEM_CATEGORIES,
    // You can add any extra exclusions here if needed
  ]);

  transactions.forEach((tx) => {
    const amount = Number(tx.amount) || 0;
    const category = (tx.business_category && tx.business_category.trim()) || "Uncategorised";

    if (excludedCategories.has(category)) {
      return;
    }

    if (amount > 0) {
      income += amount;
    } else if (amount < 0) {
      const out = Math.abs(amount);
      expenses += out;
      categories[category] = (categories[category] || 0) + out;
    }
  });

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

  const clientId = session.user.clientId;
  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  const { period = "month", from: fromParam, to: toParam } = req.query;

  try {
    const { data, error } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("client_id", clientId)
      .order("date", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    // ✅ Enrich with business_category:
    // - If already set → respect it
    // - Else, if we can safely infer a SYSTEM category → use it
    // - Else → "Uncategorised" (MTD-safe)
    const enriched = (data || []).map((tx) => {
      let business_category = (tx.business_category && tx.business_category.trim()) || null;

      if (!business_category) {
        const systemCat = inferSystemCategory(tx.type, tx.description);
        if (systemCat && SYSTEM_CATEGORIES.includes(systemCat)) {
          business_category = systemCat;
        } else {
          business_category = "Uncategorised";
        }
      }

      return {
        ...tx,
        business_category,
      };
    });

    const customFrom = fromParam ? new Date(fromParam) : null;
    const customTo = toParam ? new Date(toParam) : null;
    const { from, to } = computeDateWindow(period, customFrom, customTo);

    const filtered = filterByDateWindow(enriched, from, to);
    const summary = computeSummary(filtered);

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
