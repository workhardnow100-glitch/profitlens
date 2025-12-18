// pages/profile.js
import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
} from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useReactToPrint } from "react-to-print";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";

import { CT_MAP } from "../lib/constants/ctMap";
import { SYSTEM_CATEGORIES } from "../lib/constants/systemCategories";

const HighchartsReact = dynamic(
  () => import("highcharts-react-official"),
  { ssr: false }
);

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

const ALLOWABLE_SET = new Set(CT_MAP.allowable);
const DISALLOWABLE_SET = new Set(CT_MAP.disallowable);

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [transactions, setTransactions] = useState([]);
  const [hmrcCategories, setHmrcCategories] = useState([]);
  const [account, setAccount] = useState(null);
  const [totalsByType, setTotalsByType] = useState({
    sole_trader: {},
    limited_company: {},
  });
  const [byMonth, setByMonth] = useState({});
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpenses: 0,
    netProfit: 0,
    liabilities: {
      sole_trader: 0,
      limited_company: 0,
    },
  });

  const [Highcharts, setHighcharts] = useState(null);
  const [hcReady, setHcReady] = useState(false);

  const [selectedYear, setSelectedYear] = useState(null);
  const [expenseView, setExpenseView] = useState("all"); // all | allowable | disallowable

  const reportRef = useRef();
  const taxReportRef = useRef();

  // Access control
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

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (status !== "authenticated") return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/profile", {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load profile");

        setTransactions(json.transactions || []);
        setHmrcCategories(json.hmrcCategories || []);
        setAccount(json.account || null);
        setTotalsByType(
          json.totalsByType || { sole_trader: {}, limited_company: {} }
        );
        setByMonth(json.byMonth || {});
        setSummary(
          json.summary || {
            totalIncome: 0,
            totalExpenses: 0,
            netProfit: 0,
            liabilities: { sole_trader: 0, limited_company: 0 },
          }
        );

        // Default year: current calendar year (D1)
        const todayYear = new Date().getFullYear();
        const yearsFromData = new Set(
          (json.transactions || [])
            .map((tx) => tx.date && new Date(tx.date).getFullYear())
            .filter(Boolean)
        );
        if (yearsFromData.has(todayYear)) {
          setSelectedYear(todayYear);
        } else if (yearsFromData.size > 0) {
          setSelectedYear(Math.max(...yearsFromData));
        } else {
          setSelectedYear(todayYear);
        }
      } catch (err) {
        setError(err.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [status]);

  // Highcharts + drilldown
  useEffect(() => {
    if (typeof window === "undefined") return;

    (async () => {
      try {
        const HC = await import("highcharts");
        const HighchartsCore = HC.default || HC;
        const drilldownModule = await import("highcharts/modules/drilldown");

        if (typeof drilldownModule === "function") {
          drilldownModule(HighchartsCore);
        } else if (drilldownModule.default) {
          drilldownModule.default(HighchartsCore);
        }

        setHighcharts(HighchartsCore);
        setHcReady(true);
      } catch (err) {
        console.error("Failed to load Highcharts for profile:", err);
      }
    })();
  }, []);

  // Year options from data
  const yearOptions = useMemo(() => {
    const years = new Set(
      (transactions || [])
        .map((tx) => tx.date && new Date(tx.date).getFullYear())
        .filter(Boolean)
    );
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  // Filtered transactions by selectedYear (A1, Y1, F1)
  const filteredTransactions = useMemo(() => {
    if (!selectedYear) return transactions || [];
    return (transactions || []).filter((tx) => {
      if (!tx.date) return false;
      const year = new Date(tx.date).getFullYear();
      return year === selectedYear;
    });
  }, [transactions, selectedYear]);

  // Filtered byMonth derived from API byMonth + selectedYear
  const filteredByMonth = useMemo(() => {
    if (!selectedYear) return byMonth || {};
    const result = {};
    Object.entries(byMonth || {}).forEach(([monthKey, vals]) => {
      // monthKey is "YYYY-MM"
      const [yearStr] = monthKey.split("-");
      const year = Number(yearStr);
      if (year === selectedYear) {
        result[monthKey] = vals;
      }
    });
    return result;
  }, [byMonth, selectedYear]);

  // Client-side summary for selected year (overrides API summary for UI)
  const yearSummary = useMemo(() => {
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const tx of filteredTransactions || []) {
      const amount = Number(tx.amount || 0);
      if (amount > 0) {
        totalIncome += amount;
      } else if (amount < 0) {
        totalExpenses += Math.abs(amount);
      }
    }

    const netProfit = totalIncome - totalExpenses;

    const soleTraderTaxRate = 0.2;
    const limitedCompanyTaxRate = 0.19;

    const soleTraderOwed =
      netProfit > 0 ? netProfit * soleTraderTaxRate : 0;
    const limitedCompanyOwed =
      netProfit > 0 ? netProfit * limitedCompanyTaxRate : 0;

    return {
      totalIncome,
      totalExpenses,
      netProfit,
      liabilities: {
        sole_trader: soleTraderOwed,
        limited_company: limitedCompanyOwed,
      },
    };
  }, [filteredTransactions]);

  // Income / expense aggregations for charts (based on filteredTransactions)
  const { incomeByCategory, expensesByCategory } = useMemo(() => {
    const incomeMap = {};
    const expenseMap = {};

    for (const tx of filteredTransactions || []) {
      const cat =
        (tx.business_category && tx.business_category.trim()) ||
        "Uncategorised";
      const amount = Number(tx.amount || 0);

      if (amount > 0) {
        incomeMap[cat] = (incomeMap[cat] || 0) + amount;
      } else if (amount < 0) {
        const abs = Math.abs(amount);
        // Expense view filter (allowable vs disallowable vs all)
        if (expenseView === "allowable" && !ALLOWABLE_SET.has(cat)) continue;
        if (
          expenseView === "disallowable" &&
          !DISALLOWABLE_SET.has(cat)
        )
          continue;
        expenseMap[cat] = (expenseMap[cat] || 0) + abs;
      }
    }

    return {
      incomeByCategory: incomeMap,
      expensesByCategory: expenseMap,
    };
  }, [filteredTransactions, expenseView]);

  // HMRC breakdown (Option C, filtered by year, F1)
  const hmrcBreakdown = useMemo(() => {
    let allowable = 0;
    let disallowable = 0;

    for (const tx of filteredTransactions || []) {
      const cat =
        (tx.business_category && tx.business_category.trim()) ||
        "Uncategorised";
      const amount = Number(tx.amount || 0);

      if (amount < 0) {
        const abs = Math.abs(amount);
        if (ALLOWABLE_SET.has(cat)) {
          allowable += abs;
        } else if (DISALLOWABLE_SET.has(cat)) {
          disallowable += abs;
        }
      }
    }

    const totalIncome = Number(yearSummary.totalIncome || 0);
    const netProfit = Number(yearSummary.netProfit || 0);
    const soleTraderTaxRate = 0.2;
    const limitedCompanyTaxRate = 0.19;

    const soleTraderOwed = Number(
      yearSummary.liabilities?.sole_trader ||
        (netProfit > 0 ? netProfit * soleTraderTaxRate : 0)
    );
    const limitedCompanyOwed = Number(
      yearSummary.liabilities?.limited_company ||
        (netProfit > 0 ? netProfit * limitedCompanyTaxRate : 0)
    );

    return {
      totalIncome,
      allowable,
      disallowable,
      netProfit,
      soleTraderTaxRate,
      limitedCompanyTaxRate,
      soleTraderOwed,
      limitedCompanyOwed,
    };
  }, [filteredTransactions, yearSummary]);

  // Income drilldown chart
  const incomeChartOptions = useMemo(() => {
    if (!hcReady || !Highcharts) return null;
    const entries = Object.entries(incomeByCategory || {});
    if (!entries.length) return null;

    const topSeriesData = entries.map(([cat, total]) => ({
      name: cat,
      y: Number(total || 0),
      drilldown: `income-${cat}`,
    }));

    const drilldownSeries = entries.map(([cat]) => {
      const points = (filteredTransactions || [])
        .filter(
          (tx) =>
            tx.business_category?.trim() === cat &&
            Number(tx.amount || 0) > 0
        )
        .map((tx) => ({
          name: tx.description || tx.date || tx.id,
          y: Number(tx.amount || 0),
        }));

      return {
        id: `income-${cat}`,
        name: `Income – ${cat}`,
        data: points.map((p) => [p.name, p.y]),
      };
    });

    return {
      chart: {
        type: "column",
      },
      title: {
        text: "Income by Category",
      },
      xAxis: {
        type: "category",
      },
      legend: {
        enabled: false,
      },
      plotOptions: {
        series: {
          borderWidth: 0,
          dataLabels: {
            enabled: true,
            format: "£{point.y:.2f}",
          },
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
          name: "Income",
          colorByPoint: true,
          data: topSeriesData,
        },
      ],
      drilldown: {
        series: drilldownSeries,
      },
      credits: { enabled: false },
    };
  }, [hcReady, Highcharts, incomeByCategory, filteredTransactions]);

  // Expenses drilldown chart
  const expensesChartOptions = useMemo(() => {
    if (!hcReady || !Highcharts) return null;
    const entries = Object.entries(expensesByCategory || {});
    if (!entries.length) return null;

    const topSeriesData = entries.map(([cat, total]) => ({
      name: cat,
      y: Number(total || 0),
      drilldown: `expenses-${cat}`,
    }));

    const drilldownSeries = entries.map(([cat]) => {
      const points = (filteredTransactions || [])
        .filter((tx) => {
          const catMatch = tx.business_category?.trim() === cat;
          const isExpense = Number(tx.amount || 0) < 0;
          if (!catMatch || !isExpense) return false;

          const categoryName =
            (tx.business_category && tx.business_category.trim()) ||
            "Uncategorised";

          if (
            expenseView === "allowable" &&
            !ALLOWABLE_SET.has(categoryName)
          )
            return false;
          if (
            expenseView === "disallowable" &&
            !DISALLOWABLE_SET.has(categoryName)
          )
            return false;
          return true;
        })
        .map((tx) => ({
          name: tx.description || tx.date || tx.id,
          y: Math.abs(Number(tx.amount || 0)),
        }));

      return {
        id: `expenses-${cat}`,
        name: `Expenses – ${cat}`,
        data: points.map((p) => [p.name, p.y]),
      };
    });

    return {
      chart: {
        type: "column",
      },
      title: {
        text: "Expenses by Category",
      },
      xAxis: {
        type: "category",
      },
      legend: {
        enabled: false,
      },
      plotOptions: {
        series: {
          borderWidth: 0,
          dataLabels: {
            enabled: true,
            format: "£{point.y:.2f}",
          },
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
          data: topSeriesData,
        },
      ],
      drilldown: {
        series: drilldownSeries,
      },
      credits: { enabled: false },
    };
  }, [
    hcReady,
    Highcharts,
    expensesByCategory,
    filteredTransactions,
    expenseView,
  ]);

  const handlePrintFull = useReactToPrint({
    content: () => reportRef.current,
    documentTitle: "HMRC Profile Report",
  });

  const handlePrintTaxReport = useReactToPrint({
    content: () => taxReportRef.current,
    documentTitle: "HMRC Tax Report",
  });

  const handleExportCSV = () => {
    const rows = [
      [
        "Date",
        "Description",
        "Category",
        "Amount",
        "Account Number",
        "Sort Code",
      ],
    ];
    (filteredTransactions || []).forEach((tx) => {
      rows.push([
        tx.date || "",
        tx.description || "",
        tx.business_category || "Uncategorised",
        Number(tx.amount || 0).toFixed(2),
        tx.account_number || account?.account_number || "",
        tx.sort_code || account?.sort_code || "",
      ]);
    });
    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((r) => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "hmrc_profile_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (status === "loading" || loading)
    return <p className="p-8">Loading...</p>;
  if (!session?.user) return null;

  return (
    <ResponsiveLayout>
      <div className="p-8" ref={reportRef}>
        <h2 className="text-2xl font-bold text-slate-800">Your Profile</h2>
        <p className="text-slate-600 mt-2">
          Account details, HMRC categories, and transaction summaries.
        </p>

        {/* Global year filter (Y1, A1, D1) */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div>
            <label className="text-sm text-slate-600 mr-2">
              Year:
            </label>
            <select
              value={selectedYear || ""}
              onChange={(e) =>
                setSelectedYear(
                  e.target.value ? Number(e.target.value) : null
                )
              }
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="">All years</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          {/* Expense view toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">
              Expense view:
            </span>
            <button
              onClick={() => setExpenseView("all")}
              className={`px-2 py-1 text-xs rounded border ${
                expenseView === "all"
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-700 border-slate-300"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setExpenseView("allowable")}
              className={`px-2 py-1 text-xs rounded border ${
                expenseView === "allowable"
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-700 border-slate-300"
              }`}
            >
              Allowable
            </button>
            <button
              onClick={() => setExpenseView("disallowable")}
              className={`px-2 py-1 text-xs rounded border ${
                expenseView === "disallowable"
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-700 border-slate-300"
              }`}
            >
              Disallowable
            </button>
          </div>
        </div>

        {/* Account info */}
        <ResponsiveCard title="Account details">
          <p>
            <span className="font-medium">Account number:</span>{" "}
            {account?.account_number || "—"}
          </p>
          <p>
            <span className="font-medium">Sort code:</span>{" "}
            {account?.sort_code || "—"}
          </p>
        </ResponsiveCard>

        {/* Export buttons (P2) */}
        <div className="flex flex-wrap gap-4 mt-6">
          <button
            onClick={handlePrintFull}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition"
          >
            Download PDF
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition"
          >
            Export CSV
          </button>
          <button
            onClick={handlePrintTaxReport}
            className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 transition"
          >
            Download Tax Report
          </button>
        </div>

        {error && <p className="text-red-500 mt-6">Error: {error}</p>}

        {/* Summary (year filtered) */}
        <ResponsiveCard title="Summary (filtered by year)">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <div className="border border-slate-200 rounded p-3">
              <p className="text-sm text-slate-600">Total Income</p>
              <p className="text-slate-800 font-semibold">
                £{Number(yearSummary.totalIncome).toFixed(2)}
              </p>
            </div>
            <div className="border border-slate-200 rounded p-3">
              <p className="text-sm text-slate-600">Total Expenses</p>
              <p className="text-slate-800 font-semibold">
                £{Number(yearSummary.totalExpenses).toFixed(2)}
              </p>
            </div>
            <div className="border border-slate-200 rounded p-3">
              <p className="text-sm text-slate-600">Net Profit</p>
              <p className="text-slate-800 font-semibold">
                £{Number(yearSummary.netProfit).toFixed(2)}
              </p>
            </div>
          </div>
        </ResponsiveCard>

        {/* HMRC – Sole Trader + Limited Company breakdown (R1 scope in printable ref) */}
        <div ref={taxReportRef}>
          <ResponsiveCard title="HMRC – Sole Trader breakdown">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
              <div className="border border-slate-200 rounded p-3">
                <p className="text-sm text-slate-600">
                  Total Income (year)
                </p>
                <p className="text-slate-800 font-semibold">
                  £{hmrcBreakdown.totalIncome.toFixed(2)}
                </p>
              </div>
              <div className="border border-slate-200 rounded p-3">
                <p className="text-sm text-slate-600">
                  Allowable expenses
                </p>
                <p className="text-slate-800 font-semibold">
                  £{hmrcBreakdown.allowable.toFixed(2)}
                </p>
              </div>
              <div className="border border-slate-200 rounded p-3">
                <p className="text-sm text-slate-600">
                  Disallowable expenses
                </p>
                <p className="text-slate-800 font-semibold">
                  £{hmrcBreakdown.disallowable.toFixed(2)}
                </p>
              </div>
              <div className="border border-slate-200 rounded p-3">
                <p className="text-sm text-slate-600">Net profit</p>
                <p className="text-slate-800 font-semibold">
                  £{hmrcBreakdown.netProfit.toFixed(2)}
                </p>
              </div>
              <div className="border border-slate-200 rounded p-3">
                <p className="text-sm text-slate-600">
                  Tax rate (sole trader)
                </p>
                <p className="text-slate-800 font-semibold">
                  {(hmrcBreakdown.soleTraderTaxRate * 100).toFixed(1)}%
                </p>
              </div>
              <div className="border border-slate-200 rounded p-3">
                <p className="text-sm text-slate-600">Tax owed</p>
                <p className="text-slate-800 font-semibold">
                  £{hmrcBreakdown.soleTraderOwed.toFixed(2)}
                </p>
              </div>
            </div>
          </ResponsiveCard>

          <ResponsiveCard title="HMRC – Limited Company breakdown">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
              <div className="border border-slate-200 rounded p-3">
                <p className="text-sm text-slate-600">
                  Net profit (year)
                </p>
                <p className="text-slate-800 font-semibold">
                  £{hmrcBreakdown.netProfit.toFixed(2)}
                </p>
              </div>
              <div className="border border-slate-200 rounded p-3">
                <p className="text-sm text-slate-600">
                  Corporation tax rate
                </p>
                <p className="text-slate-800 font-semibold">
                  {(hmrcBreakdown.limitedCompanyTaxRate * 100).toFixed(
                    1
                  )}
                  %
                </p>
              </div>
              <div className="border border-slate-200 rounded p-3">
                <p className="text-sm text-slate-600">
                  Corporation tax owed
                </p>
                <p className="text-slate-800 font-semibold">
                  £{hmrcBreakdown.limitedCompanyOwed.toFixed(2)}
                </p>
              </div>
            </div>
          </ResponsiveCard>
        </div>

        {/* Income / Expenses drilldown charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <ResponsiveCard title="Income by category (drilldown)">
            {!hcReady || !Highcharts || !incomeChartOptions ? (
              <p className="text-slate-500">
                Not enough income data to generate chart.
              </p>
            ) : (
              <HighchartsReact
                highcharts={Highcharts}
                options={incomeChartOptions}
              />
            )}
          </ResponsiveCard>

          <ResponsiveCard title="Expenses by category (drilldown)">
            {!hcReady || !Highcharts || !expensesChartOptions ? (
              <p className="text-slate-500">
                Not enough expense data to generate chart.
              </p>
            ) : (
              <HighchartsReact
                highcharts={Highcharts}
                options={expensesChartOptions}
              />
            )}
          </ResponsiveCard>
        </div>

        {/* Transactions */}
        <ResponsiveCard title="Transactions (filtered by year)">
          <ResponsiveTable
            headers={["Date", "Description", "Category", "Amount"]}
          >
            {filteredTransactions.map((tx) => {
              const currentCategory =
                (tx.business_category && tx.business_category.trim()) ||
                "Uncategorised";

              return (
                <tr key={tx.id} className="border-t">
                  <td>{tx.date}</td>
                  <td>{tx.description}</td>
                  <td>
                    <select
                      value={currentCategory}
                      onChange={async (e) => {
                        const newCategory = e.target.value;
                        try {
                          const res = await fetch("/api/profile", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({
                              transactionId: tx.id,
                              newCategory,
                            }),
                          });
                          if (!res.ok) {
                            const data = await res.json();
                            console.error(
                              "Failed to update category",
                              data.error || res.statusText
                            );
                            return;
                          }
                          router.reload();
                        } catch (err) {
                          console.error(
                            "Failed to update category",
                            err
                          );
                        }
                      }}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="Uncategorised">
                        Uncategorised
                      </option>
                      {CT_CATEGORY_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>£{Number(tx.amount).toFixed(2)}</td>
                </tr>
              );
            })}
          </ResponsiveTable>
                </ResponsiveCard>

        {/* Monthly breakdown (filtered by year) */}
        <ResponsiveCard title="By month (filtered by year)">
          <div className="mt-3 space-y-2">
            {Object.entries(filteredByMonth).map(([month, vals]) => (
              <div
                key={month}
                className="border border-slate-200 rounded p-3 flex justify-between"
              >
                <span className="text-sm text-slate-600">{month}</span>
                <span className="text-slate-800 font-semibold">
                  Income £{Number(vals.income).toFixed(2)} | Expenses £
                  {Number(vals.expenses).toFixed(2)}
                </span>
              </div>
            ))}
            {Object.keys(filteredByMonth).length === 0 && (
              <p className="text-sm text-slate-500">
                No monthly data for the selected year.
              </p>
            )}
          </div>
        </ResponsiveCard>

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
