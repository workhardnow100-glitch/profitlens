import React, { useEffect, useState, useMemo } from "react";
import Layout from "../components/layout.jsx";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

const HighchartsReact = dynamic(() => import("highcharts-react-official"), { ssr: false });
const COLORS = ["#2563eb","#10b981","#f59e0b","#ef4444","#8b5cf6","#14b8a6","#f43f5e"];

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
    // ✅ include trialing in allowed statuses
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(session.user.subscriptionStatus);
    if (!(isAdmin || isSubscribedOrTrial)) {
      router.replace("/upgrade");
    }
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
            const signedRes = await fetch(`/api/signed-url?path=${encodeURIComponent(r.storagePath)}`);
            const signed = await signedRes.json();
            if (signed?.url) urls[r.storagePath] = signed.url;
          }
        }
        setSignedUrls(urls);
      } catch (e) {
        setError(e.message || "Failed to load dashboard");
      } finally { setLoading(false); }
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
          setHighcharts(HC.default || HC);
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
      plotOptions: { pie: { innerSize: 100, depth: 45, dataLabels: { enabled: true, format: "{point.name}: £{point.y:.2f}" } } },
      series: [{
        name: "Total",
        data: [
          { name: "Income", y: series.revenue.reduce((a,b)=>a+b,0), drilldown:"Income" },
          { name: "Expenses", y: series.expenses.reduce((a,b)=>a+b,0), drilldown:"Expenses" }
        ]
      }],
      drilldown: {
        series: [
          {
            id:"Income",
            name:"Income by Category",
            colorByPoint:true,
            data:Object.entries(recent.filter(tx=>tx.amount>0).reduce((acc,tx)=>{const cat=tx.category; acc[cat]=(acc[cat]||0)+tx.amount; return acc;},{})).map(([cat,total])=>({name:cat,y:total,drilldown:cat}))
          },
          ...Object.entries(recent.filter(tx=>tx.amount>0).reduce((acc,tx)=>{const cat=tx.category; if(!acc[cat])acc[cat]=[]; acc[cat].push([`${tx.description||"Unknown"} (${new Date(tx.date).toLocaleDateString()})`,tx.amount]); return acc;},{})).map(([cat,transactions])=>({id:cat,name:`${cat} Transactions`,data:transactions})),
          { id:"Expenses", data:Object.entries(breakdown).map(([name,value])=>[name,value]) }
        ]
      }
    };
  }, [hcReady, Highcharts, series, breakdown, recent]);

  const chartData = series.months.map((month,i)=>({month,revenue:series.revenue[i],expenses:series.expenses[i]}));
  const pieData = Object.entries(breakdown).map(([name,value])=>({name,value:+value.toFixed(2)}));

  return (
    <Layout currentPageName="Dashboard">
      <div className="p-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-slate-600 mt-2">Welcome {session?.user?.role==="admin"?"Founder":"Client"} — this is your cockpit.</p>

        {error && <p className="text-red-600 mt-4">{error}</p>}
        {loading && <p className="text-slate-500 mt-4">Loading...</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          {stats.map(s=>(
            <div key={s.label} className="rounded-lg border bg-white/70 p-4">
              <div className="text-slate-500">{s.label}</div>
              <div className="text-2xl font-bold">£{s.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 mb-8">
          {hcReady && Highcharts && chartOptions ? <HighchartsReact highcharts={Highcharts} options={chartOptions}/> : <p className="text-slate-500">Preparing chart...</p>}
        </div>

        {chartData.length>0 && (
          <div className="mt-10">
            <h2 className="text-lg font-semibold mb-2">Monthly Trends</h2>
            <div className="bg-white/70 p-4 rounded-lg border">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <XAxis dataKey="month"/>
                  <YAxis/>
                  <Tooltip/>
                  <Legend/>
                  <Line type="monotone" dataKey="revenue" stroke="#4ade80" name="Revenue"/>
                  <Line type="monotone" dataKey="expenses" stroke="#f87171" name="Expenses"/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-2">Expense Breakdown by Category</h2>
          <div className="bg-white/70 p-4 rounded-lg border">
            {pieData.length>0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                    {pieData.map((entry,index)=><Cell key={`cell-${index}`} fill={COLORS[index%COLORS.length]}/>)}
                  </Pie>
                  <Tooltip/>
                  <Legend/>
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-slate-500">No category data available yet. Try uploading a statement with expenses.</p>}
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-2">Statements</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full border rounded bg-white/70">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-2 border">Date</th>
                  <th className="p-2 border">Description</th>
                  <th className="p-2 border">Amount</th>
                  <th className="p-2 border">Category</th>
                  <th className="p-2 border">File</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(r=>(
                  <tr key={r.id}>
                    <td className="p-2 border">{r.date}</td>
                    <td className="p-2 border">{r.description||r.filename}</td>
                    <td className="p-2 border">£{r.amount}</td>
                    <td className="p-2 border">
                      <select
                        value={r.category}
                        onChange={async (e) => {
                          const newCategory = e.target.value;
                          try {
                            const res = await fetch("/api/dashboard", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: r.id, category: newCategory }),
                            });
                            if (!res.ok) throw new Error("Failed to update category");
                            setRecent(prev =>
                              prev.map(tx => tx.id === r.id ? { ...tx, category: newCategory } : tx)
                            );
                          } catch (err) {
                            alert(err.message || "Failed to update category");
                          }
                        }}
                        className="border rounded px-2 py-1"
                      >
                        {categories.map(cat=>(
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 border">
                      {r.storagePath && signedUrls[r.storagePath] && <a href={signedUrls[r.storagePath]} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">View</a>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={nuke} className="mt-6 px-4 py-2 bg-red-600 text-white rounded-lg shadow hover:bg-red-700">Delete All Statements</button>
        </div>
      </div>
    </Layout>
  );
}
