import { supabaseAdmin } from "../supabase-admin";

console.log("🔥 USING UNIFIED JOURNAL-DRIVEN ACCOUNTING ENGINE");

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

// ------------------------------------------------------------
// CORE: pull all journal lines for a client, optionally by year
// ------------------------------------------------------------
async function getJournalLines(clientId: string, year?: number) {
  let query = supabaseAdmin
    .from("journal_lines")
    .select(`
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
    `)
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

// ------------------------------------------------------------
// CORE: group journal lines into account-level balances
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// BALANCE SHEET (journal-driven, year-aware)
// ------------------------------------------------------------
export async function getUnifiedBalanceSheet(
  clientId: string,
  year?: number
): Promise<BSStructure> {
  const lines = await getJournalLines(clientId, year);
  if (!lines.length) return emptyStructure();

  const accounts = groupByAccount(lines);
  const structure = mapToStructure(accounts);
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
    const type = row.account_type ?? "";
    const bucket = row.hmrc_bucket ?? "";

    const isSystem = type === "SYSTEM" || bucket === "ignore";
    const isControl = type === "CONTROL" || bucket === "control";
    if (isSystem || isControl) continue;

    if (type === "ASSET" || type === "BANK" || bucket === "fixed_asset" || bucket === "current_asset" || bucket === "balance_sheet" || bucket === "assets" || bucket === "bank") {
      if (bucket === "fixed_asset") {
        structure.assets.non_current.push(row);
      } else {
        structure.assets.current.push(row);
      }
      continue;
    }

    if (type === "LIABILITY" || type === "ACCOUNTS_PAYABLE" || bucket === "liabilities" || bucket === "vat" || type === "VAT_CONTROL") {
      structure.liabilities.current.push(row);
      continue;
    }

    if (type === "EQUITY") {
      structure.equity.push(row);
      continue;
    }

    if (type === "INCOME" || type === "EXPENSE") {
      totalDebits += row.debit ?? 0;
      totalCredits += row.credit ?? 0;
      continue;
    }
  }

  const profit = totalCredits - totalDebits;
  structure.equity.push({
    account_code: "PROFIT",
    account_name: "Current Year Profit",
    balance: profit,
  });

  return structure;
}

function computeTotals(structure: Omit<BSStructure, "totals">) {
  const sum = (rows: BSLine[]) => rows.reduce((a, r) => a + Number(r.balance || 0), 0);

  const totalAssets = sum(structure.assets.current) + sum(structure.assets.non_current);
  const totalLiabilities = sum(structure.liabilities.current) + sum(structure.liabilities.non_current);
  const totalEquity = sum(structure.equity);

  return {
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    total_equity: totalEquity,
    total_liabilities_and_equity: totalLiabilities + totalEquity,
  };
}

// ------------------------------------------------------------
// TRIAL BALANCE (journal-driven, year-aware)
// ------------------------------------------------------------
export async function getUnifiedTrialBalance(
  clientId: string,
  year?: number
): Promise<TrialBalanceResult> {
  const lines = await getJournalLines(clientId, year);
  const accounts = groupByAccount(lines);

  const summary = { assets: 0, liabilities: 0, equity: 0, income: 0, expenses: 0 };

  for (const acc of accounts) {
    if (acc.account_type === "ASSET" || acc.hmrc_bucket === "balance_sheet") summary.assets += acc.balance;
    if (acc.account_type === "LIABILITY") summary.liabilities += acc.balance;
    if (acc.account_type === "EQUITY") summary.equity += acc.balance;
    if (acc.account_type === "INCOME") summary.income += acc.credit ?? 0;
    if (acc.account_type === "EXPENSE") summary.expenses += acc.debit ?? 0;
  }

  return { lines: accounts, summary };
}
// ------------------------------------------------------------
// PROFIT & LOSS (journal-driven, year-aware)
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// DIRECTOR LOAN (journal-driven)
// ------------------------------------------------------------
export async function getUnifiedDirectorLoan(
  clientId: string,
  year?: number
): Promise<DirectorLoanResult> {
  const lines = await getJournalLines(clientId, year);
  const accounts = groupByAccount(lines);

  // Adjust this code to your actual Director Loan account code
  const dl = accounts.find((a) => a.account_code === "5041");

  return {
    lines: dl ? [dl] : [],
    balance: dl?.balance ?? 0,
  };
}

// ------------------------------------------------------------
// CASH FLOW (journal-driven, simple version)
// ------------------------------------------------------------
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