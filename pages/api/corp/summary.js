/**
 * ============================================================
 * File: pages/api/ct/summary.js
 * Purpose:
 *   Compute Corporation Tax summary for a specific client over
 *   a given accounting period using REAL COA ENTRIES:
 *     - Income / allowable / disallowable totals
 *     - Profit and adjusted profit
 *     - Marginal‑relief‑aware Corporation Tax due
 *     - Effective tax rate
 *     - Per‑transaction CT classification breakdown
 *
 * Notes:
 *   - Uses chart_of_account_entries (correct accountant-grade COA)
 *   - No CT_MAP, no business_category hacks
 *   - No FK required — manual COA lookup via .in()
 * ============================================================
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

// Marginal relief calculator
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Session validation
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const role = (session.user.role || "").toUpperCase();
  const isFounder = role === "FOUNDER";
  const isAccountant = role === "ACCOUNTANT";
  const subscriptionStatus = session.user.subscriptionStatus;
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(subscriptionStatus);

  if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
    return res.status(403).json({ error: "Upgrade required" });
  }

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

  try {
    // Audit log
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: session.user.email,
        action: isAccountant ? "ACCOUNTANT_VIEW_CT_SUMMARY" : "VIEW_CT_SUMMARY",
        details: `Viewed CT summary for ${periodStart} → ${periodEnd}`,
        timestamp: new Date().toISOString(),
      },
    ]);

    // 1. Fetch transactions
    const { data: txs, error: fetchError } = await supabaseAdmin
      .from("transactions")
      .select(`
        id,
        date,
        amount,
        description,
        tax_locked,
        includedinct,
        assetbalancingcharge,
        assetbalancingallowance,
        coa_id
      `)
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .order("date", { ascending: true });

    if (fetchError) throw new Error(fetchError.message);

    if (!txs || txs.length === 0) {
      return res.status(400).json({ error: "No Corporation Tax transactions found for this period." });
    }

    // 2. Filter CT-included transactions
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
        transactions: txs,
      });
    }

    // 3. Load COA entries for all used coa_ids
    const distinctCoaIds = Array.from(new Set(ctTxs.map((tx) => tx.coa_id).filter(Boolean)));

    let coaMap = new Map();

    if (distinctCoaIds.length > 0) {
      const { data: coaRows, error: coaError } = await supabaseAdmin
        .from("chart_of_account_entries")
        .select("id, account_type, hmrc_bucket, is_control_account, is_bank_account")
        .in("id", distinctCoaIds);

      if (coaError) throw new Error(coaError.message);

      (coaRows || []).forEach((row) => {
        coaMap.set(row.id, row);
      });
    }

    // 4. Totals
    let income = 0;
    let allowable = 0;
    let disallowable = 0;

    let totalBalancingCharges = 0;
    let totalBalancingAllowances = 0;

    const breakdown = [];

    // 5. Classification using COA entries
    ctTxs.forEach((tx) => {
      const amount = Number(tx.amount || 0);
      const coa = coaMap.get(tx.coa_id);

      let ctType = "ignore";

      if (coa) {
        const bucket = coa.hmrc_bucket;
        const type = coa.account_type;

        const isControl =
          bucket === "control" ||
          bucket === "system" ||
          bucket === "balance_sheet" ||
          bucket === "equity" ||
          bucket === "liabilities" ||
          bucket === "assets" ||
          coa.is_control_account ||
          coa.is_bank_account;

        if (!isControl) {
          if (type === "INCOME") {
            ctType = "income";
          } else if (type === "EXPENSE") {
            if (bucket === "allowable") ctType = "allowable";
            else if (bucket === "disallowable") ctType = "disallowable";
          }
        }
      }

      breakdown.push({
        id: tx.id,
        date: tx.date,
        description: tx.description,
        amount,
        coa_id: tx.coa_id,
        ctType,
      });

      if (ctType === "income" && amount > 0) income += amount;
      if (ctType === "allowable" && amount < 0) allowable += Math.abs(amount);
      if (ctType === "disallowable" && amount < 0) disallowable += Math.abs(amount);

      const bc = Number(tx.assetbalancingcharge || 0);
      const ba = Number(tx.assetbalancingallowance || 0);

      if (!Number.isNaN(bc) && bc !== 0) totalBalancingCharges += bc;
      if (!Number.isNaN(ba) && ba !== 0) totalBalancingAllowances += ba;
    });

    // 6. Profit calculations
    const profit = income - allowable;
    let adjustedProfit = profit + disallowable;

    adjustedProfit += totalBalancingCharges;
    adjustedProfit -= totalBalancingAllowances;

    const { tax: corpTaxDue, rate: effectiveRate } =
      calculateCorporationTax(adjustedProfit);

    const locked = txs.some((tx) => tx.tax_locked === true);

    // 7. Return summary
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
