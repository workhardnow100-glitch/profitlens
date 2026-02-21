// pages/api/reports/balance-sheet.ts
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
      return res.status(200).json(emptyBalanceSheet());
    }

    // 1. Fetch all balance sheet account lines
    const { data: lines, error: linesError } = await supabaseAdmin.rpc(
      "balance_sheet_lines_for_client",
      { p_client_id: clientId }
    );

    if (linesError || !lines) {
      console.error("Balance Sheet RPC error:", linesError);
      return res.status(200).json(emptyBalanceSheet());
    }

    // 2. Fetch current year profit from P&L
    const { data: pnl, error: pnlError } = await supabaseAdmin.rpc(
      "profit_and_loss_for_client",
      { p_client_id: clientId }
    );

    const currentYearProfit = pnl && pnl[0] ? pnl[0].net_profit_ytd : 0;

    // 3. Categorise lines into Assets / Liabilities / Equity
    const assetsCurrent: any[] = [];
    const assetsNonCurrent: any[] = [];
    const liabilitiesCurrent: any[] = [];
    const liabilitiesNonCurrent: any[] = [];
    const equity: any[] = [];

    for (const row of lines) {
      const code = parseInt(row.account_code, 10);
      const balance = Number(row.balance);

      // Assets
      if (code >= 1000 && code <= 1999) {
        if (code < 1500) assetsCurrent.push(row);
        else assetsNonCurrent.push(row);
        continue;
      }

      // Liabilities
      if (code >= 2000 && code <= 2999) {
        if (code < 2500) liabilitiesCurrent.push(row);
        else liabilitiesNonCurrent.push(row);
        continue;
      }

      // Equity
      if (code >= 3000 && code <= 3999) {
        equity.push(row);
        continue;
      }
    }

    // 4. Inject current year profit into equity section
    equity.push({
      account_code: "P&L",
      account_name: "Current Year Profit",
      balance: currentYearProfit,
    });

    // 5. Compute totals
    const totalAssets =
      sum(assetsCurrent) + sum(assetsNonCurrent);

    const totalLiabilities =
      sum(liabilitiesCurrent) + sum(liabilitiesNonCurrent);

    const totalEquity = sum(equity);

    const netAssets = totalAssets - totalLiabilities;

    return res.status(200).json({
      assets: {
        current: assetsCurrent,
        non_current: assetsNonCurrent,
      },
      liabilities: {
        current: liabilitiesCurrent,
        non_current: liabilitiesNonCurrent,
      },
      equity,
      totals: {
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        net_assets: netAssets,
        equity: totalEquity,
      },
    });
  } catch (err) {
    console.error("Balance sheet API error:", err);
    return res.status(200).json(emptyBalanceSheet());
  }
}

function sum(rows: any[]) {
  return rows.reduce((acc, r) => acc + Number(r.balance || 0), 0);
}

function emptyBalanceSheet() {
  return {
    assets: { current: [], non_current: [] },
    liabilities: { current: [], non_current: [] },
    equity: [],
    totals: {
      total_assets: 0,
      total_liabilities: 0,
      net_assets: 0,
      equity: 0,
    },
  };
}
