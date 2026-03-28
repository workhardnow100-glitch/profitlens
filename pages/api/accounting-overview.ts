// pages/api/accounting-overview.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

import {
  getUnifiedBalanceSheet,
  getUnifiedTrialBalance,
  getUnifiedProfitAndLoss,
  getUnifiedDirectorLoan,
  getUnifiedCashFlow,
} from "../../lib/accounting/balance-sheet-engine";

// Normalise every BSLine row so UI never receives undefined values
function normalizeLine(line: any) {
  return {
    account_code: String(line.account_code || ""),
    account_name: String(line.account_name || ""),
    account_type: line.account_type || null,
    hmrc_bucket: line.hmrc_bucket || null,
    debit: Number(line.debit || 0),
    credit: Number(line.credit || 0),
    balance: Number(line.balance || 0),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const clientId = session?.user?.clientId;

    if (!clientId) {
      return res.status(200).json(emptyOverview());
    }

    // ------------------------------------------------------------
    // 1) UNIFIED JOURNAL ENGINE
    // ------------------------------------------------------------
    const [
      unifiedBS,
      unifiedTB,
      unifiedPL,
      unifiedDL,
      unifiedCF,
    ] = await Promise.all([
      getUnifiedBalanceSheet(clientId),
      getUnifiedTrialBalance(clientId),
      getUnifiedProfitAndLoss(clientId),
      getUnifiedDirectorLoan(clientId),
      getUnifiedCashFlow(clientId),
    ]);

    // ------------------------------------------------------------
    // 2) COA SUMMARY
    // ------------------------------------------------------------
    const { data: coa, error: coaError } = await supabaseAdmin
      .from("chart_of_accounts")
      .select("id")
      .eq("client_id", clientId)
      .single();

    let totalAccounts = 0;
    let activeAccounts = 0;
    let systemAccounts = 0;
    let uncategorisedAccounts = 0;
    let suspenseAccounts = 0;

    if (!coaError && coa) {
      const { data: coaEntries } = await supabaseAdmin
        .from("chart_of_account_entries")
        .select("account_code, account_type, is_system, has_activity")
        .eq("coa_id", coa.id);

      if (coaEntries) {
        totalAccounts = coaEntries.length;
        activeAccounts = coaEntries.filter((a) => a.has_activity).length;
        systemAccounts = coaEntries.filter((a) => a.is_system).length;
        uncategorisedAccounts = coaEntries.filter((a) => a.account_code === "9020").length;
        suspenseAccounts = coaEntries.filter((a) => a.account_code === "9999").length;
      }
    }

    // ------------------------------------------------------------
    // 3) BUILD RESPONSE (ALL NUMBERS SAFE)
    // ------------------------------------------------------------
    const pl = unifiedPL.summary;
    const tb = unifiedTB.summary;
    const bs = unifiedBS.totals;

    return res.status(200).json({
      // -------------------------
      // FINANCIAL HEALTH SUMMARY
      // -------------------------
      financial_health: {
        assets: Number(bs.total_assets || 0),
        liabilities: Number(bs.total_liabilities || 0),
        equity: Number(bs.total_equity || 0),

        revenue_mtd: Number(pl.revenue || 0),
        revenue_ytd: Number(pl.revenue || 0),

        expenses_mtd: Number(pl.operating_expenses || 0),
        expenses_ytd: Number(pl.operating_expenses || 0),

        net_profit_mtd: Number(pl.net_profit || 0),
        net_profit_ytd: Number(pl.net_profit || 0),
      },

      // -------------------------
      // SUMMARY PANELS
      // -------------------------
      trial_balance_summary: {
        assets: Number(tb.assets || 0),
        liabilities: Number(tb.liabilities || 0),
        equity: Number(tb.equity || 0),
        income: Number(tb.income || 0),
        expenses: Number(tb.expenses || 0),
      },

      profit_and_loss_summary: {
        revenue: Number(pl.revenue || 0),
        cost_of_sales: Number(pl.cost_of_sales || 0),
        gross_profit: Number(pl.gross_profit || 0),
        operating_expenses: Number(pl.operating_expenses || 0),
        net_profit: Number(pl.net_profit || 0),
      },

      balance_sheet_summary: {
        total_assets: Number(bs.total_assets || 0),
        total_liabilities: Number(bs.total_liabilities || 0),
        net_assets: Number((bs.total_assets || 0) - (bs.total_liabilities || 0)),
        equity: Number(bs.total_equity || 0),
      },

      // -------------------------
      // FULL REPORTING ENGINE (ARRAYS ONLY + NORMALIZED)
      // -------------------------
      trial_balance_full: unifiedTB.lines.map(normalizeLine),

      balance_sheet_full: [
        ...unifiedBS.assets.current,
        ...unifiedBS.assets.non_current,
        ...unifiedBS.liabilities.current,
        ...unifiedBS.liabilities.non_current,
        ...unifiedBS.equity,
      ].map(normalizeLine),

      profit_and_loss_full: unifiedPL.lines.map(normalizeLine),
      director_loan_ledger: unifiedDL.lines.map(normalizeLine),

      bank_accounts: [],
      vat_control: [],
      paye_control: [],
      corporation_tax: [],
      fixed_assets: [],
      suspense_and_uncategorised: [],

      cash_flow: unifiedCF.lines.map((l) => ({
        ...l,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
      })),

      // -------------------------
      // COA SUMMARY
      // -------------------------
      coa_summary: {
        total_accounts: totalAccounts,
        active_accounts: activeAccounts,
        system_accounts: systemAccounts,
        uncategorised_accounts: uncategorisedAccounts,
        suspense_accounts: suspenseAccounts,
      },

      alerts: [],
      quick_actions: [
        { label: "Add Account", link: "/setting/chart-of-accounts" },
        { label: "Post Journal", link: "/journal/new" },
        { label: "View Transactions", link: "/transactions" },
        { label: "Reconcile Bank", link: "/bank-reconciliation" },
        { label: "Create Invoice", link: "/invoices/new" },
        { label: "Upload Statement", link: "/upload" },
        { label: "Run VAT Return", link: "/vat" },
      ],
    });

  } catch (err) {
    console.error("Accounting overview handler error:", err);
    return res.status(200).json(emptyOverview());
  }
}

function emptyOverview() {
  return {
    financial_health: {
      assets: 0,
      liabilities: 0,
      equity: 0,
      revenue_mtd: 0,
      revenue_ytd: 0,
      expenses_mtd: 0,
      expenses_ytd: 0,
      net_profit_mtd: 0,
      net_profit_ytd: 0,
    },
    trial_balance_summary: {
      assets: 0,
      liabilities: 0,
      equity: 0,
      income: 0,
      expenses: 0,
    },
    profit_and_loss_summary: {
      revenue: 0,
      cost_of_sales: 0,
      gross_profit: 0,
      operating_expenses: 0,
      net_profit: 0,
    },
    balance_sheet_summary: {
      total_assets: 0,
      total_liabilities: 0,
      net_assets: 0,
      equity: 0,
    },
    trial_balance_full: [],
    balance_sheet_full: [],
    profit_and_loss_full: [],
    director_loan_ledger: [],
    bank_accounts: [],
    vat_control: [],
    paye_control: [],
    corporation_tax: [],
    fixed_assets: [],
    suspense_and_uncategorised: [],
    cash_flow: [],
    coa_summary: {
      total_accounts: 0,
      active_accounts: 0,
      system_accounts: 0,
      uncategorised_accounts: 0,
      suspense_accounts: 0,
    },
    alerts: [],
    quick_actions: [],
  };
}
