// lib/accounting/balance-sheet-engine.ts
import { supabaseAdmin } from "../supabase-admin";

export type BSLine = {
  account_code: string;
  account_name: string;
  balance: number;
  account_type?: string | null;
  hmrc_bucket?: string | null;
};

export type BSStructure = {
  assets: {
    non_current: BSLine[];
    current: BSLine[];
  };
  liabilities: {
    non_current: BSLine[];
    current: BSLine[];
  };
  equity: BSLine[];
  totals: {
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
    total_liabilities_and_equity: number;
  };
};

export async function getUnifiedBalanceSheet(clientId: string): Promise<BSStructure> {
  // A: journal-driven lines (must keep)
  const { data: linesA } = await supabaseAdmin.rpc(
    "balance_sheet_lines_for_client",
    { p_client_id: clientId }
  );

  // B: full balance sheet engine (director loan, bank, VAT, etc.)
  const { data: linesB } = await supabaseAdmin.rpc(
    "balance_sheet_for_client",
    { p_client_id: clientId }
  );

  const merged = mergeSources(linesA || [], linesB || []);
  const structure = mapToStructure(merged);
  const totals = computeTotals(structure);

  return { ...structure, totals };
}

function mergeSources(a: any[], b: any[]): BSLine[] {
  const map = new Map<string, BSLine>();

  const addRow = (row: any) => {
    const code = String(row.account_code);
    const existing = map.get(code);
    const balance = Number(row.balance || 0);

    if (!existing) {
      map.set(code, {
        account_code: code,
        account_name: row.account_name,
        balance,
        account_type: row.account_type ?? null,
        hmrc_bucket: row.hmrc_bucket ?? null,
      });
    } else {
      existing.balance += balance;
    }
  };

  a.forEach(addRow);
  b.forEach(addRow);

  return Array.from(map.values());
}

function mapToStructure(rows: BSLine[]) {
  const structure: Omit<BSStructure, "totals"> = {
    assets: { non_current: [], current: [] },
    liabilities: { non_current: [], current: [] },
    equity: [],
  };

  for (const row of rows) {
    const codeNum = parseInt(row.account_code, 10);
    const bal = Number(row.balance || 0);
    const type = row.account_type ?? "";
    const bucket = row.hmrc_bucket ?? "";

    // ASSETS (current + non-current)
    if (type === "ASSET" || (codeNum >= 1000 && codeNum <= 1999) || bucket === "fixed_asset") {
      // Non-current: fixed assets
      if (bucket === "fixed_asset" || codeNum < 1100) {
        structure.assets.non_current.push(row);
      } else {
        // Current assets: bank, DL, cash withdrawals, etc.
        structure.assets.current.push(row);
      }
      continue;
    }

    // LIABILITIES
    if (type === "LIABILITY" || (codeNum >= 2000 && codeNum <= 2999)) {
      // Simple split: 2000–2499 current, 2500–2999 non-current (tweak if needed)
      if (codeNum < 2500) {
        structure.liabilities.current.push(row);
      } else {
        structure.liabilities.non_current.push(row);
      }
      continue;
    }

    // EQUITY
    if (type === "EQUITY" || (codeNum >= 3000 && codeNum <= 3999)) {
      structure.equity.push(row);
      continue;
    }
  }

  return structure;
}

function computeTotals(structure: Omit<BSStructure, "totals">) {
  const sum = (rows: BSLine[]) => rows.reduce((a, r) => a + Number(r.balance || 0), 0);

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
