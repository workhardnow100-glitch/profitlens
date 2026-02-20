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

type AccountingOverviewData = {
  financial_health: FinancialHealth;
  trial_balance: TrialBalanceSummary;
  profit_and_loss: ProfitAndLossSummary;
  balance_sheet: BalanceSheetSummary;
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

  const { financial_health, trial_balance, profit_and_loss, balance_sheet, coa_summary, alerts, quick_actions } = data;

  return (
    <div className="p-6 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Accounting Overview</h1>
          <p className="text-sm text-gray-500">
            One cockpit for COA, Trial Balance, P&amp;L, Balance Sheet, and tax signals.
          </p>
        </div>
      </header>

      {/* Financial Health Snapshot */}
      <section className="space-y-3">
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

      {/* Trial Balance Summary */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Trial Balance Snapshot</h2>
          <Link href="/trial-balance" className="text-sm text-blue-600 hover:underline">
            View full Trial Balance
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Assets" value={trial_balance.assets} />
          <StatCard label="Liabilities" value={trial_balance.liabilities} />
          <StatCard label="Equity" value={trial_balance.equity} />
          <StatCard label="Income" value={trial_balance.income} />
          <StatCard label="Expenses" value={trial_balance.expenses} />
        </div>
      </section>

      {/* Profit & Loss Summary */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Profit &amp; Loss Summary</h2>
          <Link href="/reports/pnl" className="text-sm text-blue-600 hover:underline">
            View full P&amp;L
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Revenue" value={profit_and_loss.revenue} />
          <StatCard label="Cost of Sales" value={profit_and_loss.cost_of_sales} />
          <StatCard label="Gross Profit" value={profit_and_loss.gross_profit} />
          <StatCard label="Operating Expenses" value={profit_and_loss.operating_expenses} />
          <StatCard label="Net Profit" value={profit_and_loss.net_profit} />
        </div>
      </section>

      {/* Balance Sheet Summary */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Balance Sheet Summary</h2>
          <Link href="/reports/balance-sheet" className="text-sm text-blue-600 hover:underline">
            View full Balance Sheet
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Assets" value={balance_sheet.total_assets} />
          <StatCard label="Total Liabilities" value={balance_sheet.total_liabilities} />
          <StatCard label="Net Assets" value={balance_sheet.net_assets} />
          <StatCard label="Equity" value={balance_sheet.equity} />
        </div>
      </section>

      {/* COA Summary */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Chart of Accounts</h2>
          <Link href="/chart-of-accounts" className="text-sm text-blue-600 hover:underline">
            Open full COA
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total Accounts" value={coa_summary.total_accounts} />
          <StatCard label="Active Accounts" value={coa_summary.active_accounts} />
          <StatCard label="System Accounts" value={coa_summary.system_accounts} />
          <StatCard label="Uncategorised" value={coa_summary.uncategorised_accounts} />
          <StatCard label="Suspense" value={coa_summary.suspense_accounts} />
        </div>
      </section>

      {/* Alerts & Exceptions */}
      <section className="space-y-3">
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
      </section>

      {/* Quick Actions */}
      <section className="space-y-3">
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
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-base font-semibold">
        £{value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
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
