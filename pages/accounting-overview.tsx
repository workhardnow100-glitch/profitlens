// pages/accounting-overview.tsx
import { useEffect, useState } from "react";
import Link from "next/link";

/* -----------------------------
   TYPE DEFINITIONS
------------------------------ */

type FinancialHealth = {
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
  account_type: string;
  hmrc_bucket: string | null;
  debit: number;
  credit: number;
  balance: number;
};

type BalanceSheetRow = {
  account_code: string;
  account_name: string;
  account_type: string | null;
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
  opening_balance: number;
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

type AccountingOverviewData = {
  financial_health: FinancialHealth;

  trial_balance_summary: TrialBalanceSummary;
  balance_sheet_summary: BalanceSheetSummary;

  trial_balance_full: TrialBalanceRow[];
  balance_sheet_full: BalanceSheetRow[];
  profit_and_loss_summary: ProfitAndLossSummary;
  profit_and_loss_full: ProfitAndLossRow[];
  director_loan_ledger: DirectorLoanRow[];

  bank_accounts: BankAccountRow[];
  vat_control: SimpleControlRow[];
  paye_control: SimpleControlRow[];
  corporation_tax: SimpleControlRow[];
  fixed_assets: SimpleControlRow[];
  suspense_and_uncategorised: SimpleControlRow[];
  cash_flow: CashFlowRow[];

  coa_summary: CoaSummary;
  alerts: Alert[];
  quick_actions: QuickAction[];
};

/* -----------------------------
   SAFE HELPERS
------------------------------ */

const safeNumber = (v: any) => Number(v || 0);

function formatCurrency(value: number) {
  const n = safeNumber(value);
  return `£${n.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* -----------------------------
   MAIN COMPONENT
------------------------------ */

export default function AccountingOverviewPage() {
  const [data, setData] = useState<AccountingOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"full" | "ytd">("full"); // default: All Years (Full Business)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/accounting-overview");
        if (!res.ok) throw new Error("Failed to load accounting overview");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message ?? "Failed to load accounting overview");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Accounting Overview</h1>
        <p>Loading cockpit…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Accounting Overview</h1>
        <p className="text-red-600">Error: {error ?? "Unknown error"}</p>
      </div>
    );
  }

  const {
    financial_health,
    trial_balance_summary,
    balance_sheet_summary,
    trial_balance_full,
    balance_sheet_full,
    profit_and_loss_summary,
    profit_and_loss_full,
    director_loan_ledger,
    bank_accounts,
    vat_control,
    paye_control,
    corporation_tax,
    fixed_assets,
    suspense_and_uncategorised,
    cash_flow,
    coa_summary,
    alerts,
    quick_actions,
  } = data;

  const bsDerived = {
    assets: safeNumber(balance_sheet_summary.total_assets),
    liabilities: safeNumber(balance_sheet_summary.total_liabilities),
    equity: safeNumber(balance_sheet_summary.equity),
  };

  const tbDerived = {
    assets: safeNumber(trial_balance_summary.assets),
    liabilities: safeNumber(trial_balance_summary.liabilities),
    equity: safeNumber(trial_balance_summary.equity),
    income: safeNumber(trial_balance_summary.income),
    expenses: safeNumber(trial_balance_summary.expenses),
  };

  return (
    <div className="p-6 space-y-8">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold">Accounting Overview</h1>
          <p className="text-sm text-gray-500">
            Cockpit-grade view of your ledger, control accounts, and performance.
          </p>
        </div>

        <div className="mt-1 p-3 rounded-md bg-purple-50 border border-purple-200 text-purple-800 text-sm">
          <strong>About this page:</strong>{" "}
          {mode === "full" ? (
            <>
              This view shows your full accrual-based ledger, including journals, adjustments,
              retained earnings, income and expense accounts, and balances carried forward from
              previous periods. It reflects the company&apos;s total financial position across all years.
            </>
          ) : (
            <>
              This view focuses on the current year only, showing year-to-date performance, cash
              movements, and control accounts for the selected period.
            </>
          )}
        </div>

        {/* MODE TOGGLE */}
        <div className="inline-flex rounded-md border border-gray-200 bg-white shadow-sm text-sm">
          <button
            type="button"
            onClick={() => setMode("full")}
            className={`px-4 py-2 rounded-l-md ${
              mode === "full"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            All Years (Full Business)
          </button>
          <button
            type="button"
            onClick={() => setMode("ytd")}
            className={`px-4 py-2 rounded-r-md border-l border-gray-200 ${
              mode === "ytd"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            This Year (YTD)
          </button>
        </div>
      </header>

      {mode === "full" ? (
        <FullBusinessView
          financial_health={financial_health}
          bsDerived={bsDerived}
          tbDerived={tbDerived}
          profit_and_loss_summary={profit_and_loss_summary}
          profit_and_loss_full={profit_and_loss_full}
          balance_sheet_full={balance_sheet_full}
          trial_balance_full={trial_balance_full}
          director_loan_ledger={director_loan_ledger}
          bank_accounts={bank_accounts}
          vat_control={vat_control}
          paye_control={paye_control}
          corporation_tax={corporation_tax}
          fixed_assets={fixed_assets}
          suspense_and_uncategorised={suspense_and_uncategorised}
          cash_flow={cash_flow}
          coa_summary={coa_summary}
          alerts={alerts}
          quick_actions={quick_actions}
        />
      ) : (
        <YTDView
          financial_health={financial_health}
          bsDerived={bsDerived}
          tbDerived={tbDerived}
          profit_and_loss_summary={profit_and_loss_summary}
          profit_and_loss_full={profit_and_loss_full}
          balance_sheet_full={balance_sheet_full}
          trial_balance_full={trial_balance_full}
          director_loan_ledger={director_loan_ledger}
          bank_accounts={bank_accounts}
          vat_control={vat_control}
          paye_control={paye_control}
          corporation_tax={corporation_tax}
          fixed_assets={fixed_assets}
          suspense_and_uncategorised={suspense_and_uncategorised}
          cash_flow={cash_flow}
          coa_summary={coa_summary}
          alerts={alerts}
          quick_actions={quick_actions}
        />
      )}
    </div>
  );
}

/* -----------------------------
   FULL BUSINESS VIEW
------------------------------ */

type ViewProps = {
  financial_health: FinancialHealth;
  bsDerived: { assets: number; liabilities: number; equity: number };
  tbDerived: {
    assets: number;
    liabilities: number;
    equity: number;
    income: number;
    expenses: number;
  };
  profit_and_loss_summary: ProfitAndLossSummary;
  profit_and_loss_full: ProfitAndLossRow[];
  balance_sheet_full: BalanceSheetRow[];
  trial_balance_full: TrialBalanceRow[];
  director_loan_ledger: DirectorLoanRow[];
  bank_accounts: BankAccountRow[];
  vat_control: SimpleControlRow[];
  paye_control: SimpleControlRow[];
  corporation_tax: SimpleControlRow[];
  fixed_assets: SimpleControlRow[];
  suspense_and_uncategorised: SimpleControlRow[];
  cash_flow: CashFlowRow[];
  coa_summary: CoaSummary;
  alerts: Alert[];
  quick_actions: QuickAction[];
};

function FullBusinessView(props: ViewProps) {
  const {
    financial_health,
    bsDerived,
    tbDerived,
    profit_and_loss_summary,
    profit_and_loss_full,
    balance_sheet_full,
    trial_balance_full,
    director_loan_ledger,
    bank_accounts,
    vat_control,
    paye_control,
    corporation_tax,
    fixed_assets,
    suspense_and_uncategorised,
    cash_flow,
    coa_summary,
    alerts,
    quick_actions,
  } = props;

  return (
    <>
      {/* FINANCIAL HEALTH – FULL BUSINESS */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Financial Health (Full Business)</h2>
          <p className="text-xs text-gray-500">
            Total assets, liabilities, and equity across all years, including carried-forward balances.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Assets (All Years)" value={bsDerived.assets} />
          <StatCard label="Total Liabilities (All Years)" value={bsDerived.liabilities} />
          <StatCard label="Net Assets (All Years)" value={bsDerived.assets - bsDerived.liabilities} />
          <StatCard label="Equity (All Years)" value={bsDerived.equity} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Revenue (YTD)" value={financial_health.revenue_ytd} />
          <StatCard label="Expenses (YTD)" value={financial_health.expenses_ytd} />
          <StatCard label="Net Profit (YTD)" value={financial_health.net_profit_ytd} />
          <StatCard label="Revenue (MTD)" value={financial_health.revenue_mtd} />
        </div>
      </section>

      {/* CASH FLOW + BANK + TAX */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CASH FLOW */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-lg font-semibold">Cash Flow Summary</h2>
            <p className="text-xs text-gray-500">Recent movements across key cash-related accounts.</p>
          </div>
          {cash_flow.length === 0 ? (
            <p className="text-sm text-gray-500">No cash movements yet.</p>
          ) : (
            cash_flow.slice(0, 6).map((row, idx) => (
              <StatCard
                key={idx}
                label={row.account_name}
                value={safeNumber(row.debit) - safeNumber(row.credit)}
              />
            ))
          )}
        </div>

        {/* BANK */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-lg font-semibold">Bank & Cash</h2>
              <p className="text-xs text-gray-500">
                Closing balances and movements for all bank and cash accounts.
              </p>
            </div>
            <Link href="/reports/bank" className="text-blue-600 text-sm hover:underline">
              View bank report
            </Link>
          </div>

          {bank_accounts.length === 0 ? (
            <p className="text-sm text-gray-500">No bank accounts with activity yet.</p>
          ) : (
            bank_accounts.map((b) => (
              <div
                key={b.account_code}
                className="border rounded p-3 mb-2 bg-white shadow-sm text-sm"
              >
                <div className="flex justify-between">
                  <span className="font-semibold">
                    {b.account_code} · {b.account_name}
                  </span>
                  <span>Closing: {formatCurrency(b.closing_balance)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>In: {formatCurrency(b.money_in)}</span>
                  <span>Out: {formatCurrency(b.money_out)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* TAX */}
        <div>
          <h2 className="text-lg font-semibold mb-1">Tax Control Accounts</h2>
          <p className="text-xs text-gray-500 mb-2">
            Live balances for VAT, PAYE/NI, and Corporation Tax control accounts.
          </p>
          <ControlBlock title="VAT" rows={vat_control} link="/reports/vat" />
          <ControlBlock title="PAYE / NI" rows={paye_control} link="/reports/paye" />
          <ControlBlock title="Corporation Tax" rows={corporation_tax} link="/reports/corporation-tax" />
        </div>
      </section>

      {/* FULL P&L + BS + TB */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* P&L */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-lg font-semibold">Profit & Loss (All Years)</h2>
              <p className="text-xs text-gray-500">
                Cumulative revenue and expenses across the full ledger.
              </p>
            </div>
            <Link href="/reports/pnl" className="text-blue-600 text-sm hover:underline">
              View full P&L
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard label="Revenue" value={profit_and_loss_summary.revenue} />
            <StatCard label="Operating Expenses" value={profit_and_loss_summary.operating_expenses} />
            <StatCard label="Gross Profit" value={profit_and_loss_summary.gross_profit} />
            <StatCard label="Net Profit" value={profit_and_loss_summary.net_profit} />
          </div>

          <SimpleTable
            columns={["Code", "Name", "Balance"]}
            rows={profit_and_loss_full.map((r) => [
              r.account_code,
              r.account_name,
              formatCurrency(r.balance),
            ])}
          />
        </div>

        {/* BALANCE SHEET */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-lg font-semibold">Balance Sheet (All Years)</h2>
              <p className="text-xs text-gray-500">
                Total assets, liabilities, and equity including carried-forward balances.
              </p>
            </div>
            <Link href="/reports/balance-sheet" className="text-blue-600 text-sm hover:underline">
              View full Balance Sheet
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard label="Total Assets" value={bsDerived.assets} />
            <StatCard label="Total Liabilities" value={bsDerived.liabilities} />
            <StatCard label="Net Assets" value={bsDerived.assets - bsDerived.liabilities} />
            <StatCard label="Equity" value={bsDerived.equity} />
          </div>

          <SimpleTable
            columns={["Code", "Name", "Balance"]}
            rows={balance_sheet_full.map((r) => [
              r.account_code,
              r.account_name,
              formatCurrency(r.balance),
            ])}
          />
        </div>

        {/* TRIAL BALANCE */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-lg font-semibold">Trial Balance (Full Ledger)</h2>
              <p className="text-xs text-gray-500">
                All accounts across all periods, debit and credit totals.
              </p>
            </div>
            <Link href="/reports/trial-balance" className="text-blue-600 text-sm hover:underline">
              View full Trial Balance
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard label="Assets" value={tbDerived.assets} />
            <StatCard label="Liabilities" value={tbDerived.liabilities} />
            <StatCard label="Equity" value={tbDerived.equity} />
            <StatCard label="Income" value={tbDerived.income} />
            <StatCard label="Expenses" value={tbDerived.expenses} />
          </div>

          <SimpleTable
            columns={["Code", "Name", "Debit", "Credit"]}
            rows={trial_balance_full.map((r) => [
              r.account_code,
              r.account_name,
              formatCurrency(r.debit),
              formatCurrency(r.credit),
            ])}
          />
        </div>
      </section>

      {/* DIRECTOR LOAN + FIXED ASSETS + SUSPENSE + COA */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DIRECTOR LOAN */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-lg font-semibold">Director Loan Account</h2>
              <p className="text-xs text-gray-500">
                Cumulative director loan movements and closing balance.
              </p>
            </div>
            <Link href="/reports/director-loan" className="text-blue-600 text-sm hover:underline">
              View DL report
            </Link>
          </div>

          <SimpleTable
            columns={["Code", "Name", "Balance"]}
            rows={director_loan_ledger.map((r) => [
              r.account_code,
              r.account_name,
              formatCurrency(r.balance),
            ])}
          />
        </div>

        {/* FIXED ASSETS */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-lg font-semibold">Fixed Assets (Carried Forward)</h2>
              <p className="text-xs text-gray-500">
                Fixed asset balances as carried in the ledger. NBV and depreciation can be
                expanded in the fixed asset report.
              </p>
            </div>
            <Link href="/reports/fixed-assets" className="text-blue-600 text-sm hover:underline">
              View fixed assets
            </Link>
          </div>

          {fixed_assets.length === 0 ? (
            <p className="text-sm text-gray-500">No fixed asset balances yet.</p>
          ) : (
            <SimpleTable
              columns={["Code", "Name", "Balance"]}
              rows={fixed_assets.map((r) => [
                r.account_code,
                r.account_name,
                formatCurrency(r.balance),
              ])}
            />
          )}
        </div>

        {/* SUSPENSE + COA */}
        <div className="space-y-4">
          {/* SUSPENSE */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div>
                <h2 className="text-lg font-semibold">Suspense & Uncategorized</h2>
                <p className="text-xs text-gray-500">
                  Accounts and balances that need review or categorisation.
                </p>
              </div>
              <Link href="/reports/suspense" className="text-blue-600 text-sm hover:underline">
                View suspense
              </Link>
            </div>

            {suspense_and_uncategorised.length === 0 ? (
              <p className="text-sm text-gray-500">No suspense or uncategorised balances.</p>
            ) : (
              <SimpleTable
                columns={["Code", "Name", "Balance"]}
                rows={suspense_and_uncategorised.map((r) => [
                  r.account_code,
                  r.account_name,
                  formatCurrency(r.balance),
                ])}
              />
            )}
          </div>

          {/* COA SUMMARY */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div>
                <h2 className="text-lg font-semibold">Chart of Accounts</h2>
                <p className="text-xs text-gray-500">
                  High-level overview of your account structure.
                </p>
              </div>
              <Link href="/chart-of-accounts" className="text-blue-600 text-sm hover:underline">
                Open full COA
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="Total Accounts" value={coa_summary.total_accounts} type="number" />
              <StatCard label="Active Accounts" value={coa_summary.active_accounts} type="number" />
              <StatCard label="System Accounts" value={coa_summary.system_accounts} type="number" />
              <StatCard label="Uncategorised" value={coa_summary.uncategorised_accounts} type="number" />
              <StatCard label="Suspense" value={coa_summary.suspense_accounts} type="number" />
            </div>
          </div>
        </div>
      </section>

      {/* ALERTS + QUICK ACTIONS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ALERTS */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Alerts & Exceptions</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-500">No alerts. This ledger is flying clean.</p>
          ) : (
            alerts.map((alert, idx) => <AlertRow key={idx} alert={alert} />)
          )}
        </div>

        {/* QUICK ACTIONS */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Quick Actions</h2>
          <p className="text-xs text-gray-500 mb-1">
            Jump straight into the most common workflows from your cockpit.
          </p>
          <div className="flex flex-wrap gap-2">
            {quick_actions.map((action, idx) => (
              <Link
                key={idx}
                href={action.link}
                className="px-3 py-2 text-sm rounded border border-gray-300 hover:border-blue-500 hover:text-blue-600 transition"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

/* -----------------------------
   YTD VIEW
------------------------------ */

function YTDView(props: ViewProps) {
  const {
    financial_health,
    bsDerived,
    tbDerived,
    profit_and_loss_summary,
    profit_and_loss_full,
    balance_sheet_full,
    trial_balance_full,
    director_loan_ledger,
    bank_accounts,
    vat_control,
    paye_control,
    corporation_tax,
    fixed_assets,
    suspense_and_uncategorised,
    cash_flow,
    coa_summary,
    alerts,
    quick_actions,
  } = props;

  return (
    <>
      {/* FINANCIAL HEALTH – YTD */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Financial Health (This Year)</h2>
          <p className="text-xs text-gray-500">
            Year-to-date view of assets, liabilities, equity, and performance.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Assets (Snapshot)" value={bsDerived.assets} />
          <StatCard label="Liabilities (Snapshot)" value={bsDerived.liabilities} />
          <StatCard label="Equity (Snapshot)" value={bsDerived.equity} />
          <StatCard label="Net Profit (YTD)" value={financial_health.net_profit_ytd} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Revenue (MTD)" value={financial_health.revenue_mtd} />
          <StatCard label="Expenses (MTD)" value={financial_health.expenses_mtd} />
          <StatCard label="Revenue (YTD)" value={financial_health.revenue_ytd} />
          <StatCard label="Expenses (YTD)" value={financial_health.expenses_ytd} />
        </div>
      </section>

      {/* CASH FLOW + BANK + TAX */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* CASH FLOW */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-lg font-semibold">Cash Flow (YTD)</h2>
            <p className="text-xs text-gray-500">Key cash movements for the current year.</p>
          </div>
          {cash_flow.length === 0 ? (
            <p className="text-sm text-gray-500">No cash movements yet.</p>
          ) : (
            cash_flow.slice(0, 6).map((row, idx) => (
              <StatCard
                key={idx}
                label={row.account_name}
                value={safeNumber(row.debit) - safeNumber(row.credit)}
              />
            ))
          )}
        </div>

        {/* BANK */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-lg font-semibold">Bank & Cash (YTD)</h2>
              <p className="text-xs text-gray-500">
                Current-year movements and closing balances.
              </p>
            </div>
            <Link href="/reports/bank" className="text-blue-600 text-sm hover:underline">
              View bank report
            </Link>
          </div>

          {bank_accounts.length === 0 ? (
            <p className="text-sm text-gray-500">No bank accounts with activity yet.</p>
          ) : (
            bank_accounts.map((b) => (
              <div
                key={b.account_code}
                className="border rounded p-3 mb-2 bg-white shadow-sm text-sm"
              >
                <div className="flex justify-between">
                  <span className="font-semibold">
                    {b.account_code} · {b.account_name}
                  </span>
                  <span>Closing: {formatCurrency(b.closing_balance)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>In: {formatCurrency(b.money_in)}</span>
                  <span>Out: {formatCurrency(b.money_out)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* TAX */}
        <div>
          <h2 className="text-lg font-semibold mb-1">Tax Control Accounts (YTD)</h2>
          <p className="text-xs text-gray-500 mb-2">
            Current-year movements and balances for VAT, PAYE/NI, and Corporation Tax.
          </p>
          <ControlBlock title="VAT" rows={vat_control} link="/reports/vat" />
          <ControlBlock title="PAYE / NI" rows={paye_control} link="/reports/paye" />
          <ControlBlock title="Corporation Tax" rows={corporation_tax} link="/reports/corporation-tax" />
        </div>
      </section>

      {/* P&L + BS + TB – YTD CONTEXT */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* P&L */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-lg font-semibold">Profit & Loss (YTD)</h2>
              <p className="text-xs text-gray-500">
                Revenue and expenses for the current year.
              </p>
            </div>
            <Link href="/reports/pnl" className="text-blue-600 text-sm hover:underline">
              View full P&L
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard label="Revenue" value={profit_and_loss_summary.revenue} />
            <StatCard label="Operating Expenses" value={profit_and_loss_summary.operating_expenses} />
            <StatCard label="Gross Profit" value={profit_and_loss_summary.gross_profit} />
            <StatCard label="Net Profit" value={profit_and_loss_summary.net_profit} />
          </div>

          <SimpleTable
            columns={["Code", "Name", "Balance"]}
            rows={profit_and_loss_full.map((r) => [
              r.account_code,
              r.account_name,
              formatCurrency(r.balance),
            ])}
          />
        </div>

        {/* BALANCE SHEET */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-lg font-semibold">Balance Sheet (Snapshot)</h2>
              <p className="text-xs text-gray-500">
                Current snapshot of assets, liabilities, and equity.
              </p>
            </div>
            <Link href="/reports/balance-sheet" className="text-blue-600 text-sm hover:underline">
              View full Balance Sheet
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard label="Total Assets" value={bsDerived.assets} />
            <StatCard label="Total Liabilities" value={bsDerived.liabilities} />
            <StatCard label="Net Assets" value={bsDerived.assets - bsDerived.liabilities} />
            <StatCard label="Equity" value={bsDerived.equity} />
          </div>

          <SimpleTable
            columns={["Code", "Name", "Balance"]}
            rows={balance_sheet_full.map((r) => [
              r.account_code,
              r.account_name,
              formatCurrency(r.balance),
            ])}
          />
        </div>

        {/* TRIAL BALANCE */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-lg font-semibold">Trial Balance (Current Ledger)</h2>
              <p className="text-xs text-gray-500">
                Current ledger balances by account.
              </p>
            </div>
            <Link href="/reports/trial-balance" className="text-blue-600 text-sm hover:underline">
              View full Trial Balance
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard label="Assets" value={tbDerived.assets} />
            <StatCard label="Liabilities" value={tbDerived.liabilities} />
            <StatCard label="Equity" value={tbDerived.equity} />
            <StatCard label="Income" value={tbDerived.income} />
            <StatCard label="Expenses" value={tbDerived.expenses} />
          </div>

          <SimpleTable
            columns={["Code", "Name", "Debit", "Credit"]}
            rows={trial_balance_full.map((r) => [
              r.account_code,
              r.account_name,
              formatCurrency(r.debit),
              formatCurrency(r.credit),
            ])}
          />
        </div>
      </section>

      {/* DIRECTOR LOAN + FIXED ASSETS + SUSPENSE + COA */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DIRECTOR LOAN */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-lg font-semibold">Director Loan (YTD)</h2>
              <p className="text-xs text-gray-500">
                Current-year movements and closing balance.
              </p>
            </div>
            <Link href="/reports/director-loan" className="text-blue-600 text-sm hover:underline">
              View DL report
            </Link>
          </div>

          <SimpleTable
            columns={["Code", "Name", "Balance"]}
            rows={director_loan_ledger.map((r) => [
              r.account_code,
              r.account_name,
              formatCurrency(r.balance),
            ])}
          />
        </div>

        {/* FIXED ASSETS */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <div>
              <h2 className="text-lg font-semibold">Fixed Assets (Snapshot)</h2>
              <p className="text-xs text-gray-500">
                Current fixed asset balances as per the ledger.
              </p>
            </div>
            <Link href="/reports/fixed-assets" className="text-blue-600 text-sm hover:underline">
              View fixed assets
            </Link>
          </div>

          {fixed_assets.length === 0 ? (
            <p className="text-sm text-gray-500">No fixed asset balances yet.</p>
          ) : (
            <SimpleTable
              columns={["Code", "Name", "Balance"]}
              rows={fixed_assets.map((r) => [
                r.account_code,
                r.account_name,
                formatCurrency(r.balance),
              ])}
            />
          )}
        </div>

        {/* SUSPENSE + COA */}
        <div className="space-y-4">
          {/* SUSPENSE */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div>
                <h2 className="text-lg font-semibold">Suspense & Uncategorized</h2>
                <p className="text-xs text-gray-500">
                  Items that still need review or categorisation.
                </p>
              </div>
              <Link href="/reports/suspense" className="text-blue-600 text-sm hover:underline">
                View suspense
              </Link>
            </div>

            {suspense_and_uncategorised.length === 0 ? (
              <p className="text-sm text-gray-500">No suspense or uncategorised balances.</p>
            ) : (
              <SimpleTable
                columns={["Code", "Name", "Balance"]}
                rows={suspense_and_uncategorised.map((r) => [
                  r.account_code,
                  r.account_name,
                  formatCurrency(r.balance),
                ])}
              />
            )}
          </div>

          {/* COA SUMMARY */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <div>
                <h2 className="text-lg font-semibold">Chart of Accounts</h2>
                <p className="text-xs text-gray-500">
                  Snapshot of your account structure for this ledger.
                </p>
              </div>
              <Link href="/chart-of-accounts" className="text-blue-600 text-sm hover:underline">
                Open full COA
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="Total Accounts" value={coa_summary.total_accounts} type="number" />
              <StatCard label="Active Accounts" value={coa_summary.active_accounts} type="number" />
              <StatCard label="System Accounts" value={coa_summary.system_accounts} type="number" />
              <StatCard label="Uncategorised" value={coa_summary.uncategorised_accounts} type="number" />
              <StatCard label="Suspense" value={coa_summary.suspense_accounts} type="number" />
            </div>
          </div>
        </div>
      </section>

      {/* ALERTS + QUICK ACTIONS */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ALERTS */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Alerts & Exceptions</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-500">No alerts. This ledger is flying clean.</p>
          ) : (
            alerts.map((alert, idx) => <AlertRow key={idx} alert={alert} />)
          )}
        </div>

        {/* QUICK ACTIONS */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Quick Actions</h2>
          <p className="text-xs text-gray-500 mb-1">
            Common workflows to manage this year&apos;s activity.
          </p>
          <div className="flex flex-wrap gap-2">
            {quick_actions.map((action, idx) => (
              <Link
                key={idx}
                href={action.link}
                className="px-3 py-2 text-sm rounded border border-gray-300 hover:border-blue-500 hover:text-blue-600 transition"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

/* -----------------------------
   UI HELPERS
------------------------------ */

function StatCard({
  label,
  value,
  type = "currency",
}: {
  label: string;
  value: number;
  type?: "currency" | "number";
}) {
  const n = safeNumber(value);
  const formatted =
    type === "currency"
      ? formatCurrency(n)
      : n.toLocaleString("en-GB");

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-base font-semibold">{formatted}</div>
    </div>
  );
}

function SimpleTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number)[][];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No data.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full text-xs">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-2 py-2 text-left font-semibold text-gray-600"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-t border-gray-100">
              {row.map((cell, i) => (
                <td key={i} className="px-2 py-1 text-gray-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ControlBlock({
  title,
  rows,
  link,
}: {
  title: string;
  rows: SimpleControlRow[];
  link: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm mb-2">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="font-semibold text-gray-700">{title}</span>
        <Link href={link} className="text-blue-600 hover:underline">
          View
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-gray-500">No balances.</p>
      ) : (
        <div className="space-y-1 text-xs">
          {rows.map((r) => (
            <div key={r.account_code} className="flex justify-between">
              <span>
                {r.account_code} · {r.account_name}
              </span>
              <span>{formatCurrency(r.balance)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const color =
    alert.severity === "high"
      ? "text-red-600"
      : alert.severity === "medium"
      ? "text-amber-600"
      : "text-gray-600";

  const labelMap: Record<string, string> = {
    uncategorised_transactions: "Uncategorised transactions",
    negative_balance: "Negative balances",
    tax_liabilities: "Tax liabilities",
  };

  const label = labelMap[alert.type] ?? alert.type;

  const content = (
    <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm">
      <span className={color}>
        {label}: <span className="font-semibold">{alert.count}</span>
      </span>
      <span className="text-xs text-gray-400 uppercase">{alert.severity}</span>
    </div>
  );

  if (alert.link) {
    return (
      <Link
        href={alert.link}
        className="block hover:border-blue-400 hover:shadow-sm transition"
      >
        {content}
      </Link>
    );
  }

  return content;
}
