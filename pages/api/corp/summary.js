/**
 * ============================================================
 * File: pages/api/corp/summary.js
 * Purpose:
 *   Compute Corporation Tax summary using the UNIFIED JOURNAL ENGINE:
 *     - Trading income (journal-driven)
 *     - Allowable expenses (hmrc_bucket = 'allowable')
 *     - Disallowable expenses (hmrc_bucket = 'disallowable')
 *     - Profit (from unified P&L)
 *     - Adjusted profit (profit + disallowables)
 *     - Corporation Tax due (marginal relief aware)
 *     - Breakdown rows (journal lines classified by COA)
 * ============================================================
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

import {
  getUnifiedProfitAndLoss,
  getUnifiedTrialBalance,
  getUnifiedBalanceSheet,
} from "../../../lib/accounting/balance-sheet-engine";

// Marginal relief calculator (unchanged)
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

    // 1. Load unified accounting data
    const pl = await getUnifiedProfitAndLoss(clientId);
    const tb = await getUnifiedTrialBalance(clientId);

    // 2. Classify journal lines
    const breakdown = tb.lines.map((line) => {
      let ctType = "ignore";

      if (line.account_type === "INCOME") {
        ctType = "income";
      } else if (line.account_type === "EXPENSE") {
        if (line.hmrc_bucket === "allowable") ctType = "allowable";
        else if (line.hmrc_bucket === "disallowable") ctType = "disallowable";
        else ctType = "review";
      }

      return {
        account_code: line.account_code,
        account_name: line.account_name,
        amount: line.balance,
        hmrc_bucket: line.hmrc_bucket,
        account_type: line.account_type,
        ctType,
      };
    });

    // 3. Totals
    const income = breakdown
      .filter((b) => b.ctType === "income")
      .reduce((sum, b) => sum + b.amount, 0);

    const allowable = breakdown
      .filter((b) => b.ctType === "allowable")
      .reduce((sum, b) => sum + Math.abs(b.amount), 0);

    const disallowable = breakdown
      .filter((b) => b.ctType === "disallowable")
      .reduce((sum, b) => sum + Math.abs(b.amount), 0);

    // 4. Profit from unified P&L
    const profit = pl.summary.net_profit;

    // 5. Adjusted profit
    const adjustedProfit = profit + disallowable;

    // 6. Corporation Tax
    const { tax: corpTaxDue, rate: effectiveRate } =
      calculateCorporationTax(adjustedProfit);

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
      breakdown,
    });
  } catch (err) {
    console.error("CT summary error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
