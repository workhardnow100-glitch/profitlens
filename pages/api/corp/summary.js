/**
 * ============================================================
 * File: pages/api/corp/summary.js
 * Purpose:
 *   Compute Corporation Tax summary using the UNIFIED JOURNAL ENGINE:
 *     - Trading income (credit)
 *     - Allowable expenses (net debit)
 *     - Disallowable expenses (net debit)
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
    // 1.5 Load raw transactions for drilldowns
const { data: txRows, error: txErr } = await supabaseAdmin
  .from("transactions")
  .select(`
    id,
    date,
    description,
    amount,
    business_category,
    coa_id,
    includedinct
  `)
  .eq("client_id", clientId)
  .gte("date", periodStart)
  .lte("date", periodEnd);

if (txErr) throw txErr;

// Build COA map for drilldown classification
const distinctCoaIds = Array.from(
  new Set(txRows.map((t) => t.coa_id).filter(Boolean))
);

let coaMap = {};
if (distinctCoaIds.length > 0) {
  const { data: coaRows, error: coaErr } = await supabaseAdmin
    .from("chart_of_account_entries")
    .select("id, account_type, hmrc_bucket, account_name, account_code")
    .in("id", distinctCoaIds);

  if (coaErr) throw coaErr;

  coaMap = Object.fromEntries(coaRows.map((c) => [c.id, c]));
}


    // 2. Classify journal lines with correct CT amounts
    const breakdown = tb.lines.map((line) => {
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);

      let ctType = "ignore";
      let ctAmount = 0;

      if (line.account_type === "INCOME") {
        ctType = "income";
        ctAmount = credit; // income = credit
      } else if (line.account_type === "EXPENSE") {
        const netExpense = debit - credit; // expense = debit - credit

        if (line.hmrc_bucket === "allowable") {
          ctType = "allowable";
          ctAmount = netExpense > 0 ? netExpense : 0;
        } else if (line.hmrc_bucket === "disallowable") {
          ctType = "disallowable";
          ctAmount = netExpense > 0 ? netExpense : 0;
        } else {
          ctType = "review";
          ctAmount = netExpense > 0 ? netExpense : 0;
        }
      }

      return {
        account_code: line.account_code,
        account_name: line.account_name,
        hmrc_bucket: line.hmrc_bucket,
        account_type: line.account_type,
        debit,
        credit,
        balance: Number(line.balance || 0),
        ctType,
        amount: ctAmount,
      };
    });

    // 3. Totals (correct sign logic)
    const income = breakdown
      .filter((b) => b.ctType === "income")
      .reduce((sum, b) => sum + b.amount, 0);

    const allowable = breakdown
      .filter((b) => b.ctType === "allowable")
      .reduce((sum, b) => sum + b.amount, 0);

    const disallowable = breakdown
      .filter((b) => b.ctType === "disallowable")
      .reduce((sum, b) => sum + b.amount, 0);

    // 4. Profit from unified P&L (correct)
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

  // NEW: drilldown data for the CT page
  transactions: txRows,
  coaMap,
});

  } catch (err) {
    console.error("CT summary error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
