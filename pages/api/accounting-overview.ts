// pages/api/accounting-overview.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { CT_MAP } from "../../lib/constants/ctMap";
import { ALLOWED_BUSINESS_CATEGORIES } from "../../lib/category/Engine";

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

    const { data: transactions, error } = await supabaseAdmin
      .from("transactions")
      .select("id, date, amount, business_category, balance")
      .eq("client_id", clientId);

    if (error || !transactions) {
      return res.status(200).json(emptyOverview());
    }

    // Prepare CT_MAP sets
    const incomeSet = new Set(CT_MAP.income);
    const allowableSet = new Set(CT_MAP.allowable);
    const disallowableSet = new Set(CT_MAP.disallowable);
    const ignoreSet = new Set(CT_MAP.ignore);

    // Time boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Aggregates
    let incomeTotal = 0;
    let expenseTotal = 0;

    let revenueMtd = 0;
    let revenueYtd = 0;
    let expensesMtd = 0;
    let expensesYtd = 0;

    let uncategorisedCount = 0;
    let negativeBalanceCount = 0;

    // 2) Classify and aggregate
    for (const tx of transactions) {
      const date = tx.date ? new Date(tx.date) : null;
      const category = tx.business_category ?? "";
      const amount = Number(tx.amount ?? 0);

      // Negative balance alert
      if (tx.balance !== null && Number(tx.balance) < 0) {
        negativeBalanceCount += 1;
      }

      // Uncategorised
      if (!category || !ALLOWED_BUSINESS_CATEGORIES.has(category)) {
        uncategorisedCount += 1;
        continue;
      }

      // Ignore bucket
      if (ignoreSet.has(category)) {
        continue;
      }

      const isIncome = incomeSet.has(category);
      const isAllowable = allowableSet.has(category);
      const isDisallowable = disallowableSet.has(category);

      // Income
      if (isIncome) {
        incomeTotal += amount;

        if (date) {
          if (date >= startOfMonth) revenueMtd += amount;
          if (date >= startOfYear) revenueYtd += amount;
        }
        continue;
      }

      // Expenses (allowable + disallowable)
      if (isAllowable || isDisallowable) {
        const absAmount = Math.abs(amount);
        expenseTotal += absAmount;

        if (date) {
          if (date >= startOfMonth) expensesMtd += absAmount;
          if (date >= startOfYear) expensesYtd += absAmount;
        }
        continue;
      }
    }

    const netProfitMtd = revenueMtd - expensesMtd;
    const netProfitYtd = revenueYtd - expensesYtd;
    const netProfit = incomeTotal - expenseTotal;

    return res.status(200).json({
      financial_health: {
        assets: 0,
        liabilities: 0,
        equity: 0,
        revenue_mtd: revenueMtd,
        revenue_ytd: revenueYtd,
        expenses_mtd: expensesMtd,
        expenses_ytd: expensesYtd,
        net_profit_mtd: netProfitMtd,
        net_profit_ytd: netProfitYtd,
      },
      trial_balance: {
        assets: 0,
        liabilities: 0,
        equity: 0,
        income: incomeTotal,
        expenses: expenseTotal,
      },
      profit_and_loss: {
        revenue: incomeTotal,
        cost_of_sales: 0,
        gross_profit: incomeTotal,
        operating_expenses: expenseTotal,
        net_profit: netProfit,
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
      alerts: [
        {
          type: "uncategorised_transactions",
          count: uncategorisedCount,
          severity: uncategorisedCount > 0 ? "high" : "low",
          link: "/transactions?filter=uncategorised",
        },
        {
          type: "negative_balance",
          count: negativeBalanceCount,
          severity: negativeBalanceCount > 0 ? "medium" : "low",
          link: "/transactions?filter=negative_balance",
        },
      ],
      quick_actions: [
        { label: "Add Account", link: "/settings/chart-of-accounts?mode=add" },
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
