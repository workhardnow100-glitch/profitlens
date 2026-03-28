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

export async function getUnifiedBalanceSheet(
  clientId: string
): Promise<BSStructure> {
  console.log("📘 [BS] Fetching balance sheet for client:", clientId);

  // ✅ Use ONLY the journal-driven RPC (A)
  const { data: linesA, error: errA } = await supabaseAdmin.rpc(
    "balance_sheet_lines_for_client",
    { p_client_id: clientId }
  );

  console.log("📘 [BS] RPC A returned:", linesA);
  if (errA) console.log("❌ [BS] RPC A error:", errA);

  // If no data, return empty structure
  const rows = (linesA || []).map((row: any) => ({
    account_code: String(row.account_code),
    account_name: row.account_name,
    balance: Number(row.balance ?? 0),
    account_type: row.account_type ?? null,
    hmrc_bucket: row.hmrc_bucket ?? null,
  }));

  console.log("📘 [BS] Normalized rows:", rows);

  const structure = mapToStructure(rows);
  console.log("📘 [BS] STRUCTURE:", structure);

  const totals = computeTotals(structure);
  console.log("📘 [BS] TOTALS:", totals);

  return { ...structure, totals };
}

function mapToStructure(rows: BSLine[]) {
  const structure: Omit<BSStructure, "totals"> = {
    assets: { non_current: [], current: [] },
    liabilities: { non_current: [], current: [] },
    equity: [],
  };

  for (const row of rows) {
    const codeNum = parseInt(row.account_code, 10);
    const type = row.account_type ?? "";
    const bucket = row.hmrc_bucket ?? "";

    // ---- ASSETS ----
    const isAsset =
      type === "ASSET" ||
      bucket === "fixed_asset" ||
      bucket === "current_asset" ||
      bucket === "bank" ||
      bucket === "debtors" ||
      bucket === "vat_asset" ||
      bucket === "ASSETS" ||
      (codeNum >= 1000 && codeNum <= 1999);

    if (isAsset) {
      if (bucket === "fixed_asset" || codeNum < 1100) {
        structure.assets.non_current.push(row);
      } else {
        structure.assets.current.push(row);
      }
      continue;
    }

    // ---- LIABILITIES ----
    const isLiability =
      type === "LIABILITY" ||
      bucket === "LIABILITIES" ||
      (codeNum >= 2000 && codeNum <= 2999);

    if (isLiability) {
      if (codeNum < 2500) {
        structure.liabilities.current.push(row);
      } else {
        structure.liabilities.non_current.push(row);
      }
      continue;
    }

    // ---- EQUITY ----
    const isEquity =
      type === "EQUITY" ||
      bucket === "EQUITY" ||
      (codeNum >= 3000 && codeNum <= 3999);

    if (isEquity) {
      structure.equity.push(row);
      continue;
    }
  }

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
