// pages/api/accounting-overview.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

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
    // 1) MAIN OVERVIEW SUMMARY (existing RPC)
    // ------------------------------------------------------------
    const { data: overviewData, error: overviewError } = await supabaseAdmin.rpc(
      "accounting_overview_for_client",
      { p_client_id: clientId }
    );

    if (overviewError || !overviewData || !overviewData[0]) {
      console.error("Overview RPC error:", overviewError);
      return res.status(200).json(emptyOverview());
    }

    const o = overviewData[0];

    // ------------------------------------------------------------
    // 2) FULL REPORTING ENGINE (11 RPCs)
    // ------------------------------------------------------------
    const [
      { data: tbFull },
      { data: bsFull },
      { data: plFull },
      { data: dlFull },
      { data: bankAccounts },
      { data: vatControl },
      { data: payeControl },
      { data: corporationTax },
      { data: fixedAssets },
      { data: suspenseData },
      { data: cashFlow }
    ] = await Promise.all([
      supabaseAdmin.rpc("trial_balance_full_for_client", { p_client_id: clientId }),
      supabaseAdmin.rpc("balance_sheet_for_client", { p_client_id: clientId }),
      supabaseAdmin.rpc("profit_and_loss_for_client", { p_client_id: clientId }),
      supabaseAdmin.rpc("director_loan_for_client", { p_client_id: clientId }),
      supabaseAdmin.rpc("bank_accounts_for_client", { p_client_id: clientId }),
      supabaseAdmin.rpc("vat_control_for_client", { p_client_id: clientId }),
      supabaseAdmin.rpc("paye_control_for_client", { p_client_id: clientId }),
      supabaseAdmin.rpc("corporation_tax_for_client", { p_client_id: clientId }),
      supabaseAdmin.rpc("fixed_assets_for_client", { p_client_id: clientId }),
      supabaseAdmin.rpc("suspense_and_uncategorised_for_client", { p_client_id: clientId }),
      supabaseAdmin.rpc("cash_flow_for_client", { p_client_id: clientId })
    ]);

    // ------------------------------------------------------------
    // 3) COA SUMMARY (existing logic)
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
    // 4) RETURN UNIFIED COCKPIT PAYLOAD
    // ------------------------------------------------------------
    return res.status(200).json({
      // -------------------------
      // FINANCIAL HEALTH SUMMARY
      // -------------------------
      financial_health: {
        assets: o.total_assets,
        liabilities: o.total_liabilities,
        equity: o.equity,
        revenue_mtd: o.revenue_mtd,
        revenue_ytd: o.revenue_ytd,
        expenses_mtd: o.expenses_mtd,
        expenses_ytd: o.expenses_ytd,
        net_profit_mtd: o.net_profit_mtd,
        net_profit_ytd: o.net_profit_ytd,
      },

      // -------------------------
      // SUMMARY PANELS (existing)
      // -------------------------
      trial_balance_summary: {
        assets: o.total_assets,
        liabilities: o.total_liabilities,
        equity: o.equity,
        income: o.total_income,
        expenses: o.total_expenses,
      },

      profit_and_loss_summary: {
        revenue: o.total_income,
        cost_of_sales: 0,
        gross_profit: o.total_income,
        operating_expenses: o.total_expenses,
        net_profit: o.net_profit,
      },

      balance_sheet_summary: {
        total_assets: o.total_assets,
        total_liabilities: o.total_liabilities,
        net_assets: o.total_assets - o.total_liabilities,
        equity: o.equity,
      },

      // -------------------------
      // FULL REPORTING ENGINE
      // -------------------------
      trial_balance_full: tbFull ?? [],
      balance_sheet_full: bsFull ?? [],
      profit_and_loss_full: plFull ?? [],
      director_loan_ledger: dlFull ?? [],

      bank_accounts: bankAccounts ?? [],
      vat_control: vatControl ?? [],
      paye_control: payeControl ?? [],
      corporation_tax: corporationTax ?? [],
      fixed_assets: fixedAssets ?? [],
      suspense_and_uncategorised: suspenseData ?? [],
      cash_flow: cashFlow ?? [],

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
