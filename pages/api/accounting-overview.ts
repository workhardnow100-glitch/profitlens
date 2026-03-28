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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    // 1) UNIFIED JOURNAL-DRIVEN ENGINE
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
    // 2) COA SUMMARY (unchanged, still from COA tables)
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
    // 3) RETURN UNIFIED COCKPIT PAYLOAD (ALL FROM JOURNALS)
    // ------------------------------------------------------------
    const plSummary = unifiedPL.summary;
    const tbSummary = unifiedTB.summary;
    const bsTotals = unifiedBS.totals;

    return res.status(200).json({
      // -------------------------
      // FINANCIAL HEALTH SUMMARY
      // -------------------------
      financial_health: {
        assets: bsTotals.total_assets,
        liabilities: bsTotals.total_liabilities,
        equity: bsTotals.total_equity,
        // For now, MTD/YTD mirror full-period totals (all journal data)
        revenue_mtd: plSummary.revenue,
        revenue_ytd: plSummary.revenue,
        expenses_mtd: plSummary.operating_expenses,
        expenses_ytd: plSummary.operating_expenses,
        net_profit_mtd: plSummary.net_profit,
        net_profit_ytd: plSummary.net_profit,
      },

      // -------------------------
      // SUMMARY PANELS
      // -------------------------
      trial_balance_summary: {
        assets: tbSummary.assets,
        liabilities: tbSummary.liabilities,
        equity: tbSummary.equity,
        income: tbSummary.income,
        expenses: tbSummary.expenses,
      },

      profit_and_loss_summary: {
        revenue: plSummary.revenue,
        cost_of_sales: plSummary.cost_of_sales,
        gross_profit: plSummary.gross_profit,
        operating_expenses: plSummary.operating_expenses,
        net_profit: plSummary.net_profit,
      },

      balance_sheet_summary: {
        total_assets: bsTotals.total_assets,
        total_liabilities: bsTotals.total_liabilities,
        net_assets: bsTotals.total_assets - bsTotals.total_liabilities,
        equity: bsTotals.total_equity,
      },

      // -------------------------
      // FULL REPORTING ENGINE (JOURNAL-DRIVEN)
      // -------------------------
      trial_balance_full: unifiedTB.lines,
      balance_sheet_full: unifiedBS,
      profit_and_loss_full: unifiedPL.lines,
      director_loan_ledger: unifiedDL.lines,

      bank_accounts: [], // can be derived later if you want from journals
      vat_control: [],
      paye_control: [],
      corporation_tax: [],
      fixed_assets: [],
      suspense_and_uncategorised: [],
      cash_flow: unifiedCF.summary,

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
