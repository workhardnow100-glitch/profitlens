// lib/ixbrl/accountsBuilder.ts

import { supabaseAdmin } from "../supabase-admin";
import {
  IxbrlContext,
  IxbrlUnit,
  IxbrlFact,
  IxbrlTextBlock,
} from "./types";
import { resolveTaxonomiesForPeriod } from "./taxonomyRegistry";
import { getConceptByInternalKey } from "./conceptMap";
import { buildIxbrlInstance } from "./instanceBuilder";

type Framework = "FRS102-1A" | "FRS105" | "IFRS";

function determineFramework(params: {
  turnover: number;
  balanceSheetTotal: number;
  employees?: number | null;
}): Framework {
  const { turnover, balanceSheetTotal, employees } = params;
  const emp = employees ?? 0;

  const microHits = [
    turnover <= 632000,
    balanceSheetTotal <= 316000,
    emp <= 10,
  ].filter(Boolean).length;

  if (microHits >= 2) return "FRS105";

  const smallHits = [
    turnover <= 10200000,
    balanceSheetTotal <= 5100000,
    emp <= 50,
  ].filter(Boolean).length;

  if (smallHits >= 2) return "FRS102-1A";

  return "IFRS";
}

export async function buildAccountsIxbrl(params: {
  clientId: string;
  companyNumber: string;
  companyName: string;
  periodStart: string;
  periodEnd: string;
  defaultFramework?: Framework;
}): Promise<{
  ixbrl: string;
  framework: Framework;
}> {
  const {
    clientId,
    companyNumber,
    companyName,
    periodStart,
    periodEnd,
    defaultFramework = "FRS102-1A",
  } = params;

  // ────────────────────────────────────────────────
  // 1. LOAD COA FROM SUPABASE
  // ────────────────────────────────────────────────
  const { data: coa, error: coaError } = await supabaseAdmin
    .from("chart_of_account_entries")
    .select("*")
    .eq("coa_id", clientId);

  if (coaError) {
    throw new Error("Failed to load COA: " + coaError.message);
  }

  // ────────────────────────────────────────────────
// 2. LOAD JOURNALS FROM SUPABASE (FIXED)
// ────────────────────────────────────────────────
const { data: journals, error: journalsError } = await supabaseAdmin
  .from("journal_entries")
  .select(`
    id,
    date,
    client_id,
    lines:journal_lines (
      debit,
      credit,
      account:chart_of_account_entries (
        account_code,
        account_name
      )
    )
  `)
  .eq("client_id", clientId)
  .gte("date", periodStart)
  .lte("date", periodEnd);

if (journalsError) {
  throw new Error("Failed to load journals: " + journalsError.message);
}


 // ────────────────────────────────────────────────
// 3. BUILD TRIAL BALANCE (FINAL FIXED VERSION)
// ────────────────────────────────────────────────
const balances: Record<string, number> = {};

for (const j of journals || []) {
  for (const line of j.lines || []) {
    const account = Array.isArray(line.account)
      ? line.account[0]
      : line.account;

    const code = account?.account_code;
    if (!code) continue;

    const amt =
      Number(line.debit ?? 0) -
      Number(line.credit ?? 0);

    balances[code] = (balances[code] || 0) + amt;
  }
}


  // ────────────────────────────────────────────────
  // 4. AGGREGATE INTO HIGH-LEVEL BUCKETS
  // ────────────────────────────────────────────────
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let turnover = 0;
  let costOfSales = 0;

  for (const account of coa || []) {
    const code = account.account_code;
    const bal = balances[code] || 0;
    const type = account.account_type;
    const bucket = account.hmrc_bucket;

    // Balance sheet
    if (
      type === "ASSET" ||
      type === "BANK" ||
      type === "ACCOUNTS_RECEIVABLE"
    ) {
      totalAssets += bal;
    }

    if (
      type === "LIABILITY" ||
      type === "ACCOUNTS_PAYABLE" ||
      bucket === "liabilities" ||
      bucket === "vat"
    ) {
      totalLiabilities += bal;
    }

    if (type === "EQUITY" || bucket === "equity") {
      totalEquity += bal;
    }

    // Turnover (Sales only)
    if (
      type === "INCOME" &&
      bucket === "income" &&
      Number(code) >= 4000 &&
      Number(code) <= 4099
    ) {
      turnover += bal;
    }

    // Cost of sales
    if (
      type === "EXPENSE" &&
      bucket === "allowable" &&
      Number(code) >= 5000 &&
      Number(code) <= 5099
    ) {
      costOfSales += Math.abs(bal);
    }
  }

  const grossProfit = turnover - costOfSales;

  const totalExpenses = Object.entries(balances)
    .filter(([code]) => {
      const acc = coa.find((a) => a.account_code === code);
      return acc?.account_type === "EXPENSE";
    })
    .reduce((sum, [, bal]) => sum + Math.abs(bal), 0);

  const profitForYear = turnover - totalExpenses;

  const balanceSheetTotal = totalAssets;

  // ────────────────────────────────────────────────
  // 5. DETERMINE FRAMEWORK
  // ────────────────────────────────────────────────
  const framework = determineFramework({
    turnover,
    balanceSheetTotal,
    employees: null,
  });

  const gaapFramework: Framework =
    framework || defaultFramework || "FRS102-1A";

  // ────────────────────────────────────────────────
  // 6. RESOLVE TAXONOMY
  // ────────────────────────────────────────────────
  const { accountsTaxonomy } = resolveTaxonomiesForPeriod({
    periodStart,
    periodEnd,
    gaapFramework,
  });

  // ────────────────────────────────────────────────
  // 7. CONTEXTS & UNITS
  // ────────────────────────────────────────────────
  const mainContext: IxbrlContext = {
    id: "C_ACCOUNTS",
    entityId: companyNumber || clientId,
    periodStart,
    periodEnd,
    instant: false,
  };

  const contexts: IxbrlContext[] = [mainContext];

  const gbpUnit: IxbrlUnit = {
    id: "U_GBP",
    measure: "iso4217:GBP",
  };

  const units: IxbrlUnit[] = [gbpUnit];

  // ────────────────────────────────────────────────
  // 8. FACTS
  // ────────────────────────────────────────────────
  const facts: IxbrlFact[] = [
    {
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.bs.total_assets"
      ),
      contextId: mainContext.id,
      unitId: gbpUnit.id,
      value: totalAssets,
    },
    {
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.bs.total_liabilities"
      ),
      contextId: mainContext.id,
      unitId: gbpUnit.id,
      value: totalLiabilities,
    },
    {
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.bs.equity"
      ),
      contextId: mainContext.id,
      unitId: gbpUnit.id,
      value: totalEquity,
    },
    {
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.pl.turnover"
      ),
      contextId: mainContext.id,
      unitId: gbpUnit.id,
      value: turnover,
    },
    {
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.pl.cost_of_sales"
      ),
      contextId: mainContext.id,
      unitId: gbpUnit.id,
      value: costOfSales,
    },
    {
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.pl.gross_profit"
      ),
      contextId: mainContext.id,
      unitId: gbpUnit.id,
      value: grossProfit,
    },
    {
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.pl.profit_for_year"
      ),
      contextId: mainContext.id,
      unitId: gbpUnit.id,
      value: profitForYear,
    },
  ];

  // ────────────────────────────────────────────────
  // 9. DIRECTORS' REPORT
  // ────────────────────────────────────────────────
  const textBlocks: IxbrlTextBlock[] = [
    {
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.directors_report"
      ),
      contextId: mainContext.id,
      html: `
        <p>Statutory accounts for the year ended ${periodEnd}.</p>
        <p>Generated automatically by ProfitLens.</p>
      `,
    },
  ];

  // ────────────────────────────────────────────────
  // 10. BUILD XHTML INSTANCE
  // ────────────────────────────────────────────────
  const ixbrl = buildIxbrlInstance({
    taxonomy: accountsTaxonomy,
    entity: {
      companyNumber,
      name: companyName,
    },
    period: {
      start: periodStart,
      end: periodEnd,
    },
    contexts,
    units,
    facts,
    textBlocks,
  });

  return { ixbrl, framework: gaapFramework };
}
