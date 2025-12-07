import React, { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useUser } from "../hooks/useUser";

export default function ForecastSimulator() {
  const { user } = useUser();

  const isUnlocked = ["basic", "pro"].includes(user.subscriptionStatus);

  if (!isUnlocked) {
    return (
      <div className="mt-10 bg-white/70 p-6 rounded-lg border text-center">
        <h3 className="text-xl font-semibold text-slate-800 mb-2">🔒 Forecast Locked</h3>
        <p className="text-slate-600">
          Upgrade to Pro to unlock forecasting and scenario planning tools.
        </p>
      </div>
    );
  }

  const [baseRevenue, setBaseRevenue] = useState(5000);
  const [baseExpenses, setBaseExpenses] = useState(3000);
  const [growthRate, setGrowthRate] = useState(0.05); // 5%

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

  const yearProfit = forecastData.reduce((acc, d) => acc + d.net, 0).toFixed(2);
  const breakEvenMonth = forecastData.find((d) => d.net >= 0)?.month || "None";

  return (
    <div className="mt-10 bg-white/70 p-6 rounded-lg border">
      <h3 className="text-xl font-semibold text-slate-800 mb-4">Forecast Mode</h3>
      <p className="text-slate-600 mb-6">
        Simulate future performance by adjusting revenue, expenses, and growth rate.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Monthly Revenue (£)
          </label>
          <input
            type="number"
            value={baseRevenue}
            onChange={(e) => setBaseRevenue(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Monthly Expenses (£)
          </label>
          <input
            type="number"
            value={baseExpenses}
            onChange={(e) => setBaseExpenses(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Growth Rate (%)
          </label>
          <input
            type="number"
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
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="revenue" stroke="#4ade80" name="Revenue" />
          <Line type="monotone" dataKey="expenses" stroke="#f87171" name="Expenses" />
          <Line type="monotone" dataKey="net" stroke="#3b82f6" name="Net Profit" />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-6 text-sm text-slate-700 space-y-1">
        <p>
          <strong>Year-End Profit:</strong>{" "}
          <span className="text-emerald-600 font-semibold">£{yearProfit}</span>
        </p>
        <p>
          <strong>Break-Even Month:</strong>{" "}
          <span className="text-blue-600 font-medium">{breakEvenMonth}</span>
        </p>
      </div>
    </div>
  );
}
