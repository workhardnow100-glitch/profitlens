// pages/forecasts.js
import React, { useEffect, useState, useMemo } from "react";
import Layout from "../components/layout";
import ForecastSimulator from "../components/ForecastSimulator";
import {
  Chart as ChartJS,
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line, Bar } from "react-chartjs-2";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

ChartJS.register(
  LineElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler
);

export default function Forecasts() {
  const [forecast, setForecast] = useState([]);
  const [series, setSeries] = useState({ months: [], revenue: [], expenses: [], net: [] });
  const [error, setError] = useState(null);

  const { data: session, status } = useSession();
  const router = useRouter();

  // 🔑 Access check
  useEffect(() => {
    if (status === "loading") return;

    if (session?.user) {
      const isAdmin = session.user.role === "admin";
      const isSubscribed = ["basic", "pro"].includes(session.user.subscriptionStatus);

      if (!(isAdmin || isSubscribed)) {
        router.replace("/upgrade");
      }
    } else {
      router.replace("/login");
    }
  }, [session, status, router]);

  useEffect(() => {
    const fetchForecastData = async () => {
      try {
        const res = await fetch("/api/forecasts");
        const json = await res.json();

        if (!res.ok) throw new Error(json.error || "Failed to fetch forecast");

        setForecast(json.forecast || []);
        setSeries(json.series || { months: [], revenue: [], expenses: [], net: [] });
      } catch (err) {
        setError(err.message);
      }
    };

    if (session?.user) {
      fetchForecastData();
    }
  }, [session]);

  const revenueProjection = forecast[0]?.value
    ? parseFloat(forecast[0].value.replace("£", "")) || 0
    : 0;

  const expenseProjection = forecast[1]?.value
    ? parseFloat(forecast[1].value.replace("£", "")) || 0
    : 0;

  const netProfit = revenueProjection - expenseProjection;

  // Simulation trends (heuristic projections)
  const revenueTrend = useMemo(() => {
    const base = revenueProjection;
    return [base * 0.9, base, base * 1.1, base * 1.2];
  }, [revenueProjection]);

  const expenseBreakdown = useMemo(() => {
    const ops = expenseProjection * 0.3;
    const payroll = expenseProjection * 0.4;
    const marketing = expenseProjection * 0.2;
    const tools = expenseProjection * 0.1;
    return [ops, payroll, marketing, tools];
  }, [expenseProjection]);

  const netTrend = useMemo(() => {
    return revenueTrend.map((r, i) => r - expenseProjection * (1 + i * 0.05));
  }, [revenueTrend, expenseProjection]);

  return (
    <Layout currentPageName="Forecasts">
      <div className="p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Forecasts</h2>
            <p className="text-slate-600 mt-1">
              Predict future performance based on historical transaction data. Visualize revenue, expenses, and profitability trends.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ForecastCard
            title="Revenue Projection"
            value={`£${revenueProjection.toFixed(2)}`}
            description="Forecast next quarter’s income based on current trends."
            color="text-green-600"
          />
          <ForecastCard
            title="Expense Forecast"
            value={`£${expenseProjection.toFixed(2)}`}
            description="Predict monthly costs and cash flow risks."
            color="text-red-600"
          />
          <ForecastCard
            title="Net Profit Forecast"
            value={`£${netProfit.toFixed(2)}`}
            description="Projected margin after expenses."
            color={netProfit >= 0 ? "text-green-600" : "text-red-600"}
          />
        </div>

        {/* Historical data from API */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Historical Trends</h3>
          <Line
            data={{
              labels: series.months,
              datasets: [
                {
                  label: "Revenue",
                  data: series.revenue,
                  borderColor: "#22C55E",
                  backgroundColor: "#22C55E33",
                  fill: true,
                  tension: 0.4,
                },
                {
                  label: "Expenses",
                  data: series.expenses,
                  borderColor: "#EF4444",
                  backgroundColor: "#EF444433",
                  fill: true,
                  tension: 0.4,
                },
                {
                  label: "Net Profit",
                  data: series.net,
                  borderColor: "#6366F1",
                  backgroundColor: "#6366F133",
                  fill: true,
                  tension: 0.4,
                },
              ],
            }}
            options={{ responsive: true }}
          />
        </div>

        {/* Simulated forecasts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Quarterly Revenue Forecast</h3>
            <Line
              data={{
                labels: ["Q1", "Q2", "Q3", "Q4"],
                datasets: [
                  {
                    label: "Revenue Projection",
                    data: revenueTrend,
                    borderColor: "#22C55E",
                    backgroundColor: "#22C55E33",
                    fill: true,
                    tension: 0.4,
                  },
                ],
              }}
              options={{ responsive: true, plugins: { legend: { display: false } } }}
            />
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Expense Breakdown</h3>
            <Bar
              data={{
                labels: ["Ops", "Payroll", "Marketing", "Tools"],
                datasets: [
                  {
                    label: "Expenses Breakdown",
                    data: expenseBreakdown,
                    backgroundColor: "#EF4444CC",
                    borderRadius: 6,
                  },
                ],
              }}
              options={{ responsive: true, plugins: { legend: { display: false } } }}
            />
          </div>
        </div>

        {/* Simulated net trend */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Net Profit Projection</h3>
          <Line
            data={{
              labels: ["Q1", "Q2", "Q3", "Q4"],
              datasets: [
                {
                  label: "Projected Net Profit",
                  data: netTrend,
                  borderColor: "#6366F1",
                  backgroundColor: "#6366F133",
                  fill: true,
                  tension: 0.4,
                },
              ],
            }}
            options={{ responsive: true, plugins: { legend: { display: false } } }}
          />
        </div>

        <ForecastSimulator />

        {error && <p className="text-red-500 mt-4">{error}</p>}
      </div>
    </Layout>
  );
}

function ForecastCard({ title, value, description, color }) {
  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
      <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      <p className="text-sm text-slate-500 mt-2">{description}</p>
    </div>
  );
}
