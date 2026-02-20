// pages/reports/balance-sheet.tsx
import { useEffect, useState } from "react";

type BalanceSheetBreakdown = {
  bank_assets: number;
  vat_liability: number;
  cis_liability: number;
  ct_liability: number;
  sa_liability: number;
};

type BalanceSheetSummary = {
  total_assets: number;
  total_liabilities: number;
  net_assets: number;
  equity: number;
  breakdown: BalanceSheetBreakdown;
};

type BalanceSheetResponse = {
  summary: BalanceSheetSummary;
};

export default function BalanceSheetPage() {
  const [data, setData] = useState<BalanceSheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/reports/balance-sheet");
        if (!res.ok) throw new Error("Failed to load balance sheet");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message ?? "Failed to load balance sheet");
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
        <h1 className="text-2xl font-semibold">Balance Sheet</h1>
        <p className="text-gray-600 text-sm">
          Assets, liabilities, and equity for this client.
        </p>
      </header>

      {loading && <p>Loading balance sheet…</p>}
      {error && <p className="text-red-600 text-sm">Error: {error}</p>}

      {!loading && !error && summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card title="Position">
            <Row label="Total Assets" value={summary.total_assets} />
            <Row label="Total Liabilities" value={summary.total_liabilities} />
            <Row label="Net Assets" value={summary.net_assets} bold />
            <Row label="Equity" value={summary.equity} bold />
          </Card>

          <Card title="Breakdown">
            <Row label="Bank Assets" value={summary.breakdown.bank_assets} />
            <Row label="VAT Liability" value={summary.breakdown.vat_liability} />
            <Row label="CIS Liability" value={summary.breakdown.cis_liability} />
            <Row label="Corporation Tax Liability" value={summary.breakdown.ct_liability} />
            <Row label="Self Assessment Liability" value={summary.breakdown.sa_liability} />
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
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className={bold ? "font-semibold text-gray-900" : "text-gray-900"}>
        £{value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}
