// pages/reports.js
import React, { useState, useRef, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useReactToPrint } from "react-to-print";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";
import ResponsiveHighchart from "../components/ResponsiveHighchart";

// ✅ HighchartsReact (client-only)
const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
});

export default function Reports() {
  const [hc, setHc] = useState(null);
  const [reports, setReports] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [showTransactions, setShowTransactions] = useState(true);

  const reportRef = useRef();

  const { data: session, status } = useSession();
  const router = useRouter();

  // ✅ Load Highcharts ONLY in the browser
  useEffect(() => {
    import("../lib/highcharts").then((mod) => {
      setHc(mod.default);
    });
  }, []);

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

  const handlePrint = useReactToPrint({
    content: () => reportRef.current,
    documentTitle: "ProfitLens Monthly Report",
  });

  // ✅ Fetch reports
  useEffect(() => {
    if (status !== "authenticated") return;
    const fetchReports = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/reports", { credentials: "include" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to fetch reports");
        setReports(json.reports?.monthly || []);
        setCategories(json.categories || []);
        setClients(json.clients || []);
        setError(null);
      } catch (err) {
        setError(err.message || "Failed to load reports");
        setReports([]);
        setCategories([]);
        setClients([]);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [status]);

  // ✅ Fetch transactions for selected client
  useEffect(() => {
    if (status !== "authenticated") return;
    if (!selectedClient) {
      setTransactions([]);
      return;
    }
    const fetchTx = async () => {
      try {
        const res = await fetch(
          `/api/reports?client=${encodeURIComponent(selectedClient)}`,
          { credentials: "include" }
        );
        const json = await res.json();
        setTransactions(json.transactions || []);
      } catch {
        setTransactions([]);
      }
    };
    fetchTx();
  }, [selectedClient, status]);

  // ✅ Exclusion set
  const excludedCategories = new Set([
    "Asset Disposal",
    "Insurance Payout",
    "Internal Transfer",
    "Returned Direct Debit",
    "Transfer Between Accounts",
  ]);

  // ✅ Available categories
  const availableCategories = useMemo(() => {
    const set = new Set();
    (reports || []).forEach((r) =>
      (r.categories || []).forEach((c) => set.add(c.name))
    );
    return Array.from(set);
  }, [reports]);

  // ✅ Filtered reports
  const filteredReports = useMemo(() => {
    if (!reports?.length) return [];
    if (selectedCategory === "All") return reports;
    return reports.filter((r) =>
      r.transactions?.some((tx) => tx.category === selectedCategory)
    );
  }, [reports, selectedCategory]);

  // ✅ Chart options (time series, stacked, waterfall, sankey, sunburst, heatmap)
  // ... keep your existing useMemo chart option logic here (unchanged)

  return (
    <ResponsiveLayout>
      <h2 className="text-2xl font-bold text-slate-800">Reports</h2>
      <p className="text-slate-600 mt-2">
        Generate detailed reports for your business.
      </p>

      {/* Filters */}
      <div className="mt-6 flex gap-4 flex-wrap items-center">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="border border-slate-300 rounded px-4 py-2 text-sm"
        >
          <option value="All">All Categories</option>
          {availableCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          value={selectedClient}
          onChange={(e) => setSelectedClient(e.target.value)}
          className="border border-slate-300 rounded px-4 py-2 text-sm"
        >
          <option value="">-- All Clients --</option>
          {clients.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <button
          onClick={handlePrint}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition"
        >
          Download PDF
        </button>
      </div>

      {/* Charts */}
      <ResponsiveCard title="Income, expenses, and net profit">
        {!hc || loading ? (
          <p className="text-slate-500">Loading chart...</p>
        ) : !filteredReports.length || !timeSeriesOptions ? (
          <p className="text-slate-500">No data available for chart</p>
        ) : (
          <ResponsiveHighchart highcharts={hc} options={timeSeriesOptions} />
        )}
      </ResponsiveCard>

      <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ResponsiveCard title="Expense categories over time">
          {!hc || !stackedCategoryOptions ? (
            <p className="text-slate-500">No data for category breakdown.</p>
          ) : (
            <ResponsiveHighchart highcharts={hc} options={stackedCategoryOptions} />
          )}
        </ResponsiveCard>

        <ResponsiveCard title="Profit composition (latest period)">
          {!hc || !waterfallOptions ? (
            <p className="text-slate-500">Not enough data for waterfall.</p>
          ) : (
            <ResponsiveHighchart highcharts={hc} options={waterfallOptions} />
          )}
        </ResponsiveCard>
      </div>

      <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ResponsiveCard title="Money flow: Income to categories">
          {!hc || !sankeyOptions ? (
            <p className="text-slate-500">Select a client to show money flow.</p>
          ) : (
            <ResponsiveHighchart highcharts={hc} options={sankeyOptions} />
          )}
        </ResponsiveCard>

        <ResponsiveCard title="Spending hierarchy">
          {!hc || !sunburstOptions ? (
            <p className="text-slate-500">
              Select a client to visualise hierarchical spending.
            </p>
          ) : (
            <ResponsiveHighchart highcharts={hc} options={sunburstOptions} />
          )}
        </ResponsiveCard>
      </div>

      <ResponsiveCard title="Spending intensity by category and period">
        {!hc || !heatmapOptions ? (
          <p className="text-slate-500">Not enough data to generate a heatmap.</p>
        ) : (
          <ResponsiveHighchart highcharts={hc} options={heatmapOptions} />
        )}
      </ResponsiveCard>

      {/* Transactions */}
      {transactions.length > 0 && (
        <ResponsiveCard title="Transactions for selected client">
          <button
            onClick={() => setShowTransactions(!showTransactions)}
            className="text-blue-600 hover:underline text-sm mb-2"
          >
            {showTransactions ? "Hide" : "Show"}
          </button>
          {showTransactions && (
            <ResponsiveTable headers={["Date", "Description", "Category", "Amount"]}>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.date}</td>
                  <td>{tx.description}</td>
                                    <td>{tx.category}</td>
                  <td>£{Number(tx.amount || 0).toFixed(2)}</td>
                </tr>
              ))}
            </ResponsiveTable>
          )}
        </ResponsiveCard>
      )}

      {/* Printable report cards */}
      <div ref={reportRef} className="mt-8 space-y-6">
        {error && (
          <p className="text-red-500">Failed to load report data: {error}</p>
        )}

        {loading && <p className="text-slate-500">Loading reports...</p>}

        {!loading && filteredReports.length === 0 && !error && (
          <p className="text-slate-500">No reports to display</p>
        )}

        {filteredReports.map((report, i) => (
          <ResponsiveCard
            key={`${report.label}-${i}`}
            title={report.label}
          >
            <p className="text-sm text-slate-500 mb-2">
              Revenue: £{report.revenue} · Expenses: £{report.expenses} · Net: £
              {report.net}
            </p>

            <ResponsiveTable headers={["Category", "Amount"]}>
              {(report.categories || []).map((cat, j) => (
                <tr key={`${cat.name}-${j}`}>
                  <td>{cat.name}</td>
                  <td>£{cat.amount}</td>
                </tr>
              ))}
            </ResponsiveTable>

            {report.transactions?.length > 0 && (
              <div className="text-sm text-slate-600 mt-4">
                <h4 className="font-semibold text-slate-700 mb-2">
                  Transactions
                </h4>
                <ResponsiveTable headers={["Date", "Description", "Category", "Amount"]}>
                  {report.transactions.map((tx, k) => (
                    <tr key={`${tx.id}-${k}`}>
                      <td>{tx.date}</td>
                      <td>{tx.description}</td>
                      <td>{tx.category}</td>
                      <td>£{tx.amount}</td>
                    </tr>
                  ))}
                </ResponsiveTable>
              </div>
            )}
          </ResponsiveCard>
        ))}
      </div>
    </ResponsiveLayout>
  );
}
