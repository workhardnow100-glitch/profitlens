// pages/api/reports/balance-sheet.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { buildAccountsFormData } from "../../../lib/accounting/builder-engine";
import type { BSStructure } from "../../../lib/accounting/balance-sheet-engine";

const safeNum = (v: any) => Number(v || 0);

function mapOverviewToBS(overview: any | null): BSStructure {
  if (!overview || !overview.totals) {
    return {
      assets: { current: [], non_current: [] },
      liabilities: { current: [], non_current: [] },
      equity: [],
      totals: {
        total_assets: 0,
        total_liabilities: 0,
        total_equity: 0,
        total_liabilities_and_equity: 0,
      },
    };
  }

  const t = overview.totals;

  const nonCurrentAssets = safeNum(t.non_current_assets);
  const currentAssets = safeNum(t.current_assets);
  const currentLiabilities = safeNum(t.current_liabilities);
  const nonCurrentLiabilities = safeNum(t.non_current_liabilities);
  const totalLiabilities = safeNum(t.total_liilities ?? t.total_liabilities);
  const totalEquity = safeNum(t.total_equity);
  const totalAssets = nonCurrentAssets + currentAssets;

  return {
    assets: {
      non_current: [
        { account_code: "FA", account_name: "Fixed assets", balance: nonCurrentAssets },
      ],
      current: [
        { account_code: "CA", account_name: "Current assets", balance: currentAssets },
      ],
    },
    liabilities: {
      non_current: [
        {
          account_code: "NCL",
          account_name: "Non-current liabilities",
          balance: nonCurrentLiabilities,
        },
      ],
      current: [
        {
          account_code: "CL",
          account_name: "Current liabilities",
          balance: currentLiabilities,
        },
      ],
    },
    equity: [
      {
        account_code: "EQ",
        account_name: "Capital and reserves",
        balance: totalEquity,
      },
    ],
    totals: {
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      total_equity: totalEquity,
      total_liabilities_and_equity: totalLiabilities + totalEquity,
    },
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const clientId = session?.user?.clientId;

    if (!clientId) {
      return res.status(200).json({
        current: mapOverviewToBS(null),
        prior: mapOverviewToBS(null),
      });
    }

    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const periodStart = `${year}-01-01`;
    const periodEnd = `${year}-12-31`;

    const { overview, overviewPrior } = await buildAccountsFormData(
      null,
      clientId,
      periodStart,
      periodEnd,
      []
    );

    const current = mapOverviewToBS(overview);
    const prior = mapOverviewToBS(overviewPrior);

    return res.status(200).json({ current, prior });
  } catch (err) {
    console.error("Balance sheet API error:", err);
    return res.status(200).json({
      current: mapOverviewToBS(null),
      prior: mapOverviewToBS(null),
    });
  }
}
