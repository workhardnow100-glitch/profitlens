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
 *     - Drilldown rows built from journal_entries + journal_lines + COA
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
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: session.user.email,
        action: isAccountant ? "ACCOUNTANT_VIEW_CT_SUMMARY" : "VIEW_CT_SUMMARY",
        details: `Viewed CT summary for ${periodStart} → ${periodEnd}`,
        timestamp: new Date().toISOString(),
      },
    ]);

    // 1. Unified accounting data
    const pl = await getUnifiedProfitAndLoss(clientId);
    const tb = await getUnifiedTrialBalance(clientId);

    // 2. Classify trial-balance lines with correct CT amounts (for summary tiles)
    const breakdown = (tb.lines || []).map((line) => {
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

    // 2.5 Journal-based drilldown: journal_entries + journal_lines + COA
    // Step 1: journal entries in period for this client
    const { data: jeRows, error: jeErr } = await supabaseAdmin
      .from("journal_entries")
      .select("id, client_id, date, description")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (jeErr) throw jeErr;

    const journalIds = (jeRows || []).map((j) => j.id);
    let drilldown = [];

    if (journalIds.length > 0) {
      // Step 2: journal lines for those entries
      const { data: jlRows, error: jlErr } = await supabaseAdmin
        .from("journal_lines")
        .select("id, journal_id, account_id, debit, credit")
        .in("journal_id", journalIds);

      if (jlErr) throw jlErr;

      const accountIds = Array.from(
        new Set((jlRows || []).map((l) => l.account_id).filter(Boolean))
      );

      // Step 3: COA rows for those accounts
      let coaMap = {};
      if (accountIds.length > 0) {
        const { data: coaRows, error: coaErr } = await supabaseAdmin
          .from("chart_of_account_entries")
          .select("id, account_code, account_name, account_type, hmrc_bucket")
          .in("id", accountIds);

        if (coaErr) throw coaErr;

        coaMap =
          (coaRows || []).length > 0
            ? Object.fromEntries(coaRows.map((c) => [c.id, c]))
            : {};
      }

      const jeMap =
        (jeRows || []).length > 0
          ? Object.fromEntries(jeRows.map((j) => [j.id, j]))
          : {};

      // Step 4: build drilldown rows with CT classification
      drilldown = (jlRows || []).map((row) => {
        const je = jeMap[row.journal_id] || {};
        const coa = coaMap[row.account_id] || {};

        const debit = Number(row.debit || 0);
        const credit = Number(row.credit || 0);

        let ctType = "ignore";
        let amount = 0;

        if (coa.account_type === "INCOME") {
          ctType = "income";
          amount = credit;
        } else if (coa.account_type === "EXPENSE") {
          const netExpense = debit - credit;
          if (coa.hmrc_bucket === "allowable") {
            ctType = "allowable";
            amount = netExpense > 0 ? netExpense : 0;
          } else if (coa.hmrc_bucket === "disallowable") {
            ctType = "disallowable";
            amount = netExpense > 0 ? netExpense : 0;
          } else {
            ctType = "review";
            amount = netExpense > 0 ? netExpense : 0;
          }
        }

        return {
          id: row.id,
          date: je.date,
          description: je.description,
          account_code: coa.account_code,
          account_name: coa.account_name,
          hmrc_bucket: coa.hmrc_bucket,
          account_type: coa.account_type,
          ctType,
          amount,
        };
      });
    }

    // 3. Totals (from breakdown)
    const income = breakdown
      .filter((b) => b.ctType === "income")
      .reduce((sum, b) => sum + b.amount, 0);

    const allowable = breakdown
      .filter((b) => b.ctType === "allowable")
      .reduce((sum, b) => sum + b.amount, 0);

    const disallowable = breakdown
      .filter((b) => b.ctType === "disallowable")
      .reduce((sum, b) => sum + b.amount, 0);

    // 4. Profit from unified P&L
    const profit = pl.summary.net_profit;

    // 5. Adjusted profit
    const adjustedProfit = profit + disallowable;

    // 6. Corporation Tax
    const { tax: corpTaxDue, rate: effectiveRate } =
      calculateCorporationTax(adjustedProfit);

    // 7. Return summary + journal-based drilldown
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
      drilldown, // journal-based rows with date/description/account/ctType/amount
    });
  } catch (err) {
    console.error("CT summary error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
