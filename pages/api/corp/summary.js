// pages/api/ct/summary.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]"; // adjust path if needed
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { CT_MAP } from "../../../lib/constants/ctMap";

console.log("🔥 CT SUMMARY ROUTE EXECUTED — CLEAN HMRC BUILD 🔥");

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
    rate: effectiveRate * 100,
  };
}

// ✅ Build lowercase sets for exact classification
const MAP = {
  income: new Set(CT_MAP.income.map((c) => c.toLowerCase())),
  allowable: new Set(CT_MAP.allowable.map((c) => c.toLowerCase())),
  disallowable: new Set(CT_MAP.disallowable.map((c) => c.toLowerCase())),
  ignore: new Set(CT_MAP.ignore.map((c) => c.toLowerCase())),
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ✅ Session validation
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ✅ Accountant-aware client ID
  const actingClientId =
    session.user.actingAsClientId || session.user.clientId;

  const { clientId, periodStart, periodEnd } = req.body;

  if (!clientId || !periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  // ✅ Prevent accountants from spoofing clientId
  if (session.user.role === "accountant" && clientId !== actingClientId) {
    return res.status(403).json({
      error: "Accountants cannot request CT summaries for unauthorized clients",
    });
  }

  try {
    // ✅ AUDIT LOG — Accountant viewing CT summary
    if (session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_CT_SUMMARY",
          details: `Viewed CT summary for ${periodStart} → ${periodEnd}`,
        },
      ]);
    }

    // ✅ 1. Fetch transactions
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
        error: "No Corporation Tax transactions found for this period.",
      });
    }

    // ✅ 2. Totals
    let income = 0;
    let allowable = 0;
    let disallowable = 0;

    const breakdown = [];

    // ✅ 3. Classify using EXACT CT_MAP categories
    txs.forEach((tx) => {
      const cat = (tx.business_category || "Uncategorised").trim();
      const key = cat.toLowerCase();
      const amount = Number(tx.amount || 0);

      let ctType = "ignore";

      if (MAP.income.has(key)) ctType = "income";
      else if (MAP.allowable.has(key)) ctType = "allowable";
      else if (MAP.disallowable.has(key)) ctType = "disallowable";
      else if (MAP.ignore.has(key)) ctType = "ignore";
      else ctType = "uncategorised";

      breakdown.push({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount,
        business_category: cat,
        ctType,
      });

      if (ctType === "income" && amount > 0) income += amount;
      if (ctType === "allowable" && amount < 0) allowable += Math.abs(amount);
      if (ctType === "disallowable" && amount < 0)
        disallowable += Math.abs(amount);
    });

    // ✅ 4. Profit calculations
    const profit = income - allowable;
    const adjustedProfit = profit + disallowable;

    const { tax: corpTaxDue, rate: effectiveRate } =
      calculateCorporationTax(adjustedProfit);

    const locked = txs.some((tx) => tx.tax_locked === true);

    // ✅ 5. Return aligned CT summary
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
      transactions: txs,
    });
  } catch (err) {
    console.error("CT summary error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
