import { useEffect, useState } from "react";

export default function BalanceSheetPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/reports/balance-sheet");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Balance sheet load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-6">Loading balance sheet…</div>;
  }

  if (!data) {
    return <div className="p-6">No data available.</div>;
  }

  const { assets, liabilities, equity, totals } = data;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Balance Sheet</h1>

      {/* ASSETS */}
      <Section title="Assets">
        <Subsection title="Current Assets" rows={assets.current} />
        <Subsection title="Non‑current Assets" rows={assets.non_current} />

        <TotalRow label="Total Assets" value={totals.total_assets} />
      </Section>

      {/* LIABILITIES */}
      <Section title="Liabilities">
        <Subsection title="Current Liabilities" rows={liabilities.current} />
        <Subsection title="Non‑current Liabilities" rows={liabilities.non_current} />

        <TotalRow label="Total Liabilities" value={totals.total_liabilities} />
      </Section>

      {/* EQUITY */}
      <Section title="Equity">
        <Subsection title="Equity" rows={equity} />

        <TotalRow label="Total Equity" value={totals.equity} />
      </Section>

      {/* NET ASSETS */}
      <div className="mt-10 p-4 bg-gray-100 rounded">
        <div className="flex justify-between text-lg font-semibold">
          <span>Net Assets</span>
          <span>£{format(totals.net_assets)}</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="mb-10">
      <h2 className="text-2xl font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Subsection({ title, rows }: any) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="text-lg font-medium mb-2">{title}</h3>

      <table className="w-full mb-4">
        <tbody>
          {rows.map((row: any) => (
            <tr key={row.account_code} className="border-b">
              <td className="py-2 text-gray-700">
                {row.account_code} — {row.account_name}
              </td>
              <td className="py-2 text-right font-medium">
                £{format(row.balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TotalRow({ label, value }: any) {
  return (
    <div className="flex justify-between text-lg font-semibold border-t pt-3 mt-3">
      <span>{label}</span>
      <span>£{format(value)}</span>
    </div>
  );
}

function format(num: number) {
  return Number(num || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
