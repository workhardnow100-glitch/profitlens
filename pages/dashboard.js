// pages/dashboard.js
import React, { useEffect, useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";
import ResponsiveChart from "../components/ResponsiveChart";
import ResponsiveHighchart from "../components/ResponsiveHighchart";

// ✅ Accountant access
import { AccountantAccessPanel } from "../components/AccountantAccessPanel";

// ✅ Route guard
import { useRouteGuard } from "../hooks/useRouteGuard";

// ✅ CT_MAP + system categories: single source of truth for ALL dropdowns
import { CT_MAP } from "../lib/constants/ctMap";
import { SYSTEM_CATEGORIES } from "../lib/constants/systemCategories";

// ✅ Unified category options (CT_MAP + system + Uncategorised)
const CT_CATEGORY_OPTIONS = Array.from(
  new Set([
    ...CT_MAP.income,
    ...CT_MAP.allowable,
    ...CT_MAP.disallowable,
    ...CT_MAP.ignore,
    ...SYSTEM_CATEGORIES,
    "Uncategorised",
  ])
).sort();

const HighchartsReact = dynamic(
  () => import("highcharts-react-official"),
  { ssr: false }
);

export default function Dashboard() {
  // ✅ Apply route guard
  useRouteGuard();

  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState([]);
  const [series, setSeries] = useState({
    months: [],
    revenue: [],
    expenses: [],
  });
  const [recent, setRecent] = useState([]);
  const [signedUrls, setSignedUrls] = useState({});
  const [breakdown, setBreakdown] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [Highcharts, setHighcharts] = useState(null);
  const [hcReady, setHcReady] = useState(false);

  // 🔑 Access control (subscription)
  useEffect(() => {
    if (status === "loading") return;
    if (session?.user) {
      const isAdmin = session.user.role === "admin";
      const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
        session.user.subscriptionStatus
      );
      if (!(isAdmin || isSubscribedOrTrial)) {
        router.replace("/upgrade");
      }
    } else {
      router.replace("/login");
    }
  }, [session, status, router]);

  // 📊 Fetch dashboard data
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch("/api/dashboard", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load dashboard");
        const data = await res.json();

        setStats(data.stats || []);
        setSeries(
          data.series || { months: [], revenue: [], expenses: [] }
        );
        // ✅ recent entries already carry `category` derived from business_category
        setRecent(data.recent || []);
        // ✅ breakdown keys are business_category values — aligned with CT_MAP
        setBreakdown(data.breakdown || {});

        const urls = {};
        for (const r of data.recent || []) {
          if (r.storagePath) {
            const signedRes = await fetch(
              `/api/signed-url?path=${encodeURIComponent(
                r.storagePath
              )}`,
              { credentials: "include" }
            );
            const signed = await signedRes.json();
            if (signed?.url) urls[r.storagePath] = signed.url;
          }
        }
        setSignedUrls(urls);
      } catch (e) {
        setError(e.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    if (session?.user) fetchDashboard();
  }, [session]);

  async function nuke() {
    if (!confirm("Are you sure you want to delete all your statements?"))
      return;
    const res = await fetch("/api/dashboard", {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) window.location.reload();
    else alert("Failed to delete statements");
  }

  // 📈 Load Highcharts with drilldown + 3D
  useEffect(() => {
    if (typeof window === "undefined") return;
    (async () => {
      try {
        const HC = await import("highcharts");
        const HighchartsCore = HC.default || HC;

        const [hc3d, drilldown] = await Promise.all([
          import("highcharts/highcharts-3d"),
          import("highcharts/modules/drilldown"),
        ]);

        if (typeof hc3d === "function") hc3d(HighchartsCore);
        if (typeof drilldown === "function") drilldown(HighchartsCore);

        setHighcharts(HighchartsCore);
        setHcReady(true);
      } catch (err) {
        console.error("Failed to load Highcharts modules:", err);
      }
    })();
  }, []);

  const chartData = series.months.map((month, i) => ({
    month,
    revenue: series.revenue[i],
    expenses: series.expenses[i],
  }));

  // ✅ Income vs Expenses 3D doughnut
  const incomeVsExpensesOptions = useMemo(() => {
    if (!hcReady || !Highcharts) return null;
    const totalRevenue = (series.revenue || []).reduce((a, b) => a + b, 0);
    const totalExpenses = (series.expenses || []).reduce((a, b) => a + b, 0);

    return {
      chart: {
        type: "pie",
        options3d: { enabled: true, alpha: 45, beta: 0 },
      },
      title: { text: "Income vs Expenses (3D Doughnut)" },
      plotOptions: {
        pie: {
          innerSize: 100,
          depth: 45,
          dataLabels: {
            enabled: true,
            format: "{point.name}: £{point.y:.2f}",
          },
        },
      },
      series: [
        {
          name: "Total",
          data: [
            { name: "Income", y: totalRevenue, drilldown: "Income" },
            { name: "Expenses", y: totalExpenses, drilldown: "Expenses" },
          ],
        },
      ],
      drilldown: {
        series: [
          {
            id: "Expenses",
            name: "Expenses",
            data: Object.entries(breakdown).map(
              ([name, value]) => [name, Number(value)]
            ),
          },
        ],
      },
      credits: { enabled: false },
    };
  }, [hcReady, Highcharts, series, breakdown]);

  // ✅ Expense Breakdown Drilldown
  const expenseDrilldownOptions = useMemo(() => {
    if (!hcReady || !Highcharts) return null;
    const entries = Object.entries(breakdown || {});
    if (!entries.length) return null;

    const totalExpenses = entries.reduce(
      (sum, [, value]) => sum + Number(value || 0),
      0
    );

    return {
      chart: { type: "column" },
      title: { text: "Expenses by Category (Drilldown)" },
      xAxis: { type: "category" },
      legend: { enabled: false },
      plotOptions: {
        series: {
          borderWidth: 0,
          dataLabels: { enabled: true, format: "£{point.y:.2f}" },
        },
      },
      tooltip: {
        headerFormat:
          '<span style="font-size:11px">{series.name}</span><br>',
        pointFormat:
          '<span style="color:{point.color}">{point.name}</span>: <b>£{point.y:.2f}</b><br/>',
      },
      series: [
        {
          name: "Expenses",
          colorByPoint: true,
          data: [
            {
              name: "Total Expenses",
              y: totalExpenses,
              drilldown: "expenseBreakdown",
            },
          ],
        },
      ],
      drilldown: {
        series: [
          {
            id: "expenseBreakdown",
            name: "Expense Breakdown",
            data: entries.map(([name, value]) => [
              name,
              Number(value || 0),
            ]),
          },
        ],
      },
      credits: { enabled: false },
    };
  }, [hcReady, Highcharts, breakdown]);

  return (
    <ResponsiveLayout>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-slate-600 mt-2">
        Welcome {session?.user?.role === "admin" ? "Founder" : "Client"} — this
        is your cockpit.
      </p>

      {error && <p className="text-red-600 mt-4">{error}</p>}
      {loading && <p className="text-slate-500 mt-4">Loading...</p>}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        {stats.map((s) => (
          <ResponsiveCard key={s.label}>
            <div className="text-slate-500">{s.label}</div>
            <div className="text-2xl font-bold">£{s.value}</div>
          </ResponsiveCard>
        ))}
      </div>

      {/* Income vs Expenses */}
      <ResponsiveCard title="Income vs Expenses">
        {!hcReady || !Highcharts || !incomeVsExpensesOptions ? (
          <p className="text-slate-500">Preparing chart...</p>
        ) : (
          <ResponsiveHighchart
            highcharts={Highcharts}
            options={incomeVsExpensesOptions}
          />
        )}
      </ResponsiveCard>

      {/* Monthly Trends */}
      {chartData.length > 0 && (
        <ResponsiveCard title="Monthly Trends">
          <ResponsiveChart height={300}>
            <LineChart data={chartData}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#4ade80" />
              <Line type="monotone" dataKey="expenses" stroke="#f87171" />
            </LineChart>
          </ResponsiveChart>
        </ResponsiveCard>
      )}

      {/* Expense Breakdown */}
      <ResponsiveCard title="Expense Breakdown by Category">
        {!hcReady || !Highcharts ? (
          <p className="text-slate-500">Preparing chart...</p>
        ) : !expenseDrilldownOptions ? (
          <p className="text-slate-500">
            No category data available yet. Try uploading a statement with
            expenses.
          </p>
        ) : (
          <ResponsiveHighchart
            highcharts={Highcharts}
            options={expenseDrilldownOptions}
          />
        )}
      </ResponsiveCard>

      {/* Statements table */}
      <ResponsiveCard title="Statements">
        <ResponsiveTable
          headers={["Date", "Description", "Amount", "Category", "File"]}
        >
          {recent.map((r) => (
            <tr key={r.id}>
              <td className="p-2 border">{r.date}</td>
              <td className="p-2 border">{r.description || r.filename}</td>
              <td className="p-2 border">£{r.amount}</td>
              <td className="p-2 border">
                <select
                  value={r.category}
                  onChange={async (e) => {
                    const newCategory = e.target.value;
                    try {
                      const res = await fetch("/api/dashboard", {
                        method: "PATCH",
                        credentials: "include",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          id: r.id,
                          category: newCategory,
                        }),
                      });
                      if (!res.ok)
                        throw new Error("Failed to update category");
                      setRecent((prev) =>
                        prev.map((tx) =>
                          tx.id === r.id
                            ? { ...tx, category: newCategory }
                            : tx
                        )
                      );
                    } catch (err) {
                      alert(err.message || "Failed to update category");
                    }
                  }}
                  className="border rounded px-2 py-1"
                >
                  {CT_CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </td>
              <td className="p-2 border">
                {r.storagePath && signedUrls[r.storagePath] && (
                  <a
                    href={signedUrls[r.storagePath]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    View
                  </a>
                )}
              </td>
            </tr>
          ))}
        </ResponsiveTable>

        <button
          onClick={nuke}
          className="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700"
        >
          Delete All Statements
        </button>
      </ResponsiveCard>

      {/* ✅ Accountant Access Panel */}
      <AccountantAccessPanel />

      {/* ✅ In‑App Disclaimer */}
      <p className="text-xs text-slate-500 mt-8 text-center max-w-2xl mx-auto">
        ProfitLens provides estimates only. Always verify figures before filing
        with HMRC. Nothing displayed here constitutes tax, accounting, or legal
        advice.
      </p>
    </ResponsiveLayout>
  );
}
