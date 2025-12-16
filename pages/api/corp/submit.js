// pages/api/corp/submit.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ HMRC Corporation Tax mapping
const CT_MAP = {
  "Sales": "income",
  "Other Income": "income",
  "Refunds Received": "income",

  "Materials": "allowable",
  "Subcontractors": "allowable",
  "Tools & Equipment": "allowable",
  "Fuel": "allowable",
  "Motor Expenses": "allowable",
  "Travel & Subsistence": "allowable",
  "Rent": "allowable",
  "Utilities": "allowable",
  "Phone & Internet": "allowable",
  "Bank Charges": "allowable",
  "Insurance": "allowable",
  "Advertising & Marketing": "allowable",
  "Repairs & Maintenance": "allowable",
  "Professional Fees": "allowable",
  "Software & Subscriptions": "allowable",
  "Office Supplies": "allowable",

  "Clothing": "disallowable",
  "Groceries": "disallowable",
  "Entertainment": "disallowable",
  "Personal Spending": "disallowable",
  "Cash Withdrawals": "disallowable",
  "Gifts": "disallowable",
  "Fines & Penalties": "disallowable",
  "Loan Repayments": "disallowable",
  "Credit Card Payments": "disallowable",

  "Transfers": "ignore",
  "Internal Transfers": "ignore",
  "Returned Direct Debit": "ignore",
  "Uncategorised": "review"
};

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

  // ✅ Marginal relief formula
  const marginalRelief = ((250000 - profit) / 200000) * (0.25 - 0.19);
  const effectiveRate = 0.25 - marginalRelief;

  return {
    tax: profit * effectiveRate,
    rate: effectiveRate * 100
  };
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
      .select("id, date, amount, business_category, description")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .order("date", { ascending: true });

    if (fetchError) throw new Error(fetchError.message);

    if (!txs || txs.length === 0) {
      return res.status(400).json({
        error: "No transactions found for this Corporation Tax period."
      });
    }

    // ✅ 2. Compute CT categories
    let income = 0;
    let allowable = 0;
    let disallowable = 0;

    const breakdown = [];

    txs.forEach((tx) => {
      const cat = tx.business_category || "Uncategorised";
      const ctType = CT_MAP[cat] || "review";
      const amount = Number(tx.amount || 0);

      breakdown.push({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount,
        business_category: cat,
        ctType
      });

      if (ctType === "income") {
        if (amount > 0) income += amount;
      }

      if (ctType === "allowable") {
        if (amount < 0) allowable += Math.abs(amount);
      }

      if (ctType === "disallowable") {
        if (amount < 0) disallowable += Math.abs(amount);
      }
    });

    // ✅ 3. Compute profit + adjusted profit
    const profit = income - allowable;
    const adjustedProfit = profit + disallowable;

    // ✅ 4. Compute Corporation Tax
    const { tax: corpTaxDue, rate: effectiveRate } =
      calculateCorporationTax(adjustedProfit);

    // ✅ 5. Lock transactions
    await supabase
      .from("transactions")
      .update({ tax_locked: true })
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    // ✅ 6. Insert CT submission record
    const { data: submission, error: insertError } = await supabase
      .from("corp_submissions")
      .insert([
        {
          client_id: clientId,
          period_start: periodStart,
          period_end: periodEnd,
          income,
          allowable_expenses: allowable,
          disallowable_expenses: disallowable,
          profit_before_tax: profit,
          adjusted_profit: adjustedProfit,
          corp_tax_due: corpTaxDue,
          effective_rate: effectiveRate,
          breakdown
        }
      ])
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    // ✅ 7. Return cockpit-grade CT summary
    return res.status(200).json({
      success: true,
      income,
      allowable,
      disallowable,
      profit,
      adjustedProfit,
      corpTaxDue,
      effectiveRate,
      breakdown,
      hmrcResponse: {
        status: "SUCCESS",
        processingDate: new Date().toISOString(),
        message: "Corporation Tax return accepted (simulated HMRC response)"
      }
    });

  } catch (err) {
    console.error("Corporation Tax submission error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
