/**
 * ============================================================
 * File: pages/api/corp/summary.js
 * Purpose:
 *   Compute Corporation Tax summary using the UNIFIED JOURNAL ENGINE:
 * ============================================================
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

import {
  getUnifiedProfitAndLoss,
  getUnifiedTrialBalance,
} from "../../../lib/accounting/balance-sheet-engine";

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

  console.log("🔥 CT SUMMARY API VERSION: ORIGINAL");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

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

  const startDate = periodStart.substring(0, 10);
  const endDate = periodEnd.substring(0, 10);

  try {
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: session.user.email,
        action: isAccountant ? "ACCOUNTANT_VIEW_CT_SUMMARY" : "VIEW_CT_SUMMARY",
        details: `Viewed CT summary for ${startDate} → ${endDate}`,
        timestamp: new Date().toISOString(),
      },
    ]);

    // 1. Unified accounting data (NO DATE FILTERING)
    const pl = await getUnifiedProfitAndLoss(clientId);
    const tb = await getUnifiedTrialBalance(clientId);

    // 2. Classify trial-balance lines
    const breakdown = (tb.lines || []).map((line) => {
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);

      let ctType = "ignore";
      let ctAmount = 0;

      if (line.account_type === "INCOME") {
        ctType = "income";
        ctAmount = credit;
      } else if (line.account_type === "EXPENSE") {
        const netExpense = debit - credit;

        if (line.hmrc_bucket === "allowable") {
          ctType = "allowable";
          ctAmount = Math.max(netExpense, 0);
        } else if (line.hmrc_bucket === "disallowable") {
          ctType = "disallowable";
          ctAmount = Math.max(netExpense, 0);
        } else {
          ctType = "review";
          ctAmount = Math.max(netExpense, 0);
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

    // 2.5 Journal-based drilldown (DATE FILTERED)
    const { data: jlJoined, error: jlJoinedErr } = await supabaseAdmin
      .from("journal_lines")
      .select(`
        id,
        debit,
        credit,
        journal_id,
        account_id,
        journal_entries:journal_id (
          id,
          client_id,
          date,
          description
        ),
        chart_of_account_entries:account_id (
          id,
          account_code,
          account_name,
          account_type,
          hmrc_bucket
        )
      `)
      .eq("journal_entries.client_id", clientId)
      .gte("journal_entries.date", startDate)
      .lte("journal_entries.date", endDate);

    if (jlJoinedErr) throw jlJoinedErr;

    const drilldown = (jlJoined || []).map((row) => {
      const je = row.journal_entries || {};
      const coa = row.chart_of_account_entries || {};

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
          amount = Math.max(netExpense, 0);
        } else if (coa.hmrc_bucket === "disallowable") {
          ctType = "disallowable";
          amount = Math.max(netExpense, 0);
        } else {
          ctType = "review";
          amount = Math.max(netExpense, 0);
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

    // 3. Totals (ALWAYS FULL-YEAR)
    const income = breakdown.filter((b) => b.ctType === "income").reduce((s, b) => s + b.amount, 0);
    const allowable = breakdown.filter((b) => b.ctType === "allowable").reduce((s, b) => s + b.amount, 0);
    const disallowable = breakdown.filter((b) => b.ctType === "disallowable").reduce((s, b) => s + b.amount, 0);

    const profit = pl.summary.net_profit;
    const adjustedProfit = profit + disallowable;

    const { tax: corpTaxDue, rate: effectiveRate } =
      calculateCorporationTax(adjustedProfit);

    return res.status(200).json({
      success: true,
      periodStart: startDate,
      periodEnd: endDate,
      income,
      allowable,
      disallowable,
      profit,
      adjustedProfit,
      corpTaxDue,
      effectiveRate,
      breakdown,
      drilldown,
    });
  } catch (err) {
    console.error("CT summary error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
