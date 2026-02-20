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
      return res.status(200).json(emptyBs());
    }

    const { data: transactions, error } = await supabaseAdmin
      .from("transactions")
      .select("id, date, amount, business_category, balance")
      .eq("client_id", clientId);

    if (error || !transactions) {
      return res.status(200).json(emptyBs());
    }

    let vatLiability = 0;
    let cisLiability = 0;
    let ctLiability = 0;
    let saLiability = 0;

    for (const tx of transactions as any[]) {
      const category: string = tx.business_category ?? "";
      const amount = Number(tx.amount ?? 0);

      switch (category) {
        case "VAT Collected":
          vatLiability += amount;
          break;
        case "VAT Paid":
        case "VAT Adjustment":
          vatLiability -= Math.abs(amount);
          break;
        case "CIS Deducted":
          cisLiability += amount;
          break;
        case "CIS Suffered":
          cisLiability -= Math.abs(amount);
          break;
        case "Corporation Tax Payment":
          ctLiability -= Math.abs(amount);
          break;
        case "Corporation Tax Refund":
          ctLiability += amount;
          break;
        case "SA Payment":
          saLiability -= Math.abs(amount);
          break;
        case "SA Refund":
          saLiability += amount;
          break;
      }
    }

    let bankAssets = 0;
    const withBalance = (transactions as any[]).filter(
      (t) => t.balance !== null && t.balance !== undefined
    );

    if (withBalance.length > 0) {
      withBalance.sort(
        (a, b) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      );
      bankAssets = Number(withBalance[0].balance) || 0;
    }

    const totalTaxLiabilities =
      vatLiability + cisLiability + ctLiability + saLiability;

    const totalAssets = bankAssets;
    const totalLiabilities = totalTaxLiabilities;
    const netAssets = totalAssets - totalLiabilities;
    const equity = netAssets;

    return res.status(200).json({
      summary: {
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        net_assets: netAssets,
        equity,
        breakdown: {
          bank_assets: bankAssets,
          vat_liability: vatLiability,
          cis_liability: cisLiability,
          ct_liability: ctLiability,
          sa_liability: saLiability,
        },
      },
    });
  } catch (err) {
    console.error("Balance sheet API error:", err);
    return res.status(200).json(emptyBs());
  }
}

function emptyBs() {
  return {
    summary: {
      total_assets: 0,
      total_liabilities: 0,
      net_assets: 0,
      equity: 0,
      breakdown: {
        bank_assets: 0,
        vat_liability: 0,
        cis_liability: 0,
        ct_liability: 0,
        sa_liability: 0,
      },
    },
  };
}
