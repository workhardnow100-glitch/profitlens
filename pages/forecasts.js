// pages/forecasts.js
import React, { useEffect, useState, useMemo } from "react";
import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
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
  const [series, setSeries] = useState({
    months: [],
    revenue: [],
    expenses: [],
    net: [],
  });
  const [error, setError] = useState(null);

  const { data: session, status } = useSession();
  const router = useRouter();

  // ✅ Access control
  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      router.replace("/login");
      return;
    }

    const isAdmin = session.user.role === "admin";
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
      session.user.subscriptionStatus
    );

    if (!(isAdmin || isSubscribedOrTrial)) {
      router.replace("/upgrade");
    }
  }, [session, status, router]);

  // ✅ Fetch forecast data
  useEffect(() => {
    if (!session?.user) return;

    const fetchForecastData = async () => {
      try {
        const res = await fetch("/api/forecasts", {
          credentials: "include",
        });

        const json = await res.json();

        if (!res.ok || json.error) {
          throw new Error(json.error || "Failed to fetch forecast");
        }

        setForecast(json.forecast || []);
        setSeries(
          json.series || { months: [], revenue: [], expenses: [], net: [] }
        );
      } catch (err) {
        setError(err.message || "Failed to load forecast");
      }
    };

    fetchForecastData();
  }, [session]);

  // ✅ Parse projections safely
  const revenueProjection = forecast[0]?.value
    ? parseFloat(String(forecast[0].value).replace(/[£,]/g, "")) || 0
    : 0;

  const expenseProjection = forecast[1]?.value
    ? parseFloat(String(forecast[1].value).replace(/[£,]/g, "")) || 0
    : 0;

  const netProfit = revenueProjection - expenseProjection;

  // ✅ Simulated trends
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
    return revenueTrend.map(
      (r, i) => r - expenseProjection * (1 + i * 0.05)
    );
  }, [revenueTrend, expenseProjection]);

  return (
    <ResponsiveLayout currentPageName="Forecasts">
      <div className="p-8 space-y-8">
        <h2 className="text-3xl font-bold text-slate-900">Forecasts</h2>
        <p className="text-slate-600 mt-1">
          Predict future performance based on historical transaction data.
          Visualize revenue, expenses, and profitability trends.
        </p>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ResponsiveCard title="Revenue Projection">
            <p className="text-2xl font-bold text-green-600">
              £{revenueProjection.toFixed(2)}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Forecast next quarter’s income based on current trends.
            </p>
          </ResponsiveCard>

          <ResponsiveCard title="Expense Forecast">
            <p className="text-2xl font-bold text-red-600">
              £{expenseProjection.toFixed(2)}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Predict monthly costs and cash flow risks.
            </p>
          </ResponsiveCard>

          <ResponsiveCard title="Net Profit Forecast">
            <p
              className={`text-2xl font-bold ${
                netProfit >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              £{netProfit.toFixed(2)}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Projected margin after expenses.
            </p>
          </ResponsiveCard>
        </div>

        {/* Historical data */}
        <ResponsiveCard title="Historical Trends">
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
        </ResponsiveCard>

        {/* Simulated forecasts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ResponsiveCard title="Quarterly Revenue Forecast">
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
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
              }}
            />
          </ResponsiveCard>

          <ResponsiveCard title="Expense Breakdown">
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
              options={{
                responsive: true,
                plugins: { legend: { display: false } },
              }}
            />
          </ResponsiveCard>
        </div>

        {/* Net trend */}
        <ResponsiveCard title="Net Profit Projection">
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
            options={{
              responsive: true,
              plugins: { legend: { display: false } },
            }}
          />
        </ResponsiveCard>

          <ForecastSimulator />

        {error && <p className="text-red-500 mt-4">{error}</p>}

        {/* ✅ In‑App Disclaimer */}
        <p className="text-xs text-slate-500 mt-8 text-center max-w-2xl mx-auto">
          ProfitLens provides estimates only. Always verify figures before filing
          with HMRC. Nothing displayed here constitutes tax, accounting, or legal
          advice.
        </p>

      </div>
    </ResponsiveLayout>
  );
}
