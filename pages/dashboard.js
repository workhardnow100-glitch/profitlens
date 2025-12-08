import React, { useEffect, useState, useMemo } from "react";
import Layout from "../components/layout.jsx";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

// 🎯 Highcharts
const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
});

const COLORS = [
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#f43f5e",
];

// ⬇️ Enhanced Inference Logic
function inferCategory(description = "") {
  const desc = description.toLowerCase();
  if (desc.includes("salary") || desc.includes("payroll")) return "Salary";
  if (desc.includes("hmrc") || desc.includes("tax")) return "Tax Payment";
  if (desc.includes("jaja") || desc.includes("credit")) return "Credit Card Payment";
  if (desc.includes("tesco") || desc.includes("sainsbury") || desc.includes("aldi")) return "Groceries";
  if (desc.includes("uber") || desc.includes("trainline") || desc.includes("tfl")) return "Transport";
  if (desc.includes("spotify") || desc.includes("netflix") || desc.includes("prime")) return "Subscriptions";
  if (desc.includes("notemachine") || desc.includes("atm")) return "Cash Withdrawal";
  if (desc.includes("ig.com") || desc.includes("trading") || desc.includes("etoro")) return "Investment Purchase";
  if (desc.includes("easyjet") || desc.includes("ryanair") || desc.includes("jet2")) return "Travel";
  if (desc.includes("sheehy")) return "Family";
  if (desc.includes("drafty") || desc.includes("loan")) return "Loan Received";
  if (desc.includes("bingo") || desc.includes("casino") || desc.includes("bet")) return "Gambling";
  if (desc.includes("savethechange")) return "Savings Deposit";
  if (desc.includes("returned dd") || desc.includes("rddp")) return "Returned Direct Debit";
  if (desc.includes("nhs") || desc.includes("clinic") || desc.includes("dentist")) return "Healthcare";
  if (desc.includes("school") || desc.includes("tuition")) return "Education";
  if (desc.includes("childcare") || desc.includes("nursery")) return "Childcare";
  if (desc.includes("council") || desc.includes("local authority")) return "Council Tax";
  if (desc.includes("insurance")) return "Insurance Premium";
  if (desc.includes("rent")) return "Rent";
  if (desc.includes("mortgage")) return "Mortgage";
  if (desc.includes("utilities") || desc.includes("gas") || desc.includes("electric")) return "Utilities";
  if (desc.includes("mobile") || desc.includes("vodafone") || desc.includes("o2")) return "Mobile & Internet";
  if (desc.includes("restaurant") || desc.includes("takeaway") || desc.includes("just eat")) return "Dining & Takeaway";
  if (desc.includes("amazon") || desc.includes("argos") || desc.includes("shopping")) return "Shopping";
  if (desc.includes("charity") || desc.includes("donation")) return "Charity";
  if (desc.includes("gift")) return "Gift";
  if (desc.includes("overdraft")) return "Overdraft Repayment";
  if (desc.includes("standing order")) return "Standing Order";
  if (desc.includes("direct debit")) return "Direct Debit";
  if (desc.includes("transfer")) return "Transfer Between Accounts";
  return "Uncategorised";
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [stats, setStats] = useState([]);
  const [series, setSeries] = useState({ months: [], revenue: [], expenses: [] });
  const [recent, setRecent] = useState([]);
  const [signedUrls, setSignedUrls] = useState({});
  const [breakdown, setBreakdown] = useState({});
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [Highcharts, setHighcharts] = useState(null);
  const [hcReady, setHcReady] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    if (session?.user) {
      const isAdmin = session.user.role === "admin";
      const isSubscribed = ["basic", "pro"].includes(session.user.subscriptionStatus);
      if (!(isAdmin || isSubscribed)) router.replace("/upgrade");
    } else {
      router.replace("/login");
    }
  }, [session, status, router]);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) throw new Error("Failed to load dashboard");
        const data = await res.json();

        setStats(data.stats || []);
        setSeries(data.series || { months: [], revenue: [], expenses: [] });
        setRecent(data.recent || []);
        setBreakdown(data.breakdown || {});
        setCategories(data.categories || []);

        const urls = {};
        for (const r of data.recent || []) {
          if (r.storagePath) {
            const signedRes = await fetch(
              `/api/signed-url?path=${encodeURIComponent(r.storagePath)}`
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
    if (!confirm("Are you sure you want to delete all your statements?")) return;
    const res = await fetch("/api/dashboard", { method: "DELETE" });
    if (res.ok) window.location.reload();
    else alert("Failed to delete statements");
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    import("highcharts/highcharts-3d").then(() => {
      import("highcharts/modules/drilldown").then(() => {
        import("highcharts").then((HC) => {
          const H = HC.default || HC;
          setHighcharts(H);
          setHcReady(true);
        });
      });
    });
  }, []);

  const chartOptions = useMemo(() => {
    if (!hcReady || !Highcharts) return null;
    return {
      chart: { type: "pie", options3d: { enabled: true, alpha: 45, beta: 0 } },
      title: { text: "Income vs Expenses (3D Doughnut)" },
      plotOptions: {
        pie: {
          innerSize: 100,
          depth: 45,
          dataLabels: { enabled: true, format: "{point.name}: £{point.y:.2f}" },
        },
      },
      series: [
        {
          name: "Total",
          data: [
            { name: "Income", y: series.revenue.reduce((a, b) => a + b, 0), drilldown: "Income" },
            { name: "Expenses", y: series.expenses.reduce((a, b) => a + b, 0), drilldown: "Expenses" },
          ],
        },
      ],
      drilldown: {
        series: [
          {
            id: "Income",
            name: "Income by Category",
            colorByPoint: true,
            data: Object.entries(
              recent.filter((tx) => tx.amount > 0).reduce((acc, tx) => {
                const cat = inferCategory(tx.description);
                acc[cat] = (acc[cat] || 0) + tx.amount;
                return acc;
              }, {})
            ).map(([cat, total]) => ({ name: cat, y: total, drilldown: cat })),
          },
          {
            id: "Expenses",
            name: "Expenses by Category",
            colorByPoint: true,
            data: Object.entries(breakdown).map(([name, value]) => [name, value]),
          },
        ],
      },
    };
  }, [hcReady, Highcharts, series, breakdown, recent]);

  const chartData = series.months.map((month, i) => ({
    month,
    revenue: series.revenue[i],
    expenses: series.expenses[i],
  }));

const pieData = Object.entries(breakdown).map(([name, value]) => ({
  name: name,
  value: Number(value.toFixed(2)),
}));


  return (
    <Layout currentPageName="Dashboard">
      <div className="p-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-slate-600 mt-2">
          Welcome {session?.user?.role === "admin" ? "Founder" : "Client"} — this is your cockpit.
        </p>

        {error && <p className="text-red-600 mt-4">Error: {error}</p>}
        {loading && <p className="text-slate-500 mt-4">Loading...</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border bg-white/70 p-4">
              <div className="text-slate-500">{s.label}</div>
              <div className="text-2xl font-bold">£{s.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 mb-8">
          {hcReady && Highcharts && chartOptions ? (
            <HighchartsReact highcharts={Highcharts} options={chartOptions} />
          ) : (
            <p className="text-slate-500">Preparing chart...</p>
          )}
        </div>

        {chartData.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold mb-2">Monthly Trends</h2>
            <div className="bg-white/70 p-4 rounded-lg border">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#4ade80" name="Revenue" />
                  <Line type="monotone" dataKey="expenses" stroke="#f87171" name="Expenses" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">Recent Uploads</h2>
          <ul className="space-y-4">
            {recent.map((r) => (
              <li key={r.id} className="border rounded p-4 bg-white/70">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-semibold">{r.description || r.filename}</div>
                    <div className="text-sm text-slate-500">{r.date}</div>
                    <div className="text-sm">£{r.amount}</div>

                    {/* 🔽 Dropdown for category */}
                    <div className="text-sm text-slate-600 mt-1">
                      <label className="mr-2">Category:</label>
                      <select
                        value={r.category || inferCategory(r.description)}
                        onChange={(e) => {
                          // TODO: call API to update category for this transaction
                          console.log("Update category", r.id, e.target.value);
                        }}
                        className="border rounded px-2 py-1"
                      >
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

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
                </div>
              </li>
            ))}
          </ul>

          <button
            onClick={nuke}
            className="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700"
          >
            Delete All Statements
          </button>
        </div>
      </div>
    </Layout>
  );
}
