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
import EditableField from "../components/EditableField";

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
  const [client, setClient] = useState(null);
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
  const [expenseView, setExpenseView] = useState("all");

  const reportRef = useRef();
  const taxReportRef = useRef();

  // ⭐ Allow saveField() to call fetchProfile()
  let fetchProfile;

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
    fetchProfile = async () => {
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
        setClient(json.client || null);
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

  // Year options
  const yearOptions = useMemo(() => {
    const years = new Set(
      (transactions || [])
        .map((tx) => tx.date && new Date(tx.date).getFullYear())
        .filter(Boolean)
    );
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (!selectedYear) return transactions || [];
    return (transactions || []).filter((tx) => {
      if (!tx.date) return false;
      const year = new Date(tx.date).getFullYear();
      return year === selectedYear;
    });
  }, [transactions, selectedYear]);

  // Filtered byMonth
  const filteredByMonth = useMemo(() => {
    if (!selectedYear) return byMonth || {};
    const result = {};
    Object.entries(byMonth || {}).forEach(([monthKey, vals]) => {
      const [yearStr] = monthKey.split("-");
      const year = Number(yearStr);
      if (year === selectedYear) {
        result[monthKey] = vals;
      }
    });
    return result;
  }, [byMonth, selectedYear]);

  // Year summary
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

  // Income / expense aggregations
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

  // HMRC breakdown
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

  // CSV export
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

  // ⭐ FIXED saveField — now refreshes profile instantly
  async function saveField(field, value) {
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updateClient: true,
        [field]: value,
      }),
    });

    if (typeof fetchProfile === "function") {
      fetchProfile();
    } else {
      console.warn("fetchProfile() is not available yet.");
    }
  }

  // PDF handlers
  async function handleDownloadPdf() {
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "profile",
          selectedYear: selectedYear || null,
          expenseView,
          client,
          account,
          yearSummary,
          hmrcBreakdown,
          incomeByCategory,
          expensesByCategory,
          filteredTransactions,
          filteredByMonth,
        }),
      });

      const data = await res.json();
      if (data?.pdf?.url) {
        window.open(data.pdf.url, "_blank");
      } else {
        console.error("PDF generation failed:", data);
      }
    } catch (err) {
      console.error("Error generating PDF:", err);
    }
  }

  async function handleDownloadTaxReport() {
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reports",
          year: selectedYear || new Date().getFullYear(),
          companyDetails: {
            name: client?.name || "",
          },
          totals: {
            income: yearSummary.totalIncome,
            expenses: yearSummary.totalExpenses,
            net: yearSummary.netProfit,
          },
        }),
      });

      const data = await res.json();
      if (data?.pdf?.url) window.open(data.pdf.url, "_blank");
    } catch (err) {
      console.error("Error generating tax report PDF:", err);
    }
  }

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

        {/* Global year filter */}
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

{/* ✅ Business Profile */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

  {/* Personal Details */}
  <ResponsiveCard title="Personal Details">
    <div className="grid grid-cols-1 gap-4">

      <EditableField label="Full Name" value={client?.name} field="name" onSave={saveField} />

      <EditableField label="Address" value={client?.address} field="address" onSave={saveField} />

      <EditableField label="Postcode" value={client?.postcode} field="postcode" onSave={saveField} />

      <EditableField label="Phone Number" value={client?.phone} field="phone" onSave={saveField} />

      <EditableField label="Email" value={client?.email} field="email" onSave={saveField} />

      <EditableField label="UTR Number" value={client?.utr_number} field="utr_number" onSave={saveField} />

    </div>
  </ResponsiveCard>

  {/* Business Details */}
  <ResponsiveCard title="Business Details">
    <div className="grid grid-cols-1 gap-4">

      <EditableField label="Business Name" value={client?.business_name} field="business_name" onSave={saveField} />

      <EditableField label="Trading Name" value={client?.trading_name} field="trading_name" onSave={saveField} />

      <EditableField label="Business Type" value={client?.business_type} field="business_type" onSave={saveField} />

      <EditableField label="Company Number" value={client?.company_number} field="company_number" onSave={saveField} />

      <EditableField label="VAT Number" value={client?.vat_number} field="vat_number" onSave={saveField} />

      <EditableField label="Registered Business Address" value={client?.registered_address} field="registered_address" onSave={saveField} />

      <EditableField label="Industry" value={client?.industry} field="industry" onSave={saveField} />

      <EditableField label="Website" value={client?.website} field="website" onSave={saveField} />

      <EditableField label="Contact Person" value={client?.contact_person} field="contact_person" onSave={saveFeild} />
      
      <EditableField label="Business Email" value={client?.contact_email} field="contact_email" onSave={saveField} />

      <EditableField label="Business Phone" value={client?.contact_phone} field="contact_phone" onSave={saveField} />

      <EditableField label="Notes" value={client?.notes} field="notes" onSave={saveField} />

    </div>
  </ResponsiveCard>

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
            onClick={handleDownloadPdf}
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
            onClick={handleDownloadTaxReport}
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

        {/* HMRC – Sole Trader + Limited Company breakdown */}
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
