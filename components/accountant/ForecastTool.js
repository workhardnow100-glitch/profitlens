import { useState, useEffect, useMemo } from "react";
import { useUser } from "../../hooks/useUser";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from "recharts";

export default function ForecastTool() {
  const { user } = useUser();
  const [baseRevenue, setBaseRevenue] = useState(0);
  const [baseExpenses, setBaseExpenses] = useState(0);
  const [growthRate, setGrowthRate] = useState(0.03); // 3%
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/clients/stats");
        if (!res.ok) throw new Error("Failed to fetch stats");
        const data = await res.json();
        setBaseRevenue(parseFloat(data.revenue) || 0);
        setBaseExpenses(parseFloat(data.expenses) || 0);
      } catch (err) {
        console.error(err);
        setError("Unable to load client stats.");
      } finally {
        setLoading(false);
      }
    }
    if (user?.clientId) fetchStats();
  }, [user?.clientId]);

  const forecastMonths = 12;

  const forecastData = useMemo(() => {
    const data = [];
    for (let i = 0; i < forecastMonths; i++) {
      const month = `M${i + 1}`;
      const revenue = baseRevenue * Math.pow(1 + growthRate, i);
      const expenses = baseExpenses;
      const net = revenue - expenses;
      data.push({
        month,
        revenue: parseFloat(revenue.toFixed(2)),
        expenses: parseFloat(expenses.toFixed(2)),
        net: parseFloat(net.toFixed(2)),
      });
    }
    return data;
  }, [baseRevenue, baseExpenses, growthRate]);

  // ✅ Subscription gating
  if (!["basic", "pro"].includes(user.subscriptionStatus)) {
    return (
      <section className="p-6 bg-white rounded shadow">
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Forecast Tool</h2>
        <p className="text-sm text-slate-500">
          🔒 Upgrade to Pro to unlock forecasting and scenario planning.
        </p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="p-6 bg-white rounded shadow">
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Forecast Tool</h2>
        <p className="text-sm text-slate-500">Loading client stats...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="p-6 bg-white rounded shadow">
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Forecast Tool</h2>
        <p className="text-sm text-red-600">{error}</p>
      </section>
    );
  }

  return (
    <section className="p-6 bg-white rounded shadow">
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Forecast Tool</h2>
      <p className="text-sm text-slate-500 mb-4">
        Simulate future performance for <strong>{user.clientId}</strong> by adjusting growth rate.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Revenue (£)</label>
          <input
            type="number"
            value={baseRevenue}
            onChange={(e) => setBaseRevenue(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Expenses (£)</label>
          <input
            type="number"
            value={baseExpenses}
            onChange={(e) => setBaseExpenses(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Growth Rate (%)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={growthRate * 100}
            onChange={(e) => setGrowthRate(Number(e.target.value) / 100)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={forecastData}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(value) => `£${value}`} /> {/* ✅ currency formatting */}
          <Legend />
          <Line type="monotone" dataKey="revenue" stroke="#4ade80" name="Revenue" />
          <Line type="monotone" dataKey="expenses" stroke="#f87171" name="Expenses" />
          <Line type="monotone" dataKey="net" stroke="#3b82f6" name="Net Profit" />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-6 text-sm text-slate-700 space-y-1">
        <p>
          <strong>Year-End Profit:</strong>{" "}
          <span className="text-emerald-600 font-semibold">
            £{forecastData.reduce((acc, d) => acc + d.net, 0).toFixed(2)}
          </span>
        </p>
        <p>
          <strong>Break-Even Month:</strong>{" "}
          <span className="text-blue-600 font-medium">
            {forecastData.find((d) => d.net >= 0)?.month || "None"}
          </span>
        </p>
      </div>
    </section>
  );
}
