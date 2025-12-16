import React, { useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";
import ResponsiveHighchart from "../components/ResponsiveHighchart";

function inferCategory(description = "") {
  const desc = description.toLowerCase();
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
  if (desc.includes("hmrc") || desc.includes("tax")) return "Tax Payment";
  if (desc.includes("savethechange")) return "Savings Deposit";
  if (desc.includes("transfer")) return "Transfer Between Accounts";
  if (desc.includes("standing order")) return "Standing Order";
  if (desc.includes("direct debit") || desc.includes("dd")) return "Direct Debit";
  if (desc.includes("returned dd") || desc.includes("rddp")) return "Returned Direct Debit";
  if (desc.includes("jaja") || desc.includes("zable") || desc.includes("credit")) return "Credit Card Payment";
  if (desc.includes("loan repayment") || desc.includes("zopa") || desc.includes("drafty repayment")) return "Loan Repayment";
  if (desc.includes("overdraft")) return "Overdraft Repayment";
  if (desc.includes("car finance") || desc.includes("vehicle loan")) return "Car Loan Repayment";
  if (desc.includes("council") || desc.includes("local authority")) return "Council Tax";
  if (desc.includes("insurance")) return "Insurance Premium";
  if (desc.includes("mortgage")) return "Mortgage";
  if (desc.includes("rent")) return "Rent";
  if (desc.includes("utilities") || desc.includes("gas") || desc.includes("electric") || desc.includes("severn trent")) return "Utilities";
  if (desc.includes("mobile") || desc.includes("vodafone") || desc.includes("o2") || desc.includes("giffgaff") || desc.includes("internet")) return "Mobile & Internet";
  if (desc.includes("amazon") || desc.includes("argos") || desc.includes("shopping")) return "Shopping";
  if (desc.includes("spotify") || desc.includes("netflix") || desc.includes("prime") || desc.includes("disney") || desc.includes("apple")) return "Subscriptions";
  if (desc.includes("tesco") || desc.includes("sainsbury") || desc.includes("aldi") || desc.includes("asda") || desc.includes("lidl")) return "Groceries";
  if (desc.includes("uber") || desc.includes("trainline") || desc.includes("tfl") || desc.includes("stagecoach") || desc.includes("national express")) return "Transport";
  if (desc.includes("fuel") || desc.includes("shell") || desc.includes("bp") || desc.includes("esso")) return "Fuel";
  if (desc.includes("restaurant") || desc.includes("takeaway") || desc.includes("just eat") || desc.includes("deliveroo") || desc.includes("ubereats")) return "Dining & Takeaway";
  if (desc.includes("nhs") || desc.includes("clinic") || desc.includes("dentist") || desc.includes("optical") || desc.includes("boots")) return "Healthcare";
  if (desc.includes("school") || desc.includes("tuition") || desc.includes("course") || desc.includes("exam")) return "Education";
  if (desc.includes("childcare") || desc.includes("nursery") || desc.includes("kids club")) return "Childcare";
  if (desc.includes("charity") || desc.includes("donation")) return "Charity";
  if (desc.includes("gift")) return "Gift";
  if (desc.includes("notemachine") || desc.includes("atm")) return "Cash Withdrawal";
  if (desc.includes("bingo") || desc.includes("casino") || desc.includes("bet")) return "Gambling";
  if (desc.includes("easyjet") || desc.includes("ryanair") || desc.includes("jet2") || desc.includes("airbnb") || desc.includes("booking.com")) return "Travel";
  if (desc.includes("ig.com") || desc.includes("trading") || desc.includes("etoro") || desc.includes("shares")) return "Investment Purchase";
  if (desc.includes("sheehy")) return "Family";
  return "Uncategorised";
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

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
      const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(session.user.subscriptionStatus);
      if (!(isAdmin || isSubscribedOrTrial)) {
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
        const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);
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
  const start = new Date(today);
  start.setDate(today.getDate() - 89);
  return d >= start && d <= today;
}
if (period === "thisTimeLastYear") {
  const lastYear = today.getFullYear() - 1;
  const end = new Date(lastYear, today.getMonth(), today.getDate());
  const start = new Date(end);
  start.setDate(end.getDate() - 29);
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


          // ⬇️ Aggregation logic
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
      "Refund",
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

  // ⬇️ Chart options
  const chartOptions = useMemo(() => {
    if (!hcReady || !Highcharts) return null;
    if (!filtered.length) return "NO_DATA";

    const innerSeries = {
      name: "Profit vs Loss",
      size: "45%",
      dataLabels: { enabled: true },
      data: [
        { name: "Income", y: totalIncome, color: "#10b981" },
        { name: "Expenses", y: totalExpenses, color: "#ef4444" },
      ],
    };

    const outerSeries = {
      name: "Expense categories",
      size: "85%",
      innerSize: "65%",
      dataLabels: { enabled: true },
      data: categoryExpensesEntries.map(([cat, amount]) => ({
        name: cat,
        y: amount,
        drilldown: cat,
      })),
    };

    return {
      chart: { type: "pie", options3d: { enabled: true, alpha: 45, beta: 0 } },
      title: { text: `Transactions Master View (${period})` },
      series: [innerSeries, outerSeries],
      drilldown: { series: drilldownSeries },
      credits: { enabled: false },
    };
  }, [hcReady, Highcharts, filtered, totalIncome, totalExpenses, categoryExpensesEntries, drilldownSeries, period]);

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
    <ResponsiveLayout>
      <div className="p-8">
        <h2 className="text-2xl font-bold text-slate-800">Transactions</h2>
        <p className="text-slate-600 mt-2">
          Review and tag your financial transactions. This view supports filters,
          bulk tagging, and exporting to CSV or PDF.
        </p>

        {/* Period selector */}
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
        {/* Chart */}
        <ResponsiveCard title="Transactions Master View">
          {hcReady && Highcharts && chartOptions && chartOptions !== "NO_DATA" ? (
            <ResponsiveHighchart highcharts={Highcharts} options={chartOptions} />
          ) : hcReady && Highcharts && chartOptions === "NO_DATA" ? (
            <p className="text-slate-500">No chartable data for this period.</p>
          ) : (
            <p className="text-slate-500">Preparing chart...</p>
          )}
        </ResponsiveCard>

        {/* Top income/expense */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <ResponsiveCard title="Top income">
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
          </ResponsiveCard>

          <ResponsiveCard title="Top expense">
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
          </ResponsiveCard>
        </div>

        {/* Transactions table */}
        <ResponsiveCard title="Transactions Table">
          <ResponsiveTable headers={["Date", "Description", "Amount", "Category"]}>
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
  filtered.map((tx) => {
    const category = tx.category || inferCategory(tx.description);

    // ✅ Default VAT logic
    const defaultVatRate = (() => {
      if (["Rent", "Wages", "Salary", "Loan Repayment", "Insurance Premium", "Council Tax"].includes(category))
        return 0;
      if (["Groceries", "Books", "Education", "Childcare"].includes(category))
        return 0;
      return 20; // default standard rate
    })();

    const vatRate = tx.vat_rate ?? defaultVatRate;

    async function updateVAT(newRate) {
      const rate = Number(newRate);
      const gross = Number(tx.amount);
      const vatAmount = rate > 0 ? gross * (rate / 100) : 0;

      await fetch("/api/transactions/update-vat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tx.id,
          vat_rate: rate,
          vat_amount: vatAmount,
        }),
      });
    }

    return (
      <tr key={tx.id} className="border-t">
        <td>{safeDate(tx.date)?.toLocaleDateString() ?? "—"}</td>
        <td>{tx.description}</td>

        <td className={tx.amount >= 0 ? "text-green-600" : "text-red-600"}>
          {tx.amount >= 0
            ? `+£${tx.amount.toFixed(2)}`
            : `−£${Math.abs(tx.amount).toFixed(2)}`}
        </td>

        <td>{category}</td>

        {/* ✅ VAT Rate Dropdown */}
        <td>
          <select
            className="border p-1 rounded"
            defaultValue={vatRate}
            onChange={(e) => updateVAT(e.target.value)}
          >
            <option value={20}>20% Standard</option>
            <option value={5}>5% Reduced</option>
            <option value={0}>0% Zero Rated</option>
            <option value={0}>Exempt</option>
            <option value={0}>Out of Scope</option>
          </select>
        </td>

        {/* ✅ VAT Amount */}
        <td>
          £{(tx.vat_amount ?? (tx.amount * (vatRate / 100))).toFixed(2)}
        </td>
      </tr>
    );
  })}

          </ResponsiveTable>
        </ResponsiveCard>
      </div>
    </ResponsiveLayout>
  );
}
