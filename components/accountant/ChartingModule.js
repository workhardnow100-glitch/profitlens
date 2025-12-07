import { useEffect, useState } from "react";
import { useUser } from "../../hooks/useUser";
import { RevenuePie, ExpenseBar, ProfitTrend } from "../../components/DashboardCharts";

export default function ChartingModule() {
  const { user } = useUser();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.clientId) return;

    async function fetchStats() {
      try {
        const res = await fetch("/api/clients/stats");
        if (!res.ok) throw new Error("Failed to fetch stats");
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error("Stats fetch error:", err);
        setError("Unable to load chart data.");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [user?.clientId]);

  // ✅ Subscription gating
  if (!["basic", "pro"].includes(user.subscriptionStatus)) {
    return (
      <section className="p-6 bg-white rounded shadow">
        <h2 className="text-xl font-semibold text-slate-800">Charting Module</h2>
        <p className="text-sm text-slate-500">
          🔒 Upgrade to Pro to unlock analytics and charting.
        </p>
      </section>
    );
  }

  return (
    <section className="p-6 bg-white rounded shadow space-y-6">
      <h2 className="text-xl font-semibold text-slate-800">Charting Module</h2>

      {loading ? (
        <p className="text-sm text-slate-500">Loading charts...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !stats ? (
        <p className="text-sm text-slate-500">No chart data available.</p>
      ) : (
        <>
          <div>
            <h3 className="text-lg font-medium text-slate-700 mb-2">Revenue Breakdown</h3>
            <RevenuePie data={stats.revenueByCategory || []} />
          </div>

          <div>
            <h3 className="text-lg font-medium text-slate-700 mb-2">Expense Breakdown</h3>
            <ExpenseBar data={stats.expensesByCategory || []} />
          </div>

          <div>
            <h3 className="text-lg font-medium text-slate-700 mb-2">Monthly Profit Trend</h3>
            <ProfitTrend data={stats.monthlyProfit || []} />
          </div>
        </>
      )}
    </section>
  );
}
