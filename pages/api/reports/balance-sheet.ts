// pages/api/reports/balance-sheet.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { getUnifiedBalanceSheet } from "../../../lib/accounting/balance-sheet-engine";

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

    // 🔥 Unified engine: journals + full reporting engine
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    const current = await getUnifiedBalanceSheet(clientId, year);
    const prior = await getUnifiedBalanceSheet(clientId, year - 1);

    return res.status(200).json({
      current,
      prior,
    });

  } catch (err) {
    console.error("Balance sheet API error:", err);
    return res.status(200).json(emptyBalanceSheet());
  }
}

function emptyBalanceSheet() {
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
