// pages/api/ct/summary.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]"; // adjust path if needed
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { CT_MAP } from "../../../lib/constants/ctMap";

console.log("🔥 CT SUMMARY ROUTE EXECUTED — COMPETITOR-GRADE BUILD 🔥");

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

  const role = (session.user.role || "").toUpperCase();

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ✅ Accountant-aware client ID (strict)
  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId) {
    return res.status(400).json({ error: "No client selected" });
  }

  const { periodStart, periodEnd } = req.body;

  if (!periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  try {
    // ✅ AUDIT LOG — Accountant viewing CT summary
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_CT_SUMMARY",
          details: `Viewed CT summary for ${periodStart} → ${periodEnd}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // ✅ 1. Fetch transactions, including CT flag + asset disposal fields
    const { data: txs, error: fetchError } = await supabaseAdmin
      .from("transactions")
      .select(
        `
        id,
        date,
        amount,
        business_category,
        description,
        tax_locked,
        includedinct,
        assetbalancingcharge,
        assetbalancingallowance
      `
      )
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

    // ✅ 2. Filter to CT‑included transactions only
    const ctTxs = txs.filter((tx) => tx.includedinct === true);

    if (ctTxs.length === 0) {
      const locked = txs.some((tx) => tx.tax_locked === true);
      return res.status(200).json({
        success: true,
        periodStart,
        periodEnd,
        income: 0,
        allowable: 0,
        disallowable: 0,
        profit: 0,
        adjustedProfit: 0,
        corpTaxDue: 0,
        effectiveRate: 0,
        locked,
        breakdown: [],
        transactions: txs, // full set, for context if needed
      });
    }

    // ✅ 3. Totals
    let income = 0;
    let allowable = 0;
    let disallowable = 0;

    // ✅ Asset disposal contributions
    let totalBalancingCharges = 0;
    let totalBalancingAllowances = 0;

    const breakdown = [];

    // ✅ 4. Classify CT‑included transactions using EXACT CT_MAP categories
    ctTxs.forEach((tx) => {
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

      if (ctType === "allowable" && amount < 0) {
        // store as positive expense
        allowable += Math.abs(amount);
      }

      if (ctType === "disallowable" && amount < 0) {
        // store as positive add‑back
        disallowable += Math.abs(amount);
      }

      // ✅ Asset disposal: balancing charges/allowances affect CT
      const bc = tx.assetbalancingcharge
        ? Number(tx.assetbalancingcharge)
        : 0;
      const ba = tx.assetbalancingallowance
        ? Number(tx.assetbalancingallowance)
        : 0;

      if (!Number.isNaN(bc) && bc !== 0) {
        totalBalancingCharges += bc;
      }

      if (!Number.isNaN(ba) && ba !== 0) {
        totalBalancingAllowances += ba;
      }
    });

    // ✅ 5. Profit calculations
    // Base trading profit
    const profit = income - allowable;

    // Adjusted profit before disposals: add back disallowable
    let adjustedProfit = profit + disallowable;

    // ✅ Apply balancing charges (increase profit) and allowances (reduce profit)
    adjustedProfit += totalBalancingCharges;
    adjustedProfit -= totalBalancingAllowances;

    const { tax: corpTaxDue, rate: effectiveRate } =
      calculateCorporationTax(adjustedProfit);

    const locked = txs.some((tx) => tx.tax_locked === true);

    // ✅ 6. Return aligned CT summary
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
      transactions: txs, // full set in case UI wants it
    });
  } catch (err) {
    console.error("CT summary error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
