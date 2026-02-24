// pages/accounting-overview.tsx
import { useEffect, useState } from "react";
import Link from "next/link";

type FinancialHealth = {
  assets: number;
  liabilities: number;
  equity: number;
  revenue_mtd: number;
  revenue_ytd: number;
  expenses_mtd: number;
  expenses_ytd: number;
  net_profit_mtd: number;
  net_profit_ytd: number;
};

type TrialBalanceSummary = {
  assets: number;
  liabilities: number;
  equity: number;
  income: number;
  expenses: number;
};

type ProfitAndLossSummary = {
  revenue: number;
  cost_of_sales: number;
  gross_profit: number;
  operating_expenses: number;
  net_profit: number;
};

type BalanceSheetSummary = {
  total_assets: number;
  total_liabilities: number;
  net_assets: number;
  equity: number;
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

// FULL REPORT TYPES
type TrialBalanceRow = {
  section: string;
  account_code: string;
  account_name: string;
  account_type: string;
  hmrc_bucket: string | null;
  debit: number;
  credit: number;
};

type BalanceSheetRow = {
  section: string;
  account_code: string;
  account_name: string;
  amount: number;
};

type ProfitAndLossRow = {
  section: string;
  account_code: string;
  account_name: string;
  amount: number;
};

type DirectorLoanRow = {
  section: string;
  date: string | null;
  amount: number | null;
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
  section: string;
  amount: number;
};

type AccountingOverviewData = {
  financial_health: FinancialHealth;

  trial_balance_summary: TrialBalanceSummary;
  profit_and_loss_summary: ProfitAndLossSummary;
  balance_sheet_summary: BalanceSheetSummary;

  trial_balance_full: TrialBalanceRow[];
  balance_sheet_full: BalanceSheetRow[];
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

export default function AccountingOverviewPage() {
  const [data, setData] = useState<AccountingOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/accounting-overview");
        if (!res.ok) {
          throw new Error("Failed to load accounting overview");
        }
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
    profit_and_loss_summary,
    balance_sheet_summary,
    trial_balance_full,
    balance_sheet_full,
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

  return (
    <div className="p-6 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Accounting Overview</h1>
          <p className="text-sm text-gray-500">
            Cockpit-grade view of your ledger, control accounts, and performance.
          </p>
        </div>
      </header>

      {/* TOP STRIP: HEALTH + CASH + BANK + TAX */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Financial Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Assets" value={financial_health.assets} />
          <StatCard label="Liabilities" value={financial_health.liabilities} />
          <StatCard label="Equity" value={financial_health.equity} />
          <StatCard label="Net Profit (YTD)" value={financial_health.net_profit_ytd} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Revenue (MTD)" value={financial_health.revenue_mtd} />
          <StatCard label="Expenses (MTD)" value={financial_health.expenses_mtd} />
          <StatCard label="Revenue (YTD)" value={financial_health.revenue_ytd} />
          <StatCard label="Expenses (YTD)" value={financial_health.expenses_ytd} />
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Cash Flow */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Cash Flow Summary</h2>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {cash_flow.map((row, idx) => (
              <StatCard key={idx} label={row.section} value={row.amount} />
            ))}
          </div>
        </div>

        {/* Bank Accounts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Bank &amp; Cash</h2>
            <Link href="/reports/bank" className="text-sm text-blue-600 hover:underline">
              View bank report
            </Link>
          </div>
          {bank_accounts.length === 0 ? (
            <p className="text-sm text-gray-500">No bank accounts with activity yet.</p>
          ) : (
            <div className="space-y-2">
              {bank_accounts.map((b) => (
                <div
                  key={b.account_code}
                  className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm text-sm"
                >
                  <div className="flex justify-between">
                    <span className="font-semibold">
                      {b.account_code} · {b.account_name}
                    </span>
                    <span className="text-gray-500">
                      Closing: {formatCurrency(b.closing_balance)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-gray-500">
                    <span>In: {formatCurrency(b.money_in)}</span>
                    <span>Out: {formatCurrency(b.money_out)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tax Controls */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Tax Control Accounts</h2>
          <div className="space-y-2 text-sm">
            <ControlBlock title="VAT" rows={vat_control} link="/reports/vat" />
            <ControlBlock title="PAYE / NI" rows={paye_control} link="/reports/paye" />
            <ControlBlock title="Corporation Tax" rows={corporation_tax} link="/reports/corporation-tax" />
          </div>
        </div>
      </section>

      {/* MIDDLE: FULL P&L + BS + TB */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* P&L */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Profit &amp; Loss</h2>
            <Link href="/reports/pnl" className="text-sm text-blue-600 hover:underline">
              View full P&amp;L
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Revenue" value={profit_and_loss_summary.revenue} />
            <StatCard label="Operating Expenses" value={profit_and_loss_summary.operating_expenses} />
            <StatCard label="Gross Profit" value={profit_and_loss_summary.gross_profit} />
            <StatCard label="Net Profit" value={profit_and_loss_summary.net_profit} />
          </div>
          <SimpleTable
            columns={["Section", "Code", "Name", "Amount"]}
            rows={profit_and_loss_full.map((r) => [
              r.section,
              r.account_code,
              r.account_name,
              formatCurrency(r.amount),
            ])}
          />
        </div>

        {/* Balance Sheet */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Balance Sheet</h2>
            <Link href="/reports/balance-sheet" className="text-sm text-blue-600 hover:underline">
              View full Balance Sheet
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Assets" value={balance_sheet_summary.total_assets} />
            <StatCard label="Total Liabilities" value={balance_sheet_summary.total_liabilities} />
            <StatCard label="Net Assets" value={balance_sheet_summary.net_assets} />
            <StatCard label="Equity" value={balance_sheet_summary.equity} />
          </div>
          <SimpleTable
            columns={["Section", "Code", "Name", "Amount"]}
            rows={balance_sheet_full.map((r) => [
              r.section,
              r.account_code,
              r.account_name,
              formatCurrency(r.amount),
            ])}
          />
        </div>

        {/* Trial Balance */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Trial Balance</h2>
            <Link href="/reports/trial-balance" className="text-sm text-blue-600 hover:underline">
              View full Trial Balance
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Assets" value={trial_balance_summary.assets} />
            <StatCard label="Liabilities" value={trial_balance_summary.liabilities} />
            <StatCard label="Equity" value={trial_balance_summary.equity} />
            <StatCard label="Income" value={trial_balance_summary.income} />
            <StatCard label="Expenses" value={trial_balance_summary.expenses} />
          </div>
          <SimpleTable
            columns={["Section", "Code", "Name", "Debit", "Credit"]}
            rows={trial_balance_full.map((r) => [
              r.section,
              r.account_code,
              r.account_name,
              formatCurrency(r.debit),
              formatCurrency(r.credit),
            ])}
          />
        </div>
      </section>

      {/* BOTTOM: DL, FIXED ASSETS, SUSPENSE, COA, ALERTS, QUICK ACTIONS */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Director Loan */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Director Loan Account</h2>
            <Link href="/reports/director-loan" className="text-sm text-blue-600 hover:underline">
              View DL report
            </Link>
          </div>
          <SimpleTable
            columns={["Section", "Amount"]}
            rows={director_loan_ledger.map((r, idx) => [
              r.section,
              r.amount === null ? "-" : formatCurrency(r.amount),
            ])}
          />
        </div>

        {/* Fixed Assets */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Fixed Assets</h2>
            <Link href="/reports/fixed-assets" className="text-sm text-blue-600 hover:underline">
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

        {/* Suspense & COA */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Suspense &amp; Uncategorized</h2>
              <Link href="/reports/suspense" className="text-sm text-blue-600 hover:underline">
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Chart of Accounts</h2>
              <Link href="/chart-of-accounts" className="text-sm text-blue-600 hover:underline">
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

      {/* Alerts & Quick Actions */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Alerts &amp; Exceptions</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-500">No alerts. This ledger is flying clean.</p>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert, idx) => (
                <AlertRow key={idx} alert={alert} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
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
    </div>
  );
}

/* Helpers */

function StatCard({
  label,
  value,
  type = "currency",
}: {
  label: string;
  value: number;
  type?: "currency" | "number";
}) {
  const formatted =
    type === "currency"
      ? formatCurrency(value)
      : value.toLocaleString("en-GB");

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-base font-semibold">{formatted}</div>
    </div>
  );
}

function formatCurrency(value: number) {
  return `£${value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
              <th key={col} className="px-2 py-2 text-left font-semibold text-gray-600">
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
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
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
      <Link href={alert.link} className="block hover:border-blue-400 hover:shadow-sm transition">
        {content}
      </Link>
    );
  }

  return content;
}
