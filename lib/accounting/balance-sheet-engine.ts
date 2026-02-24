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

  // A: journal-driven lines
  const { data: linesA, error: errA } = await supabaseAdmin.rpc(
    "balance_sheet_lines_for_client",
    { p_client_id: clientId }
  );
  console.log("📘 [BS] RPC A (journal-driven) returned:", linesA);
  if (errA) console.log("❌ [BS] RPC A error:", errA);

  // B: full balance sheet engine
  const { data: linesB, error: errB } = await supabaseAdmin.rpc(
    "balance_sheet_for_client",
    { p_client_id: clientId }
  );
  console.log("📘 [BS] RPC B (full engine) returned:", linesB);
  if (errB) console.log("❌ [BS] RPC B error:", errB);

  const merged = mergeSources(linesA || [], linesB || []);
  console.log("📘 [BS] MERGED rows:", merged);

  const structure = mapToStructure(merged);
  console.log("📘 [BS] STRUCTURE after classification:", structure);

  const totals = computeTotals(structure);
  console.log("📘 [BS] TOTALS:", totals);

  return { ...structure, totals };
}

function mergeSources(a: any[], b: any[]): BSLine[] {
  console.log("📘 [BS] mergeSources() A count:", a.length, "B count:", b.length);

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

  const merged = Array.from(map.values());
  console.log("📘 [BS] mergeSources() final merged:", merged);
  return merged;
}

function mapToStructure(rows: BSLine[]) {
  console.log("📘 [BS] mapToStructure() input rows:", rows);

  const structure: Omit<BSStructure, "totals"> = {
    assets: { non_current: [], current: [] },
    liabilities: { non_current: [], current: [] },
    equity: [],
  };

  for (const row of rows) {
    const codeNum = parseInt(row.account_code, 10);
    const type = row.account_type ?? "";
    const bucket = row.hmrc_bucket ?? "";

    console.log(
      `🔍 [BS] Classifying ${row.account_code} ${row.account_name} | type=${type} bucket=${bucket}`
    );

    // ---- ASSETS ----
    const isAsset =
      type === "ASSET" ||
      bucket === "fixed_asset" ||
      bucket === "current_asset" ||
      bucket === "bank" ||
      bucket === "debtors" ||
      bucket === "vat_asset" ||
      (codeNum >= 1000 && codeNum <= 1999);

    if (isAsset) {
      if (bucket === "fixed_asset" || codeNum < 1100) {
        console.log("   → Classified as NON‑CURRENT ASSET");
        structure.assets.non_current.push(row);
      } else {
        console.log("   → Classified as CURRENT ASSET");
        structure.assets.current.push(row);
      }
      continue;
    }

    // ---- LIABILITIES ----
    const isLiability =
      type === "LIABILITY" || (codeNum >= 2000 && codeNum <= 2999);

    if (isLiability) {
      if (codeNum < 2500) {
        console.log("   → Classified as CURRENT LIABILITY");
        structure.liabilities.current.push(row);
      } else {
        console.log("   → Classified as NON‑CURRENT LIABILITY");
        structure.liabilities.non_current.push(row);
      }
      continue;
    }

    // ---- EQUITY ----
    const isEquity =
      type === "EQUITY" || (codeNum >= 3000 && codeNum <= 3999);

    if (isEquity) {
      console.log("   → Classified as EQUITY");
      structure.equity.push(row);
      continue;
    }

    console.log("   → IGNORED (likely P&L)");
  }

  console.log("📘 [BS] Final structure:", structure);
  return structure;
}

function computeTotals(structure: Omit<BSStructure, "totals">) {
  console.log("📘 [BS] computeTotals() input:", structure);

  const sum = (rows: BSLine[]) =>
    rows.reduce((a, r) => a + Number(r.balance || 0), 0);

  const totalAssets =
    sum(structure.assets.current) + sum(structure.assets.non_current);

  const totalLiabilities =
    sum(structure.liabilities.current) + sum(structure.liabilities.non_current);

  const totalEquity = sum(structure.equity);

  const totals = {
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    total_equity: totalEquity,
    total_liabilities_and_equity: totalLiabilities + totalEquity,
  };

  console.log("📘 [BS] computeTotals() output:", totals);
  return totals;
}
