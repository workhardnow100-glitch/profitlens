// lib/accounting/balance-sheet-engine.ts
import { supabaseAdmin } from "../supabase-admin";

console.log("🔥 USING UPDATED BALANCE SHEET ENGINE");

export type BSLine = {
  account_code: string;
  account_name: string;
  balance: number;
  account_type?: string | null;
  hmrc_bucket?: string | null;
  debit?: number;
  credit?: number;
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

export async function getUnifiedBalanceSheet(
  clientId: string
): Promise<BSStructure> {
  const { data: rows, error } = await supabaseAdmin.rpc(
    "balance_sheet_lines_for_client",
    { p_client_id: clientId }
  );

  if (error) {
    console.error("❌ [BS] RPC error:", error);
    return emptyStructure();
  }

  const normalized = (rows || []).map((row: any) => ({
    account_code: String(row.account_code),
    account_name: row.account_name,
    balance: Number(row.balance ?? 0),
    account_type: row.account_type ?? null,
    hmrc_bucket: row.hmrc_bucket ?? null,
    debit: Number(row.debit ?? 0),
    credit: Number(row.credit ?? 0),
  }));

  const structure = mapToStructure(normalized);
  const totals = computeTotals(structure);

  return { ...structure, totals };
}

function emptyStructure(): BSStructure {
  return {
    assets: { non_current: [], current: [] },
    liabilities: { non_current: [], current: [] },
    equity: [],
    totals: {
      total_assets: 0,
      total_liabilities: 0,
      total_equity: 0,
      total_liabilities_and_equity: 0,
    },
  };
}

function mapToStructure(rows: BSLine[]) {
  const structure: Omit<BSStructure, "totals"> = {
    assets: { non_current: [], current: [] },
    liabilities: { non_current: [], current: [] },
    equity: [],
  };

  let totalDebits = 0;
  let totalCredits = 0;

  for (const row of rows) {
    const code = parseInt(row.account_code, 10);
    const type = row.account_type ?? "";
    const bucket = row.hmrc_bucket ?? "";

    const isSystem = type === "SYSTEM" || bucket === "ignore";
    const isControl = type === "CONTROL" || bucket === "control";
    if (isSystem || isControl) {
      continue;
    }

    // ---- ASSETS ----
    const isAssetBucket =
      bucket === "fixed_asset" ||
      bucket === "current_asset" ||
      bucket === "balance_sheet" ||
      bucket === "assets" ||
      bucket === "bank";

    if (type === "ASSET" || type === "BANK" || isAssetBucket) {
      if (bucket === "fixed_asset") {
        structure.assets.non_current.push(row);
      } else {
        structure.assets.current.push(row);
      }
      continue;
    }

    // ---- LIABILITIES ----
    const isLiabilityBucket =
      bucket === "liabilities" || bucket === "vat" || type === "VAT_CONTROL";

    if (type === "LIABILITY" || type === "ACCOUNTS_PAYABLE" || isLiabilityBucket) {
      // you can later split current/non-current by code if needed
      structure.liabilities.current.push(row);
      continue;
    }

    // ---- EQUITY ----
    if (type === "EQUITY") {
      structure.equity.push(row);
      continue;
    }

    // ---- P&L: ALL INCOME + EXPENSE (TRADING + NON-TRADING), EXCLUDING SYSTEM/IGNORE ----
    if (type === "INCOME" || type === "EXPENSE") {
      totalDebits += row.debit ?? 0;
      totalCredits += row.credit ?? 0;
      continue;
    }
  }

  // ---- CURRENT YEAR PROFIT (FULL P&L) ----
  const profit = totalCredits - totalDebits;

  structure.equity.push({
    account_code: "PROFIT",
    account_name: "Current Year Profit",
    balance: profit,
  });

  return structure;
}

function computeTotals(structure: Omit<BSStructure, "totals">) {
  const sum = (rows: BSLine[]) =>
    rows.reduce((a, r) => a + Number(r.balance || 0), 0);

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
