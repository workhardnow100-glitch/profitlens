// pages/api/reports/pnl.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

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

    // Call the new SQL function
    const { data, error } = await supabaseAdmin.rpc("profit_and_loss_for_client", {
      p_client_id: clientId,
    });

    if (error || !data || !data[0]) {
      console.error("P&L RPC error:", error);
      return res.status(200).json(emptyPnl());
    }

    const row = data[0];

    return res.status(200).json({
      summary: {
        revenue: row.revenue,
        cost_of_sales: row.cost_of_sales,
        gross_profit: row.gross_profit,
        operating_expenses: row.operating_expenses,
        net_profit: row.net_profit,
        revenue_mtd: row.revenue_mtd,
        revenue_ytd: row.revenue_ytd,
        expenses_mtd: row.expenses_mtd,
        expenses_ytd: row.expenses_ytd,
        net_profit_mtd: row.net_profit_mtd,
        net_profit_ytd: row.net_profit_ytd,
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
