// pages/api/reports/balance-sheet.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

type BSLine = {
  id?: string;
  label: string;
  amount: number;
  isCustom?: boolean;
};

type BSStructure = {
  assets: {
    non_current: BSLine[];
    current: BSLine[];
  };
  liabilities: {
    non_current: BSLine[];
    current: BSLine[];
  };
  equity: BSLine[];
};

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

    const yearParam = req.query.year
      ? parseInt(String(req.query.year), 10)
      : undefined;

    // 1. Ledger lines (optionally year-aware if your RPC supports it)
    const { data: ledgerLines, error: ledgerError } = await supabaseAdmin.rpc(
      "balance_sheet_lines_for_client",
      { p_client_id: clientId } // extend with year if you add it in SQL
    );

    if (ledgerError) {
      console.error("Balance sheet ledger RPC error:", ledgerError);
      return res.status(200).json(emptyBalanceSheet());
    }

    // 2. Custom lines (filter by year if provided)
    let customQuery = supabaseAdmin
      .from("balance_sheet_custom_lines")
      .select("*")
      .eq("client_id", clientId)
      .order("sort_order", { ascending: true });

    if (yearParam) {
      customQuery = customQuery.eq("year", yearParam);
    }

    const { data: customLines, error: customError } = await customQuery;

    if (customError) {
      console.error("Balance sheet custom lines error:", customError);
    }

    // 3. Map ledger accounts to UK categories
    const mapped = mapLedgerToUKStructure(ledgerLines || []);

    // 4. Merge custom lines
    mergeCustomLines(mapped, customLines || []);

    // 5. Compute totals
    const totals = computeTotals(mapped);

    return res.status(200).json({
      assets: mapped.assets,
      liabilities: mapped.liabilities,
      equity: mapped.equity,
      totals,
    });
  } catch (err) {
    console.error("Balance sheet API error:", err);
    return res.status(200).json(emptyBalanceSheet());
  }
}

function mapLedgerToUKStructure(lines: any[]): BSStructure {
  const structure: BSStructure = {
    assets: {
      non_current: [],
      current: [],
    },
    liabilities: {
      non_current: [],
      current: [],
    },
    equity: [],
  };

  for (const row of lines) {
    const code = parseInt(row.account_code, 10);
    const balance = Number(row.balance);

    // Assets
    if (code >= 1000 && code <= 1999) {
      if (code === 1100) {
        structure.assets.current.push({
          label: "Cash",
          amount: balance,
          isCustom: false,
        });
      } else if (code === 1200) {
        structure.assets.current.push({
          label: "Accounts Receivable",
          amount: balance,
          isCustom: false,
        });
      } else {
        structure.assets.current.push({
          label: row.account_name,
          amount: balance,
          isCustom: false,
        });
      }
      continue;
    }

    // Liabilities
    if (code >= 2000 && code <= 2999) {
      if (code === 2100) {
        structure.liabilities.current.push({
          label: "Accounts Payable",
          amount: balance,
          isCustom: false,
        });
      } else {
        structure.liabilities.current.push({
          label: row.account_name,
          amount: balance,
          isCustom: false,
        });
      }
      continue;
    }

    // Equity
    if (code >= 3000 && code <= 3999) {
      structure.equity.push({
        label: row.account_name,
        amount: balance,
        isCustom: false,
      });
      continue;
    }
  }

  return structure;
}

function mergeCustomLines(structure: BSStructure, custom: any[]) {
  for (const line of custom) {
    const section = line.section as "assets" | "liabilities" | "equity";
    const subsection = line.subsection as "current" | "non_current";

    const item: BSLine = {
      id: line.id,
      label: line.label,
      amount: Number(line.amount),
      isCustom: true,
    };

    if (section === "equity") {
      structure.equity.push(item);
    } else {
      structure[section][subsection].push(item);
    }
  }
}

function computeTotals(structure: BSStructure) {
  const sum = (rows: BSLine[]) =>
    rows.reduce((a, r) => a + Number(r.amount || 0), 0);

  const totalAssets =
    sum(structure.assets.current) + sum(structure.assets.non_current);

  const totalLiabilities =
    sum(structure.liabilities.current) + sum(structure.liabilities.non_current);

  const totalEquity = sum(structure.equity);

  return {
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    total_equity: totalEquity,
    total_liabilities_and_equity: totalLiabilities + totalEquity,
  };
}

function emptyBalanceSheet() {
  return {
    assets: { current: [] as BSLine[], non_current: [] as BSLine[] },
    liabilities: { current: [] as BSLine[], non_current: [] as BSLine[] },
    equity: [] as BSLine[],
    totals: {
      total_assets: 0,
      total_liabilities: 0,
      total_equity: 0,
      total_liabilities_and_equity: 0,
    },
  };
}
