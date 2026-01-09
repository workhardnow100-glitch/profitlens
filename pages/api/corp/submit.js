/**
 * ============================================================
 * File: pages/api/ct/submit.js
 * Purpose:
 *   Perform a Corporation Tax submission for a specific client:
 *     - Classify transactions (income / allowable / disallowable)
 *     - Compute profit and adjusted profit
 *     - Apply marginal relief rules
 *     - Lock transactions for the period
 *     - Insert a CT submission record
 *     - Return a simulated HMRC response
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: POST only.
 *   - Authentication:
 *       • Uses NextAuth session.
 *   - RBAC:
 *       • ACCOUNTANT:
 *           – May submit CT for actingAsClientId.
 *       • USER:
 *           – May submit CT for their own clientId.
 *       • FOUNDER:
 *           – May submit CT for any client.
 *   - Subscription gating:
 *       • USER must be subscribed/trialing.
 *       • ACCOUNTANT + FOUNDER bypass subscription gating.
 *   - Anti‑spoofing:
 *       • clientId is derived from session, not request body.
 *   - Data handling:
 *       • All reads/writes are client‑scoped via client_id.
 *       • Transactions are permanently locked after submission.
 *   - Audit logging:
 *       • Logs SUBMIT_CT / ACCOUNTANT_SUBMIT_CT.
 *
 * Change Control:
 *   - Any change to:
 *       • CT_MAP semantics
 *       • transaction schema (CT fields)
 *       • marginal relief rules
 *     MUST be reflected here and in the CT UI.
 * ============================================================
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { CT_MAP } from "../../../lib/constants/ctMap";

// Marginal relief calculator
function calculateCorporationTax(profit) {
  if (profit <= 0) return { tax: 0, rate: 0 };

  const smallProfitsRate = 0.19;
  const mainRate = 0.25;

  if (profit <= 50000) return { tax: profit * smallProfitsRate, rate: 19 };
  if (profit >= 250000) return { tax: profit * mainRate, rate: 25 };

  const marginalRelief = ((250000 - profit) / 200000) * (0.25 - 0.19);
  const effectiveRate = 0.25 - marginalRelief;

  return { tax: profit * effectiveRate, rate: effectiveRate * 100 };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ⭐ Session validation
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  // ⭐ Normalize role
  const role = (session.user.role || "").toUpperCase();
  const isFounder = role === "FOUNDER";
  const isAccountant = role === "ACCOUNTANT";
  const subscriptionStatus = session.user.subscriptionStatus;
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    subscriptionStatus
  );

  // ⭐ Subscription gating (accountants + founders bypass)
  if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Accountant-aware client ID
  const clientId = isAccountant
    ? session.user.actingAsClientId
    : session.user.clientId || session.user.defaultClientId;

  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "No client selected" });
  }

  const { periodStart, periodEnd } = req.body || {};

  if (!periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing required parameters" });
  }

  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);
  if (isNaN(startDate) || isNaN(endDate) || startDate > endDate) {
    return res.status(400).json({ error: "Invalid period range" });
  }

  try {
    // ⭐ Audit log — all roles
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: session.user.email,
        action: isAccountant ? "ACCOUNTANT_SUBMIT_CT" : "SUBMIT_CT",
        details: `Submitted CT for ${periodStart} → ${periodEnd}`,
        timestamp: new Date().toISOString(),
      },
    ]);

    // 1. Fetch transactions
    const { data: txs, error: fetchError } = await supabaseAdmin
      .from("transactions")
      .select("id, date, amount, business_category, description, tax_locked")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .order("date", { ascending: true });

    if (fetchError) throw new Error(fetchError.message);

    if (!txs || txs.length === 0) {
      return res.status(400).json({
        error: "No transactions found for this Corporation Tax period.",
      });
    }

    // ⭐ Prevent double submission
    if (txs.some((tx) => tx.tax_locked === true)) {
      return res.status(400).json({
        error: "This CT period is already locked and submitted.",
      });
    }

    // Prepare totals
    let income = 0;
    let allowable = 0;
    let disallowable = 0;

    const breakdown = [];

    // Case-insensitive CT_MAP
    const map = {
      income: new Set(CT_MAP.income.map((c) => c.toLowerCase())),
      allowable: new Set(CT_MAP.allowable.map((c) => c.toLowerCase())),
      disallowable: new Set(CT_MAP.disallowable.map((c) => c.toLowerCase())),
      ignore: new Set(CT_MAP.ignore.map((c) => c.toLowerCase())),
    };

    // Classify transactions
    txs.forEach((tx) => {
      const cat = (tx.business_category || "Uncategorised").trim();
      const key = cat.toLowerCase();
      const amount = Number(tx.amount || 0);

      let ctType = "review";
      if (map.income.has(key)) ctType = "income";
      else if (map.allowable.has(key)) ctType = "allowable";
      else if (map.disallowable.has(key)) ctType = "disallowable";
      else if (map.ignore.has(key)) ctType = "ignore";

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

    // Profit calculations
    const profit = income - allowable;
    const adjustedProfit = profit + disallowable;

    const { tax: corpTaxDue, rate: effectiveRate } =
      calculateCorporationTax(adjustedProfit);

    // ⭐ Lock transactions
    await supabaseAdmin
      .from("transactions")
      .update({ tax_locked: true })
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    // ⭐ Insert CT submission record
    const { data: submission, error: insertError } = await supabaseAdmin
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
          breakdown,
        },
      ])
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

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
        message: "Corporation Tax return accepted (simulated HMRC response)",
      },
      submission,
    });
  } catch (err) {
    console.error("Corporation Tax submission error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
