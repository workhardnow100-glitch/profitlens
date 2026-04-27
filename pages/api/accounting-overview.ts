// pages/api/accounting-overview.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../lib/supabase-admin";
import {
  getUnifiedTrialBalance,
  getUnifiedProfitAndLoss,
  getUnifiedDirectorLoan,
  getUnifiedCashFlow,
  type PeriodFilter,
} from "../../lib/accounting/balance-sheet-engine";

/* -----------------------------
   SHARED TYPES (aligned with UI)
------------------------------ */

type FinancialHealthFlat = {
  revenue_mtd: number;
  revenue_ytd: number;
  expenses_mtd: number;
  expenses_ytd: number;
  net_profit_mtd: number;
  net_profit_ytd: number;
};

type TrialBalanceRow = {
  account_code: string;
  account_name: string;
  // allow undefined to match BSLine from engine
  account_type: string | null | undefined;
  hmrc_bucket: string | null;
  debit: number;
  credit: number;
  balance: number;
};

type BalanceSheetRow = {
  account_code: string;
  account_name: string;
  // allow undefined to match BSLine from engine
  account_type: string | null | undefined;
  hmrc_bucket: string | null;
  debit: number;
  credit: number;
  balance: number;
};

type ProfitAndLossSummary = {
  revenue: number;
  cost_of_sales: number;
  gross_profit: number;
  operating_expenses: number;
  net_profit: number;
};

type ProfitAndLossRow = {
  account_code: string;
  account_name: string;
  balance: number;
};

type DirectorLoanRow = {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  balance: number;
};

type BankAccountRow = {
  account_code: string;
  account_name: string;
  opening_balance?: number;
  money_in: number;
  money_out: number;
  closing_balance: number;
};

type SimpleControlRow = {
  account_code: string;
  account_name: string;
  balance: number;
};

type CashFlowRow = {
  debit: number;
  credit: number;
  account_code: string;
  account_name: string;
  account_type: string;
  hmrc_bucket: string | null;
};

type BalanceSheetSummary = {
  total_assets: number;
  total_liabilities: number;
  net_assets: number;
  equity: number;
};

type TrialBalanceSummary = {
  assets: number;
  liabilities: number;
  equity: number;
  income: number;
  expenses: number;
};

type CoaSummary = {
  total_accounts: number;
  active_accounts: number;
  system_accounts: number;
  uncategorised_accounts: number;
  suspense_accounts: number;
};

type Alert = {
  type: string;
  count: number;
  severity: "low" | "medium" | "high";
  link?: string;
};

type QuickAction = {
  label: string;
  link: string;
};

type FullBusinessData = {
  financial_health: {
    total_assets: number;
    total_liabilities: number;
    net_assets: number;
    equity: number;
  };
  balance_sheet: {
    summary: BalanceSheetSummary;
    lines: BalanceSheetRow[];
  };
  trial_balance: {
    summary: TrialBalanceSummary;
    lines: TrialBalanceRow[];
  };
  profit_and_loss: {
    summary: ProfitAndLossSummary;
    lines: ProfitAndLossRow[];
  };
  fixed_assets: {
    lines: SimpleControlRow[];
    nbv: number;
  };
  liabilities: {
    lines: BalanceSheetRow[];
    total: number;
  };
  cash_flow: CashFlowRow[];
  director_loan: DirectorLoanRow[];
};

type YTDData = {
  financial_health: FinancialHealthFlat;
  balance_sheet: {
    summary: BalanceSheetSummary;
    lines: BalanceSheetRow[];
  };
  trial_balance: {
    summary: TrialBalanceSummary;
    lines: TrialBalanceRow[];
  };
  profit_and_loss: {
    summary: ProfitAndLossSummary;
    lines: ProfitAndLossRow[];
  };
  cash_flow: CashFlowRow[];
  director_loan: DirectorLoanRow[];
};

type AccountingOverviewData = {
  full_business: FullBusinessData;
  ytd: YTDData;

  coa_summary: CoaSummary;
  alerts: Alert[];
  quick_actions: QuickAction[];

  // legacy flat fields (HYBRID MODE)
  financial_health?: FinancialHealthFlat;
  trial_balance_summary?: TrialBalanceSummary;
  balance_sheet_summary?: BalanceSheetSummary;
  trial_balance_full?: TrialBalanceRow[];
  balance_sheet_full?: BalanceSheetRow[];
  profit_and_loss_summary?: ProfitAndLossSummary;
  profit_and_loss_full?: ProfitAndLossRow[];
  director_loan_ledger?: DirectorLoanRow[];
  bank_accounts?: BankAccountRow[];
  vat_control?: SimpleControlRow[];
  paye_control?: SimpleControlRow[];
  corporation_tax?: SimpleControlRow[];
  fixed_assets?: SimpleControlRow[];
  suspense_and_uncategorised?: SimpleControlRow[];
  cash_flow?: CashFlowRow[];
};

/* -----------------------------
   SAFE HELPERS
------------------------------ */

const safeNum = (v: any) => Number(v || 0);

function deriveBankFromBalanceSheet(lines: BalanceSheetRow[]): BankAccountRow[] {
  return lines
    .filter((line) => (line.account_type || "").toUpperCase() === "BANK")
    .map((line) => ({
      account_code: line.account_code,
      account_name: line.account_name,
      closing_balance: safeNum(line.balance),
      money_in: safeNum(line.debit),
      money_out: safeNum(line.credit),
    }));
}

function toBalanceSheetSummaryFromTB(tb: TrialBalanceSummary): BalanceSheetSummary {
  const total_assets = safeNum(tb.assets);
  const total_liabilities = safeNum(tb.liabilities);
  const equity = safeNum(tb.equity);
  return {
    total_assets,
    total_liabilities,
    net_assets: total_assets - total_liabilities,
    equity,
  };
}

function mapTBToBalanceSheetRows(lines: TrialBalanceRow[]): BalanceSheetRow[] {
  return lines.filter(
    (l) =>
      ["ASSET", "LIABILITY", "EQUITY"].includes(
        (l.account_type || "").toUpperCase()
      ) || (l.hmrc_bucket || "") === "balance_sheet"
  );
}

function mapPnLToRows(lines: TrialBalanceRow[]): ProfitAndLossRow[] {
  return lines
    .filter((l) =>
      ["INCOME", "EXPENSE"].includes((l.account_type || "").toUpperCase())
    )
    .map((l) => ({
      account_code: l.account_code,
      account_name: l.account_name,
      balance: safeNum(l.balance),
    }));
}

function mapDirectorLoanLines(lines: TrialBalanceRow[]): DirectorLoanRow[] {
  return lines.map((l) => ({
    account_code: l.account_code,
    account_name: l.account_name,
    debit: safeNum(l.debit),
    credit: safeNum(l.credit),
    balance: safeNum(l.balance),
  }));
}

function mapCashFlowLines(lines: any[]): CashFlowRow[] {
  return lines.map((l) => ({
    debit: safeNum(l.debit),
    credit: safeNum(l.credit),
    account_code: String(l.account_code || ""),
    account_name: String(l.account_name || ""),
    account_type: String(l.account_type || ""),
    hmrc_bucket: l.hmrc_bucket ?? null,
  }));
}

function deriveFixedAssetsFromTB(lines: TrialBalanceRow[]): SimpleControlRow[] {
  return lines
    .filter((l) => (l.hmrc_bucket || "") === "fixed_assets")
    .map((l) => ({
      account_code: l.account_code,
      account_name: l.account_name,
      balance: safeNum(l.balance),
    }));
}

function deriveLiabilitiesFromBS(
  lines: BalanceSheetRow[]
): { lines: BalanceSheetRow[]; total: number } {
  const liabLines = lines.filter(
    (l) => (l.account_type || "").toUpperCase() === "LIABILITY"
  );
  const total = liabLines.reduce((sum, l) => sum + safeNum(l.balance), 0);
  return { lines: liabLines, total };
}

function deriveSuspenseAndUncategorised(
  lines: TrialBalanceRow[]
): SimpleControlRow[] {
  return lines
    .filter((l) => {
      const bucket = (l.hmrc_bucket || "").toLowerCase();
      return bucket === "suspense" || bucket === "uncategorised" || bucket === "";
    })
    .map((l) => ({
      account_code: l.account_code,
      account_name: l.account_name,
      balance: safeNum(l.balance),
    }));
}

function deriveCoaSummaryFromTB(lines: TrialBalanceRow[]): CoaSummary {
  const total_accounts = lines.length;
  const system_accounts = lines.filter((l) =>
    (l.account_code || "").startsWith("9")
  ).length;
  const suspense_accounts = lines.filter((l) => {
    const bucket = (l.hmrc_bucket || "").toLowerCase();
    return bucket === "suspense";
  }).length;
  const uncategorised_accounts = lines.filter((l) => {
    const bucket = (l.hmrc_bucket || "").toLowerCase();
    return !bucket || bucket === "uncategorised";
  }).length;

  const active_accounts = total_accounts;

  return {
    total_accounts,
    active_accounts,
    system_accounts,
    uncategorised_accounts,
    suspense_accounts,
  };
}

function deriveAlertsFromTB(lines: TrialBalanceRow[]): Alert[] {
  const uncategorisedCount = lines.filter((l) => {
    const bucket = (l.hmrc_bucket || "").toLowerCase();
    return !bucket || bucket === "uncategorised";
  }).length;

  const negativeBalanceCount = lines.filter(
    (l) =>
      safeNum(l.balance) < 0 &&
      ["ASSET", "EQUITY"].includes((l.account_type || "").toUpperCase())
  ).length;

  const taxLiabilitiesCount = lines.filter((l) =>
    (l.account_name || "").toLowerCase().includes("tax")
  ).length;

  const alerts: Alert[] = [];

  if (uncategorisedCount > 0) {
    alerts.push({
      type: "uncategorised_transactions",
      count: uncategorisedCount,
      severity: uncategorisedCount > 10 ? "medium" : "low",
      link: "/reports/suspense",
    });
  }

  if (negativeBalanceCount > 0) {
    alerts.push({
      type: "negative_balance",
      count: negativeBalanceCount,
      severity: "medium",
      link: "/reports/trial-balance",
    });
  }

  if (taxLiabilitiesCount > 0) {
    alerts.push({
      type: "tax_liabilities",
      count: taxLiabilitiesCount,
      severity: "high",
      link: "/reports/corporation-tax",
    });
  }

  return alerts;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Post a new journal", link: "/journals/new" },
  { label: "Review bank feed", link: "/bank" },
  { label: "Check VAT control", link: "/reports/vat" },
  { label: "Review suspense items", link: "/reports/suspense" },
  { label: "View full P&L", link: "/reports/pnl" },
];

/* -----------------------------
   PERIOD HELPERS
------------------------------ */

function buildPeriod(from: Date, to: Date): PeriodFilter {
  return { from, to };
}

function getYTDPeriod(): PeriodFilter {
  const now = new Date();
  return buildPeriod(new Date(now.getFullYear(), 0, 1), now);
}

function getMTDPeriod(): PeriodFilter {
  const now = new Date();
  return buildPeriod(new Date(now.getFullYear(), now.getMonth(), 1), now);
}

/* -----------------------------
   HANDLER
------------------------------ */

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AccountingOverviewData | { error: string }>
) {
  try {
    const clientId =
      (req.query.clientId as string) ||
      (req.headers["x-client-id"] as string);

    if (!clientId) {
      return res.status(400).json({ error: "Missing clientId" });
    }

    const ytdPeriod = getYTDPeriod();
    const mtdPeriod = getMTDPeriod();

    // FULL (all years)
    const [fullTb, fullPnL, fullDl, fullCf] = await Promise.all([
      getUnifiedTrialBalance(clientId),
      getUnifiedProfitAndLoss(clientId),
      getUnifiedDirectorLoan(clientId),
      getUnifiedCashFlow(clientId),
    ]);

    // YTD
    const [ytdTb, ytdPnL, ytdDl, ytdCf] = await Promise.all([
      getUnifiedTrialBalance(clientId, ytdPeriod),
      getUnifiedProfitAndLoss(clientId, ytdPeriod),
      getUnifiedDirectorLoan(clientId, ytdPeriod),
      getUnifiedCashFlow(clientId, ytdPeriod),
    ]);

    // MTD
    const mtdPnL = await getUnifiedProfitAndLoss(clientId, mtdPeriod);

    /* -----------------------------
       FULL BUSINESS (nested)
    ------------------------------ */

    const fullBsSummary = toBalanceSheetSummaryFromTB(fullTb.summary);
    const fullBsLines = mapTBToBalanceSheetRows(
      fullTb.lines as TrialBalanceRow[]
    );
    const fullPnLRows = mapPnLToRows(fullTb.lines as TrialBalanceRow[]);
    const fullDirectorLoanRows = mapDirectorLoanLines(
      fullDl.lines as TrialBalanceRow[]
    );
    const fullCashFlowRows = mapCashFlowLines(fullCf.lines);

    const fixedAssetRows = deriveFixedAssetsFromTB(
      fullTb.lines as TrialBalanceRow[]
    );
    const fixedAssetsNbv = fixedAssetRows.reduce(
      (sum, r) => sum + safeNum(r.balance),
      0
    );

    const liabilitiesBlock = deriveLiabilitiesFromBS(fullBsLines);

    const fullFinancialHealth = {
      total_assets: fullBsSummary.total_assets,
      total_liabilities: fullBsSummary.total_liabilities,
      net_assets: fullBsSummary.net_assets,
      equity: fullBsSummary.equity,
    };

    const full_business: FullBusinessData = {
      financial_health: fullFinancialHealth,
      balance_sheet: {
        summary: fullBsSummary,
        lines: fullBsLines,
      },
      trial_balance: {
        summary: fullTb.summary,
        lines: fullTb.lines as TrialBalanceRow[],
      },
      profit_and_loss: {
        summary: fullPnL.summary,
        lines: fullPnLRows,
      },
      fixed_assets: {
        lines: fixedAssetRows,
        nbv: fixedAssetsNbv,
      },
      liabilities: {
        lines: liabilitiesBlock.lines,
        total: liabilitiesBlock.total,
      },
      cash_flow: fullCashFlowRows,
      director_loan: fullDirectorLoanRows,
    };

    /* -----------------------------
       YTD (nested)
    ------------------------------ */

    const ytdBsSummary = toBalanceSheetSummaryFromTB(ytdTb.summary);
    const ytdBsLines = mapTBToBalanceSheetRows(
      ytdTb.lines as TrialBalanceRow[]
    );
    const ytdPnLRows = mapPnLToRows(ytdTb.lines as TrialBalanceRow[]);
    const ytdDirectorLoanRows = mapDirectorLoanLines(
      ytdDl.lines as TrialBalanceRow[]
    );
    const ytdCashFlowRows = mapCashFlowLines(ytdCf.lines);

    const ytdFinancialHealth: FinancialHealthFlat = {
      revenue_mtd: safeNum(mtdPnL.summary.revenue),
      expenses_mtd: safeNum(mtdPnL.summary.operating_expenses),
      net_profit_mtd: safeNum(mtdPnL.summary.net_profit),
      revenue_ytd: safeNum(ytdPnL.summary.revenue),
      expenses_ytd: safeNum(ytdPnL.summary.operating_expenses),
      net_profit_ytd: safeNum(ytdPnL.summary.net_profit),
    };

    const ytd: YTDData = {
      financial_health: ytdFinancialHealth,
      balance_sheet: {
        summary: ytdBsSummary,
        lines: ytdBsLines,
      },
      trial_balance: {
        summary: ytdTb.summary,
        lines: ytdTb.lines as TrialBalanceRow[],
      },
      profit_and_loss: {
        summary: ytdPnL.summary,
        lines: ytdPnLRows,
      },
      cash_flow: ytdCashFlowRows,
      director_loan: ytdDirectorLoanRows,
    };

    /* -----------------------------
       COA SUMMARY + ALERTS + QUICK ACTIONS
    ------------------------------ */

    const coa_summary = deriveCoaSummaryFromTB(
      fullTb.lines as TrialBalanceRow[]
    );
    const alerts = deriveAlertsFromTB(fullTb.lines as TrialBalanceRow[]);
    const quick_actions = QUICK_ACTIONS;

    /* -----------------------------
       LEGACY FLAT FIELDS (HYBRID)
    ------------------------------ */

    const bank_accounts = deriveBankFromBalanceSheet(fullBsLines);
    const suspense_and_uncategorised = deriveSuspenseAndUncategorised(
      fullTb.lines as TrialBalanceRow[]
    );

    const legacyFinancialHealth: FinancialHealthFlat = ytdFinancialHealth;

    const data: AccountingOverviewData = {
      full_business,
      ytd,
      coa_summary,
      alerts,
      quick_actions,

      financial_health: legacyFinancialHealth,
      trial_balance_summary: fullTb.summary,
      balance_sheet_summary: fullBsSummary,
      trial_balance_full: fullTb.lines as TrialBalanceRow[],
      balance_sheet_full: fullBsLines,
      profit_and_loss_summary: fullPnL.summary,
      profit_and_loss_full: fullPnLRows,
      director_loan_ledger: fullDirectorLoanRows,
      bank_accounts,
      vat_control: [],
      paye_control: [],
      corporation_tax: [],
      fixed_assets: fixedAssetRows,
      suspense_and_uncategorised,
      cash_flow: fullCashFlowRows,
    };

    return res.status(200).json(data);
  } catch (err) {
    console.error("❌ /api/accounting-overview error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
