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

    const { data, error } = await supabaseAdmin.rpc(
      "accounting_overview_for_client",
      { p_client_id: clientId }
    );

    if (error || !data || !data[0]) {
      console.error("Overview RPC error:", error);
      return res.status(200).json(emptyOverview());
    }

    const o = data[0];

    return res.status(200).json({
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
      trial_balance: {
        assets: o.total_assets,
        liabilities: o.total_liabilities,
        equity: o.equity,
        income: o.total_income,
        expenses: o.total_expenses,
      },
      profit_and_loss: {
        revenue: o.total_income,
        cost_of_sales: 0,
        gross_profit: o.total_income,
        operating_expenses: o.total_expenses,
        net_profit: o.net_profit,
      },
      balance_sheet: {
        total_assets: o.total_assets,
        total_liabilities: o.total_liabilities,
        net_assets: o.total_assets - o.total_liabilities,
        equity: o.equity,
      },
      coa_summary: {
        total_accounts: 0,
        active_accounts: 0,
        system_accounts: 0,
        uncategorised_accounts: 0,
        suspense_accounts: 0,
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
    trial_balance: {
      assets: 0,
      liabilities: 0,
      equity: 0,
      income: 0,
      expenses: 0,
    },
    profit_and_loss: {
      revenue: 0,
      cost_of_sales: 0,
      gross_profit: 0,
      operating_expenses: 0,
      net_profit: 0,
    },
    balance_sheet: {
      total_assets: 0,
      total_liabilities: 0,
      net_assets: 0,
      equity: 0,
    },
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
