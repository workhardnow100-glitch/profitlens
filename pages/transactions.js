import React, { useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import Layout from "../components/layout";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

// ⬇️ Inference logic (expanded UK-specific categories)
function inferCategory(description = "") {
  const desc = description.toLowerCase();

  // Income
  if (desc.includes("salary") || desc.includes("payroll") || desc.includes("wages")) return "Salary";
  if (desc.includes("dividend")) return "Dividends";
  if (desc.includes("interest")) return "Interest Income";
  if (desc.includes("rental")) return "Rental Income";
  if (desc.includes("grant")) return "Grant";
  if (desc.includes("refund")) return "Refund";
  if (desc.includes("rebate")) return "Rebate";
  if (desc.includes("pension")) return "Pension";
  if (desc.includes("benefit")) return "Benefits";
  if (desc.includes("loan received") || desc.includes("drafty") || desc.includes("loan disbursement")) return "Loan Received";

  // Tax
  if (desc.includes("hmrc") || desc.includes("tax")) return "Tax Payment";

  // Savings & Transfers
  if (desc.includes("savethechange")) return "Savings Deposit";
  if (desc.includes("transfer")) return "Transfer Between Accounts";
  if (desc.includes("standing order")) return "Standing Order";
  if (desc.includes("direct debit") || desc.includes("dd")) return "Direct Debit";
  if (desc.includes("returned dd") || desc.includes("rddp")) return "Returned Direct Debit";

  // Credit & Loans
  if (desc.includes("jaja") || desc.includes("zable") || desc.includes("credit")) return "Credit Card Payment";
  if (desc.includes("loan repayment") || desc.includes("zopa") || desc.includes("drafty repayment")) return "Loan Repayment";
  if (desc.includes("overdraft")) return "Overdraft Repayment";
  if (desc.includes("car finance") || desc.includes("vehicle loan")) return "Car Loan Repayment";

  // Bills & Utilities
  if (desc.includes("council") || desc.includes("local authority")) return "Council Tax";
  if (desc.includes("insurance")) return "Insurance Premium";
  if (desc.includes("mortgage")) return "Mortgage";
  if (desc.includes("rent")) return "Rent";
  if (desc.includes("utilities") || desc.includes("gas") || desc.includes("electric") || desc.includes("severn trent")) return "Utilities";
  if (desc.includes("mobile") || desc.includes("vodafone") || desc.includes("o2") || desc.includes("giffgaff") || desc.includes("internet")) return "Mobile & Internet";

  // Shopping & Subscriptions
  if (desc.includes("amazon") || desc.includes("argos") || desc.includes("shopping")) return "Shopping";
  if (desc.includes("spotify") || desc.includes("netflix") || desc.includes("prime") || desc.includes("disney") || desc.includes("apple")) return "Subscriptions";
  if (desc.includes("tesco") || desc.includes("sainsbury") || desc.includes("aldi") || desc.includes("asda") || desc.includes("lidl")) return "Groceries";

  // Food & Transport
  if (desc.includes("uber") || desc.includes("trainline") || desc.includes("tfl") || desc.includes("stagecoach") || desc.includes("national express")) return "Transport";
  if (desc.includes("fuel") || desc.includes("shell") || desc.includes("bp") || desc.includes("esso")) return "Fuel";
  if (desc.includes("restaurant") || desc.includes("takeaway") || desc.includes("just eat") || desc.includes("deliveroo") || desc.includes("ubereats")) return "Dining & Takeaway";

  // Healthcare & Education
  if (desc.includes("nhs") || desc.includes("clinic") || desc.includes("dentist") || desc.includes("optical") || desc.includes("boots")) return "Healthcare";
  if (desc.includes("school") || desc.includes("tuition") || desc.includes("course") || desc.includes("exam")) return "Education";
  if (desc.includes("childcare") || desc.includes("nursery") || desc.includes("kids club")) return "Childcare";

  // Miscellaneous
  if (desc.includes("charity") || desc.includes("donation")) return "Charity";
  if (desc.includes("gift")) return "Gift";
  if (desc.includes("notemachine") || desc.includes("atm")) return "Cash Withdrawal";
  if (desc.includes("bingo") || desc.includes("casino") || desc.includes("bet")) return "Gambling";
  if (desc.includes("easyjet") || desc.includes("ryanair") || desc.includes("jet2") || desc.includes("airbnb") || desc.includes("booking.com")) return "Travel";
  if (desc.includes("ig.com") || desc.includes("trading") || desc.includes("etoro") || desc.includes("shares")) return "Investment Purchase";

  // Catch-all
  if (desc.includes("sheehy")) return "Family";

  return "Uncategorised";
}

// ⬇️ Date safety
function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// ⬇️ Highcharts (client-only)
const HighchartsReact = dynamic(() => import("highcharts-react-official"), { ssr: false });

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Transactions() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [period, setPeriod] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [Highcharts, setHighcharts] = useState(null);
  const [hcReady, setHcReady] = useState(false);

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
    let mounted = true;
    if (typeof window === "undefined") return;
    import("highcharts").then((HC) => {
      const H = HC.default || HC;
      Promise.all([
        import("highcharts/highcharts-3d"),
        import("highcharts/modules/drilldown"),
        import("highcharts/modules/exporting"),
      ])
        .then(([hc3d, drilldown, exporting]) => {
          if (typeof hc3d === "function") hc3d(H);
          if (typeof drilldown === "function") drilldown(H);
          if (typeof exporting === "function") exporting(H);
          if (mounted) {
            setHighcharts(H);
            setHcReady(true);
          }
        })
        .catch((err) => console.error("Failed to load Highcharts modules:", err));
    });
    return () => { mounted = false; };
  }, []);

  const { data, error } = useSWR("/api/transactions", fetcher);

  const filtered = useMemo(() => {
    if (!data?.transactions) return [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return data.transactions.filter((tx) => {
      const date = safeDate(tx.date);
      if (!date) return false;
      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      if (period === "week") {
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        return d >= weekAgo && d <= today;
      }
      if (period === "month") {
        return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      }
      if (period === "quarter") {
        const currentQuarter = Math.floor(today.getMonth() / 3);
        return Math.floor(d.getMonth() / 3) === currentQuarter && d.getFullYear() === today.getFullYear();
      }
      if (period === "year") return d.getFullYear() === today.getFullYear();

      if (period === "last7") {
        const start = new Date(today); start.setDate(today.getDate() - 6);
        return d >= start && d <= today;
      }
      if (period === "last30") {
        const start = new Date(today); start.setDate(today.getDate() - 29);
        return d >= start && d <= today;
      }
      if (period === "last90") {
        const start = new Date(today); start.setDate(today.getDate() - 89);
        return d >= start && d <= today;
      }
      if (period === "thisTimeLastYear") {
        const lastYear = today.getFullYear() - 1;
        const end = new Date(lastYear, today.getMonth(), today.getDate());
        const start = new Date(end); start.setDate(end.getDate() - 29);
        const dLastYear = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return dLastYear >= start && dLastYear <= end;
      }
      if (period === "custom") {
        let from = customFrom ? new Date(customFrom) : null;
        let to = customTo ? new Date(customTo) : null;
        if (from) from = new Date(from.getFullYear(), from.getMonth(), from.getDate());
        if (to) to = new Date(to.getFullYear(), to.getMonth(), to.getDate());
        if (from && to) return d >= from && d <= to;
        if (from && !to) return d >= from;
        if (!from && to) return d <= to;
        return true;
      }
      return true;
    });
  }, [data, period, customFrom, customTo]);

  const {
    totalIncome,
    totalExpenses,
    categoryExpensesEntries,
    drilldownSeries,
    topIncomePayers,
    topExpenseMerchants,
  } = useMemo(() => {
    const isIncome = (amt) => Number(amt) >= 0;
    let incomeSum = 0, expenseSum = 0;
    const categoryExpenses = {}, merchantsByCategory = {}, incomeByPayer = {}, expenseByMerchant = {};

    const excludedCategories = new Set([
      "Asset Disposal",
      "Insurance Payout",
      "Internal Transfer",
      "Returned Direct Debit",
      "Transfer Between Accounts",
    ]);

    filtered.forEach((tx) => {
      const amount = parseFloat(tx.amount) || 0;
      const category = (tx.category && tx.category.trim()) || inferCategory(tx.description);
      const merchant = (tx.description && tx.description.trim()) || "Unknown";

      if (isIncome(amount)) {
        if (!excludedCategories.has(category)) {
          incomeSum += amount;
          incomeByPayer[merchant] = (incomeByPayer[merchant] || 0) + amount;
        }
      } else if (amount < 0) {
        if (!excludedCategories.has(category)) {
          const out = Math.abs(amount);
          expenseSum += out;
          categoryExpenses[category] = (categoryExpenses[category] || 0) + out;

          if (!merchantsByCategory[category]) merchantsByCategory[category] = {};
          merchantsByCategory[category][merchant] =
            (merchantsByCategory[category][merchant] || 0) + out;

          expenseByMerchant[merchant] =
            (expenseByMerchant[merchant] || 0) + out;
        }
      }
    });

    const drilldowns = Object.entries(merchantsByCategory).map(
      ([category, merchants]) => ({
        id: category,
        name: category,
        data: Object.entries(merchants)
          .sort((a, b) => b[1] - a[1])
          .map(([merchant, amount]) => [merchant, amount]),
      })
    );

    const categoryEntries = Object.entries(categoryExpenses).sort((a, b) => b[1] - a[1]);

    const topIncome = Object.entries(incomeByPayer)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount }));

    const topExpense = Object.entries(expenseByMerchant)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount }));

    return {
      totalIncome: incomeSum,
      totalExpenses: expenseSum,
      categoryExpensesEntries: categoryEntries,
      drilldownSeries: drilldowns,
      topIncomePayers: topIncome,
      topExpenseMerchants: topExpense,
    };
  }, [filtered]);

  const chartOptions = useMemo(() => {
    if (!hcReady || !Highcharts) return null;
    if (!filtered.length) return "NO_DATA";

    const numberFormat = (val, decimals = 2) => {
      try { return Highcharts.numberFormat(val, decimals); } 
      catch { return Number(val).toFixed(decimals); }
    };

    const labelMap = {
      week: "This Week",
      month: "This Month",
      quarter: "This Quarter",
      year: "This Year",
      last7: "Last 7 Days",
      last30: "Last 30 Days",
      last90: "Last 90 Days",
      thisTimeLastYear: "This Time Last Year",
      custom: "Custom Range",
    };

    const innerSeries = {
      name: "Profit vs Loss",
      size: "45%",
      dataLabels: {
        enabled: true,
        formatter: function () {
          return `${this.point.name}: £${numberFormat(this.point.y, 2)}`;
        },
      },
      data: [
        { name: "Income", y: totalIncome, color: "#10b981" },
        { name: "Expenses", y: totalExpenses, color: "#ef4444" },
      ],
    };

    const outerSeries = {
      name: "Expense categories",
      size: "85%",
      innerSize: "65%",
      dataLabels: {
        enabled: true,
        formatter: function () {
          return `${this.point.name}: £${numberFormat(this.point.y, 2)}`;
        },
      },
      data: categoryExpensesEntries.map(([cat, amount]) => ({
        name: cat,
        y: amount,
        drilldown: cat,
      })),
    };

    return {
      chart: { type: "pie", options3d: { enabled: true, alpha: 45, beta: 0 } },
      title: { text: `Transactions Master View (${labelMap[period] || period})` },
      tooltip: {
        pointFormatter: function () {
          const total = this.series.data.reduce((s, p) => s + p.y, 0);
          const pct = total ? ((this.y / total) * 100).toFixed(1) : 0;
          return `<b>£${numberFormat(this.y)}</b> (${pct}%)`;
        },
      },
      plotOptions: {
        pie: {
          innerSize: 100,
          depth: 45,
          allowPointSelect: true,
          cursor: "pointer",
          animation: { duration: 500 },
        },
      },
      series: [innerSeries, outerSeries],
      drilldown: { series: drilldownSeries },
      exporting: { enabled: true },
      credits: { enabled: false },
    };
  }, [
    hcReady,
    Highcharts,
    filtered,
    totalIncome,
    totalExpenses,
    categoryExpensesEntries,
    drilldownSeries,
    period,
  ]);

  const periodButtons = [
    { key: "week", label: "Week" },
    { key: "month", label: "Month" },
    { key: "quarter", label: "Quarter" },
    { key: "year", label: "Year" },
    { key: "last7", label: "Last 7" },
    { key: "last30", label: "Last 30" },
    { key: "last90", label: "Last 90" },
    { key: "thisTimeLastYear", label: "This Time Last Year" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <Layout currentPageName="Transactions">
      <div className="p-8">
        <h2 className="text-2xl font-bold text-slate-800">Transactions</h2>
        <p className="text-slate-600 mt-2">
          Review and tag your financial transactions. This view supports filters,
          bulk tagging, and exporting to CSV or PDF.
        </p>

        {/* Period selector bar */}
        <div className="mt-6 flex flex-wrap gap-2">
          {periodButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setPeriod(btn.key)}
              className={`px-3 py-1 border rounded text-sm ${
                period === btn.key
                  ? "bg-blue-100 border-blue-500 text-blue-700"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Custom date range inputs */}
        {period === "custom" && (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">From</label>
              <input
                type="date"
                value={customFrom || ""}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">To</label>
              <input
                type="date"
                value={customTo || ""}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-slate-300 rounded px-2 py-1 text-sm"
              />
            </div>
            <div className="text-xs text-slate-500">
              Leave either field blank to use open-ended range.
            </div>
          </div>
        )}

        <div className="mt-6">
          {hcReady && Highcharts && chartOptions && chartOptions !== "NO_DATA" ? (
            <HighchartsReact highcharts={Highcharts} options={chartOptions} />
          ) : hcReady && Highcharts && chartOptions === "NO_DATA" ? (
            <div className="text-slate-500">No chartable data for this period.</div>
          ) : (
            <div className="text-slate-500">Preparing chart...</div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold text-slate-800">Top income payers</h3>
            <ul className="mt-2 space-y-2">
              {topIncomePayers.length === 0 && (
                <li className="text-slate-500">No income in this period</li>
              )}
              {topIncomePayers.map((row, idx) => (
                <li key={row.name + idx} className="flex justify-between">
                  <span className="text-slate-700">{row.name}</span>
                  <span className="font-medium text-green-600">
                    £{row.amount.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-semibold text-slate-800">Top expense merchants</h3>
            <ul className="mt-2 space-y-2">
              {topExpenseMerchants.length === 0 && (
                <li className="text-slate-500">No expenses in this period</li>
              )}
              {topExpenseMerchants.map((row, idx) => (
                <li key={row.name + idx} className="flex justify-between">
                  <span className="text-slate-700">{row.name}</span>
                  <span className="font-medium text-red-600">
                    £{row.amount.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border border-slate-200 rounded-lg overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-left">Amount</th>
                <th className="px-4 py-2 text-left">Category</th>
              </tr>
            </thead>
            <tbody>
              {error && (
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-red-500">
                    Failed to load transactions
                  </td>
                </tr>
              )}
              {!data && !error && (
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-slate-500">
                    Loading transactions...
                  </td>
                </tr>
              )}
              {data && filtered.length === 0 && !error && (
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-slate-500">
                    No transactions in this period.
                  </td>
                </tr>
              )}
              {data && filtered.length > 0 &&
                filtered.map((tx) => (
                  <tr key={tx.id} className="border-t">
                    <td className="px-4 py-2">
                      {safeDate(tx.date)?.toLocaleDateString() ?? "—"}
                    </td>
                    <td className="px-4 py-2">{tx.description}</td>
                    <td
                      className={`px-4 py-2 font-medium ${
                        tx.amount >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {tx.amount >= 0
                        ? `+£${tx.amount.toFixed(2)}`
                        : `−£${Math.abs(tx.amount).toFixed(2)}`}
                    </td>
                    <td className="px-4 py-2">
                      {tx.category || inferCategory(tx.description)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
