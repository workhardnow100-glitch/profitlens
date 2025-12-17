import { createClient } from "@supabase/supabase-js";
import { CT_MAP } from "../../../lib/constants/ctMap";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Marginal relief calculator
function calculateCorporationTax(profit) {
  if (profit <= 0) return { tax: 0, rate: 0 };

  const smallProfitsRate = 0.19;
  const mainRate = 0.25;

  if (profit <= 50000) {
    return { tax: profit * smallProfitsRate, rate: 19 };
  }

  if (profit >= 250000) {
    return { tax: profit * mainRate, rate: 25 };
  }

  const marginalRelief = ((250000 - profit) / 200000) * (0.25 - 0.19);
  const effectiveRate = 0.25 - marginalRelief;

  return {
    tax: profit * effectiveRate,
    rate: effectiveRate * 100
  };
}

// ✅ Unified category normalisation layer
function normaliseCategory(cat) {
  if (!cat) return "uncategorised";

  const c = cat.trim().toLowerCase();

  const synonyms = {
    "council tax": "professional fees",
    "books": "office supplies",
    "education": "professional fees",
    "childcare": "personal spending",
    "loan repayment": "loan repayments",
    "credit card payment": "credit card payments",
    "insurance payout": "insurance payouts",
    "refund": "refunds received",
    "refunds": "refunds received",
    "groceries": "groceries",
    "fuel": "fuel",
    "travel": "travel & subsistence",
    "internet": "phone & internet",
    "mobile": "phone & internet",
    "software": "software & subscriptions",
    "subscriptions": "software & subscriptions",
    "rent": "rent",
    "insurance": "insurance",
    "utilities": "utilities",
    "bank charge": "bank charges",
    "bank charges": "bank charges",
    "entertainment": "entertainment",
    "gifts": "gifts",
    "personal": "personal spending",
    "personal spending": "personal spending",
    "internal transfer": "internal transfers",
    "returned dd": "returned direct debit",
    "returned direct debit": "returned direct debit",
    "refunds received": "refunds received",
    "sales": "sales",
    "other income": "other income",
  };

  return synonyms[c] || c;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { clientId, periodStart, periodEnd } = req.body;

  if (!clientId || !periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    // ✅ 1. Fetch transactions for the CT period
    const { data: txs, error: fetchError } = await supabase
      .from("transactions")
      .select("id, date, amount, business_category, description, tax_locked")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .order("date", { ascending: true });

    if (fetchError) throw new Error(fetchError.message);

    if (!txs || txs.length === 0) {
      return res.status(400).json({
        error: "No Corporation Tax transactions found for this period."
      });
    }

    // ✅ DEBUG: Log raw categories coming from Supabase
    console.log("CT RAW CATEGORIES SAMPLE:", txs.slice(0, 10).map(t => t.business_category));

    // ✅ 2. Prepare totals
    let income = 0;
    let allowable = 0;
    let disallowable = 0;

    const breakdown = [];

    // ✅ 3. Normalise CT_MAP into lowercase sets
    const map = {
      income: new Set(CT_MAP.income.map(c => c.toLowerCase())),
      allowable: new Set(CT_MAP.allowable.map(c => c.toLowerCase())),
      disallowable: new Set(CT_MAP.disallowable.map(c => c.toLowerCase())),
      ignore: new Set(CT_MAP.ignore.map(c => c.toLowerCase())),
    };

    // ✅ 4. Classify transactions
    txs.forEach((tx) => {
      const rawCat = tx.business_category || "Uncategorised";
      const cat = normaliseCategory(rawCat);
      const normalised = cat.toLowerCase();

      let ctType = "review";

      if (map.income.has(normalised)) ctType = "income";
      else if (map.allowable.has(normalised)) ctType = "allowable";
      else if (map.disallowable.has(normalised)) ctType = "disallowable";
      else if (map.ignore.has(normalised)) ctType = "ignore";

      const amount = Number(tx.amount || 0);

      breakdown.push({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount,
        business_category: cat,
        ctType
      });

      if (ctType === "income" && amount > 0) income += amount;
      if (ctType === "allowable" && amount < 0) allowable += Math.abs(amount);
      if (ctType === "disallowable" && amount < 0) disallowable += Math.abs(amount);
    });

    // ✅ DEBUG: Log classification counts
    console.log("CT CLASSIFICATION COUNTS:", {
      income: breakdown.filter(r => r.ctType === "income").length,
      allowable: breakdown.filter(r => r.ctType === "allowable").length,
      disallowable: breakdown.filter(r => r.ctType === "disallowable").length,
      ignore: breakdown.filter(r => r.ctType === "ignore").length,
      review: breakdown.filter(r => r.ctType === "review").length,
    });

    // ✅ DEBUG: Log first 10 breakdown rows
    console.log("CT BREAKDOWN SAMPLE:", breakdown.slice(0, 10));

    // ✅ 5. Compute profit + adjusted profit
    const profit = income - allowable;
    const adjustedProfit = profit + disallowable;

    // ✅ 6. Compute Corporation Tax
    const { tax: corpTaxDue, rate: effectiveRate } =
      calculateCorporationTax(adjustedProfit);

    // ✅ 7. Determine locked state
    const locked = txs.some((tx) => tx.tax_locked === true);

    // ✅ 8. Return cockpit-grade CT summary
    return res.status(200).json({
      success: true,
      periodStart,
      periodEnd,
      income,
      allowable,
      disallowable,
      profit,
      adjustedProfit,
      corpTaxDue,
      effectiveRate,
      locked,
      breakdown,
      transactions: txs
    });

  } catch (err) {
    console.error("Corporation Tax summary error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
