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

    const { data, error } = await supabaseAdmin.rpc("balance_sheet_for_client", {
      p_client_id: clientId,
    });

    if (error || !data || !data[0]) {
      console.error("Balance Sheet RPC error:", error);
      return res.status(200).json(emptyBs());
    }

    const row = data[0];

    return res.status(200).json({
      summary: {
        total_assets: row.total_assets,
        total_liabilities: row.total_liabilities,
        net_assets: row.net_assets,
        equity: row.equity,
        breakdown: {
          bank_assets: row.bank_assets,
          vat_liability: row.vat_liability,
          cis_liability: row.cis_liability,
          ct_liability: row.ct_liability,
          sa_liability: row.sa_liability,
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
