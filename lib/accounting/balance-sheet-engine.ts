// lib/accounting/balance-sheet-engine.ts
import { supabaseAdmin } from "../supabase-admin";
import { buildAccountsFormData } from "./builder-engine";

console.log("🔥 USING BUILDER-ALIGNED ACCOUNTING ENGINE");

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

export type TrialBalanceResult = {
  lines: BSLine[];
  summary: {
    assets: number;
    liabilities: number;
    equity: number;
    income: number;
    expenses: number;
  };
};

export type ProfitAndLossResult = {
  summary: {
    revenue: number;
    cost_of_sales: number;
    gross_profit: number;
    operating_expenses: number;
    net_profit: number;
  };
  lines: BSLine[];
};

export type DirectorLoanResult = {
  lines: BSLine[];
  balance: number;
};

export type CashFlowResult = {
  lines: any[];
  summary: {
    operating: number;
    investing: number;
    financing: number;
  };
};

const safeNum = (v: any) => Number(v || 0);

// ------------------------------------------------------------
// BALANCE SHEET — now driven by the builder (FRS105/102 engine)
// ------------------------------------------------------------
export async function getUnifiedBalanceSheet(
  clientId: string,
  year?: number
): Promise<BSStructure> {
  const y = year ?? new Date().getFullYear();
  const periodStart = `${y}-01-01`;
  const periodEnd = `${y}-12-31`;

  // Use the builder
  const { overview } = await buildAccountsFormData(
    null,
    clientId,
    periodStart,
    periodEnd,
    []
  );

  if (!overview || !overview.totals) {
    return emptyStructure();
  }

  const t = overview.totals;

  // Builder totals (statutory)
  const nonCurrentAssets = safeNum(t.non_current_assets);
  const currentAssets = safeNum(t.current_assets);
  const currentLiabilities = safeNum(t.current_liabilities);
  const nonCurrentLiabilities = safeNum(t.non_current_liabilities);
  const totalLiabilities = safeNum(t.total_liabilities);
  const totalEquity = safeNum(t.total_equity);

  const totalAssets = nonCurrentAssets + currentAssets;

  return {
    assets: {
      non_current: [
        {
          account_code: "FA",
          account_name: "Fixed assets",
          balance: nonCurrentAssets,
        },
      ],
      current: [
        {
          account_code: "CA",
          account_name: "Current assets",
          balance: currentAssets,
        },
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

// ------------------------------------------------------------
// BELOW: keep journal-driven logic for TB / P&L / DLA / CF
// ------------------------------------------------------------

// CORE: pull all journal lines for a client, optionally by year
async function getJournalLines(clientId: string, year?: number) {
  let query = supabaseAdmin
    .from("journal_lines")
    .select(
      `
      debit,
      credit,
      account_id,
      journal_entries!inner (
        client_id,
        date
      ),
      chart_of_account_entries:account_id (
        account_code,
        account_name,
        account_type,
        hmrc_bucket
      )
    `
    )
    .eq("journal_entries.client_id", clientId);

  if (year) {
    query = query
      .gte("journal_entries.date", `${year}-01-01`)
      .lte("journal_entries.date", `${year}-12-31`);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("❌ Journal pull error:", error);
    return [];
  }

  return data.map((row: any) => ({
    debit: Number(row.debit ?? 0),
    credit: Number(row.credit ?? 0),
    account_code: String(row.chart_of_account_entries?.account_code ?? ""),
    account_name: row.chart_of_account_entries?.account_name ?? "",
    account_type: row.chart_of_account_entries?.account_type ?? null,
    hmrc_bucket: row.chart_of_account_entries?.hmrc_bucket ?? null,
  }));
}

// CORE: group journal lines into account-level balances
function groupByAccount(lines: any[]): BSLine[] {
  const grouped: Record<string, BSLine> = {};

  for (const row of lines) {
    const code = String(row.account_code || "");
    if (!code) continue;

    if (!grouped[code]) {
      grouped[code] = {
        account_code: code,
        account_name: row.account_name,
        account_type: row.account_type,
        hmrc_bucket: row.hmrc_bucket,
        debit: 0,
        credit: 0,
        balance: 0,
      };
    }

    grouped[code].debit! += Number(row.debit ?? 0);
    grouped[code].credit! += Number(row.credit ?? 0);
  }

  return Object.values(grouped).map((acc) => ({
    ...acc,
    balance: Number(acc.debit) - Number(acc.credit),
  }));
}

// TRIAL BALANCE (journal-driven, year-aware)
export async function getUnifiedTrialBalance(
  clientId: string,
  year?: number
): Promise<TrialBalanceResult> {
  const lines = await getJournalLines(clientId, year);
  const accounts = groupByAccount(lines);

  const summary = { assets: 0, liabilities: 0, equity: 0, income: 0, expenses: 0 };

  for (const acc of accounts) {
    if (acc.account_type === "ASSET" || acc.hmrc_bucket === "balance_sheet")
      summary.assets += acc.balance;
    if (acc.account_type === "LIABILITY") summary.liabilities += acc.balance;
    if (acc.account_type === "EQUITY") summary.equity += acc.balance;
    if (acc.account_type === "INCOME") summary.income += acc.credit ?? 0;
    if (acc.account_type === "EXPENSE") summary.expenses += acc.debit ?? 0;
  }

  return { lines: accounts, summary };
}

// PROFIT & LOSS (journal-driven, year-aware)
export async function getUnifiedProfitAndLoss(
  clientId: string,
  year?: number
): Promise<ProfitAndLossResult> {
  const lines = await getJournalLines(clientId, year);
  const accounts = groupByAccount(lines);

  const revenue = accounts
    .filter((a) => a.account_type === "INCOME")
    .reduce((sum, a) => sum + (a.credit ?? 0), 0);

  const expenses = accounts
    .filter((a) => a.account_type === "EXPENSE")
    .reduce((sum, a) => sum + (a.debit ?? 0), 0);

  return {
    summary: {
      revenue,
      cost_of_sales: 0,
      gross_profit: revenue,
      operating_expenses: expenses,
      net_profit: revenue - expenses,
    },
    lines: accounts.filter(
      (a) => a.account_type === "INCOME" || a.account_type === "EXPENSE"
    ),
  };
}

// DIRECTOR LOAN (journal-driven)
export async function getUnifiedDirectorLoan(
  clientId: string,
  year?: number
): Promise<DirectorLoanResult> {
  const lines = await getJournalLines(clientId, year);
  const accounts = groupByAccount(lines);

  const dl = accounts.find((a) => a.account_code === "5041");

  return {
    lines: dl ? [dl] : [],
    balance: dl?.balance ?? 0,
  };
}

// CASH FLOW (journal-driven, simple version)
export async function getUnifiedCashFlow(
  clientId: string,
  year?: number
): Promise<CashFlowResult> {
  const lines = await getJournalLines(clientId, year);

  const operating = lines
    .filter((l) => l.account_type === "EXPENSE" || l.account_type === "INCOME")
    .reduce(
      (sum, l) => sum + Number(l.debit ?? 0) - Number(l.credit ?? 0),
      0
    );

  return {
    lines,
    summary: {
      operating,
      investing: 0,
      financing: 0,
    },
  };
}
