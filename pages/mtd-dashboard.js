// pages/mtd-dashboard.js
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function MtdDashboard() {
  const { data: session, status } = useSession();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) return;

    const fetchSummary = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/mtd-dashboards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "fetchSummary",
            clientId: session.user.clientId,
          }),
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Failed to fetch summary");
        setSummary(result.totals);
      } catch (err) {
        console.error("MTD Dashboard fetch error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [session, status]);

  if (status === "loading") return <p>Loading session…</p>;
  if (!session?.user) return <p>Please log in to view your dashboard.</p>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-2xl font-bold mb-6">MTD Dashboard</h1>

      {loading && <p>Loading dashboard data…</p>}
      {error && <p className="text-red-500">{error}</p>}

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-800 p-4 rounded">
            <h2 className="text-lg font-semibold">Totals</h2>
            <ul className="mt-2 space-y-1">
              <li>Income: £{summary.income.toFixed(2)}</li>
              <li>Expenses: £{summary.expenses.toFixed(2)}</li>
              <li>CIS: £{summary.cis.toFixed(2)}</li>
              <li>VAT: £{summary.vat.toFixed(2)}</li>
              <li>Corp Tax: £{summary.corp.toFixed(2)}</li>
              <li className="font-bold">Net Profit: £{summary.net_profit.toFixed(2)}</li>
            </ul>
          </div>

          <div className="bg-slate-800 p-4 rounded">
            <h2 className="text-lg font-semibold">Charts</h2>
            {/* You can integrate chart.js or recharts here */}
            <p className="text-sm text-slate-400">
              Income vs Expenses chart placeholder
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
