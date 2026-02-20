// pages/api/reports/pnl.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { CT_MAP } from "../../../lib/constants/ctMap";
import { ALLOWED_BUSINESS_CATEGORIES } from "../../../lib/category/Engine";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const clientId = session?.user?.clientId;

    if (!clientId) {
      return res.status(200).json(emptyPnl());
    }

    const { data: transactions, error } = await supabaseAdmin
      .from("transactions")
      .select("id, date, amount, business_category")
      .eq("client_id", clientId);

    if (error || !transactions) {
      return res.status(200).json(emptyPnl());
    }

    const incomeSet = new Set(CT_MAP.income);
    const allowableSet = new Set(CT_MAP.allowable);
    const disallowableSet = new Set(CT_MAP.disallowable);
    const ignoreSet = new Set(CT_MAP.ignore);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let incomeTotal = 0;
    let expenseTotal = 0;

    let revenueMtd = 0;
    let revenueYtd = 0;
    let expensesMtd = 0;
    let expensesYtd = 0;

    for (const tx of transactions as any[]) {
      const date = tx.date ? new Date(tx.date) : null;
      const category: string = tx.business_category ?? "";
      const amount = Number(tx.amount ?? 0);

      if (!category || !ALLOWED_BUSINESS_CATEGORIES.has(category)) {
        continue;
      }

      if (ignoreSet.has(category)) continue;

      const isIncome = incomeSet.has(category);
      const isAllowable = allowableSet.has(category);
      const isDisallowable = disallowableSet.has(category);

      if (isIncome) {
        incomeTotal += amount;
        if (date) {
          if (date >= startOfMonth) revenueMtd += amount;
          if (date >= startOfYear) revenueYtd += amount;
        }
        continue;
      }

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
      summary: {
        revenue: incomeTotal,
        cost_of_sales: 0,
        gross_profit: incomeTotal,
        operating_expenses: expenseTotal,
        net_profit: netProfit,
        revenue_mtd: revenueMtd,
        revenue_ytd: revenueYtd,
        expenses_mtd: expensesMtd,
        expenses_ytd: expensesYtd,
        net_profit_mtd: netProfitMtd,
        net_profit_ytd: netProfitYtd,
      },
    });
  } catch (err) {
    console.error("P&L API error:", err);
    return res.status(200).json(emptyPnl());
  }
}

function emptyPnl() {
  return {
    summary: {
      revenue: 0,
      cost_of_sales: 0,
      gross_profit: 0,
      operating_expenses: 0,
      net_profit: 0,
      revenue_mtd: 0,
      revenue_ytd: 0,
      expenses_mtd: 0,
      expenses_ytd: 0,
      net_profit_mtd: 0,
      net_profit_ytd: 0,
    },
  };
}
