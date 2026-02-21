// pages/reports/pnl.tsx
import { useEffect, useState } from "react";

type PnlSummary = {
  revenue: number;
  cost_of_sales: number;
  gross_profit: number;
  operating_expenses: number;
  net_profit: number;
  revenue_mtd: number;
  revenue_ytd: number;
  expenses_mtd: number;
  expenses_ytd: number;
  net_profit_mtd: number;
  net_profit_ytd: number;
};

type PnlResponse = {
  summary: PnlSummary;
};

export default function PnlReportPage() {
  const [data, setData] = useState<PnlResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/reports/pnl");
        if (!res.ok) throw new Error("Failed to load P&L");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message ?? "Failed to load P&L");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const summary = data?.summary;

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Profit &amp; Loss</h1>
        <p className="text-gray-600 text-sm">
          Revenue, expenses, and profit for this client.
        </p>
      </header>

      {loading && <p>Loading P&amp;L…</p>}
      {error && <p className="text-red-600 text-sm">Error: {error}</p>}

      {!loading && !error && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Summary (YTD)">
            <Row label="Revenue" value={summary.revenue} />
            <Row label="Cost of Sales" value={summary.cost_of_sales} />
            <Row label="Gross Profit" value={summary.gross_profit} />
            <Row label="Operating Expenses" value={summary.operating_expenses} />
            <Row label="Net Profit" value={summary.net_profit} bold />
          </Card>

          <Card title="Period Performance">
            <Row label="Revenue (MTD)" value={summary.revenue_mtd} />
            <Row label="Expenses (MTD)" value={summary.expenses_mtd} />
            <Row label="Net Profit (MTD)" value={summary.net_profit_mtd} bold />
            <Row label="Revenue (YTD)" value={summary.revenue_ytd} />
            <Row label="Expenses (YTD)" value={summary.expenses_ytd} />
            <Row label="Net Profit (YTD)" value={summary.net_profit_ytd} bold />
          </Card>
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-800 mb-3">{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  // ⭐ SAFETY FIX: prevent undefined.toLocaleString() crash
  const safeValue = Number(value ?? 0);

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={bold ? "font-semibold text-gray-900" : "text-gray-900"}>
        £{safeValue.toLocaleString("en-GB", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>
    </div>
  );
}
