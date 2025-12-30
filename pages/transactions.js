// pages/transactions.js

// ❗ THIS is the real fix — forces SSR and disables static generation
export async function getServerSideProps() {
  return { props: {} };
}

import React, { useEffect, useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";
import ResponsiveHighchart from "../components/ResponsiveHighchart";

import { useUser } from "../hooks/useUser";

import { CT_MAP } from "../lib/constants/ctMap";
import { SYSTEM_CATEGORIES } from "../lib/constants/systemCategories";
import { computeAssetDisposal } from "../lib/assetDisposal";

const HighchartsReact = dynamic(() => import("highcharts-react-official"), {
  ssr: false,
});

const fetcher = (url) => fetch(url).then((res) => res.json());

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// ✅ Single unified category list for ALL dropdowns (matches Dashboard)
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

// ✅ Simple SA tagging legend (no schema changes; uses includedinsa only)
const SA_TAG_HELP_TEXT =
  "Mark transactions that should feed into Self Assessment (SA100 / SA103 / SA105 / SA110).";

export default function Transactions() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useUser();

  const [period, setPeriod] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [Highcharts, setHighcharts] = useState(null);
  const [hcReady, setHcReady] = useState(false);

  // ✅ Asset Disposal Modal State
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [assetModalTx, setAssetModalTx] = useState(null);

  // 🔐 Subscription / access guard (unified with useUser)
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }

    const isAdmin = user.role === "admin";
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
      user.subscriptionStatus
    );

    if (!(isAdmin || isSubscribedOrTrial)) {
      router.replace("/upgrade");
    }
  }, [isLoading, isAuthenticated, user, router]);

  // 📈 Load Highcharts + modules
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
        .catch((err) =>
          console.error("Failed to load Highcharts modules:", err)
        );
    });
    return () => {
      mounted = false;
    };
  }, []);

  const { data, error } = useSWR("/api/transactions", fetcher);

  // ✅ Local period filtering (API already has its own window; this is client view)
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
        return (
          d.getMonth() === today.getMonth() &&
          d.getFullYear() === today.getFullYear()
        );
      }
      if (period === "quarter") {
        const currentQuarter = Math.floor(today.getMonth() / 3);
        return (
          Math.floor(d.getMonth() / 3) === currentQuarter &&
          d.getFullYear() === today.getFullYear()
        );
      }
      if (period === "year") return d.getFullYear() === today.getFullYear();
      if (period === "last7") {
        const start = new Date(today);
        start.setDate(today.getDate() - 6);
        return d >= start && d <= today;
      }
      if (period === "last30") {
        const start = new Date(today);
        start.setDate(today.getDate() - 29);
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
        const dLastYear = new Date(
          d.getFullYear(),
          d.getMonth(),
          d.getDate()
        );
        return dLastYear >= start && dLastYear <= end;
      }
      if (period === "custom") {
        let from = customFrom ? new Date(customFrom) : null;
        let to = customTo ? new Date(customTo) : null;
        if (from)
          from = new Date(
            from.getFullYear(),
            from.getMonth(),
            from.getDate()
          );
        if (to) to = new Date(to.getFullYear(), to.getMonth(), to.getDate());
        if (from && to) return d >= from && d <= to;
        if (from && !to) return d >= from;
        if (!from && to) return d <= to;
        return true;
      }
      return true;
    });
  }, [data, period, customFrom, customTo]);

  // ✅ Auto VAT logic (unchanged, but now reading business_category consistently)
  useEffect(() => {
    if (!filtered || filtered.length === 0) return;

    filtered.forEach((tx) => {
      if (tx.vat_rate != null) return;

      const category =
        (tx.business_category && tx.business_category.trim()) ||
        "Uncategorised";

      const defaultVatRate = (() => {
        if (
          [
            "Rent",
            "Loan Repayments",
            "Insurance",
            "Professional Fees",
            "Council Tax",
          ].includes(category)
        )
          return 0;
        if (
          ["Groceries", "Books", "Education", "Childcare"].includes(category)
        )
          return 0;
        return 20;
      })();

      const gross = Number(tx.amount);
      const vatAmount =
        defaultVatRate > 0 ? gross * (defaultVatRate / 100) : 0;

      fetch("/api/transactions/update-vat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tx.id,
          vat_rate: defaultVatRate,
          vat_amount: vatAmount,
        }),
      }).catch((err) =>
        console.error("Failed to auto-save default VAT", err)
      );
    });
  }, [filtered]);

  // ✅ Aggregation logic (income/expenses, category breakdown, top payers/merchants)
  const {
    totalIncome,
    totalExpenses,
    categoryExpensesEntries,
    drilldownSeries,
    topIncomePayers,
    topExpenseMerchants,
  } = useMemo(() => {
    const isIncome = (amt) => Number(amt) >= 0;
    let incomeSum = 0,
      expenseSum = 0;
    const categoryExpenses = {},
      merchantsByCategory = {},
      incomeByPayer = {},
      expenseByMerchant = {};

    // ✅ Exclude system-only categories from CT/VAT world (matches API & Dashboard intent)
    const excludedCategories = new Set([
      "Asset Disposal",
      "Insurance Payout",
      "Internal Transfers",
      "Transfers",
      "Returned Direct Debit",
      "Refunds Received",
    ]);

    filtered.forEach((tx) => {
      const amount = parseFloat(tx.amount) || 0;
      const category =
        (tx.business_category && tx.business_category.trim()) ||
        "Uncategorised";
      const merchant =
        (tx.description && tx.description.trim()) || "Unknown";

      if (isIncome(amount)) {
        if (!excludedCategories.has(category)) {
          incomeSum += amount;
          incomeByPayer[merchant] =
            (incomeByPayer[merchant] || 0) + amount;
        }
      } else if (amount < 0) {
        if (!excludedCategories.has(category)) {
          const out = Math.abs(amount);
          expenseSum += out;
          categoryExpenses[category] =
            (categoryExpenses[category] || 0) + out;

          if (!merchantsByCategory[category])
            merchantsByCategory[category] = {};
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

    const categoryEntries = Object.entries(categoryExpenses).sort(
      (a, b) => b[1] - a[1]
    );

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

  // ✅ Highcharts pie + drilldown options
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
      chart: {
        type: "pie",
        options3d: { enabled: true, alpha: 45, beta: 0 },
      },
      title: { text: `Transactions Master View (${period})` },
      series: [innerSeries, outerSeries],
      drilldown: { series: drilldownSeries },
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

  // ✅ Generic transaction upsert helper — used for CT, category, disposal, SA, etc.
  async function updateTransaction(id, payload) {
    try {
      console.log("🔧 TX UPDATE START", { id, payload });
      const res = await fetch("/api/transactions/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        console.warn("TX UPDATE: response not JSON", e);
      }

      if (!res.ok || (data && data.success === false)) {
        console.error("❌ TX UPDATE FAILED", {
          status: res.status,
          data,
        });
        return false;
      }

      console.log("✅ TX UPDATE OK", { id, payload, data });
      await mutate("/api/transactions");
      return true;
    } catch (err) {
      console.error("❌ TX UPDATE ERROR", err);
      return false;
    }
  }

  // ✅ Mode A Auto‑CT: category → suggested CT flag
  //    Backend will apply this only if manualctoverride is NOT set.
  async function updateBusinessCategory(id, newCategory) {
    const key = (newCategory || "Uncategorised").toLowerCase();

    const incomeSet = new Set(CT_MAP.income.map((c) => c.toLowerCase()));
    const allowableSet = new Set(
      CT_MAP.allowable.map((c) => c.toLowerCase())
    );
    const disallowableSet = new Set(
      CT_MAP.disallowable.map((c) => c.toLowerCase())
    );
    const ignoreSet = new Set(CT_MAP.ignore.map((c) => c.toLowerCase()));

    let autoCT = false;
    if (incomeSet.has(key)) autoCT = true;
    else if (allowableSet.has(key)) autoCT = true;
    else if (disallowableSet.has(key)) autoCT = true;
    else if (ignoreSet.has(key)) autoCT = false;
    else autoCT = false;

    await updateTransaction(id, {
      category: newCategory,
      auto_ct: autoCT,
    });
  }

  async function updateVATForTx(tx, newRate) {
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

    await mutate("/api/transactions");
  }

  async function updateCISForTx(tx, newValue) {
    await fetch("/api/transactions/update-cis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: tx.id,
        cisType: newValue,
        amount: tx.amount,
      }),
    });

    await mutate("/api/transactions");
  }

  // ⭐ SA helper (simple toggle, uses existing includedinsa column)
  async function updateSAForTx(tx, newValue) {
    await updateTransaction(tx.id, {
      includedinsa: newValue === "included",
    });
  }

  // ✅ Asset Disposal handler: open modal, clear fields when "No"
  function handleAssetDisposalChange(tx, value) {
    if (value === "" || value === "NONE") {
      updateTransaction(tx.id, {
        assetdisposaltype: null,
        assetpurchaseprice: null,
        assetcapitalclaimed: null,
        assettwdv: null,
        assetbalancingcharge: null,
        assetbalancingallowance: null,
      });
      return;
    }

    setAssetModalTx({
      ...tx,
      assetdisposaltype: value,
    });
    setAssetModalOpen(true);
  }

  if (isLoading || !isAuthenticated || !user) {
    return (
      <ResponsiveLayout>
        <div className="p-8">
          <p className="text-slate-500">Loading transactions…</p>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="p-8">
        <h2 className="text-2xl font-bold text-slate-800">Transactions</h2>
        <p className="text-slate-600 mt-2">
          Review and tag your financial transactions. This view supports
          filters, bulk tagging, and exporting to CSV or PDF. Tax tags
          (VAT, CIS, SA, CT) feed directly into your working papers.
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

        {period === "custom" && (
          <div className="mt-4 flex flex-wrap gap-3 items-center">
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                From
              </label>
              <input
                type="date"
                className="border rounded px-2 py-1 text-sm"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                To
              </label>
              <input
                type="date"
                className="border rounded px-2 py-1 text-sm"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Chart */}
        <ResponsiveCard title="Transactions Master View">
          {hcReady &&
          Highcharts &&
          chartOptions &&
          chartOptions !== "NO_DATA" ? (
            <ResponsiveHighchart
              highcharts={Highcharts}
              options={chartOptions}
            />
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
          <div className="mb-3 text-xs text-slate-500 flex flex-wrap gap-3">
            <span>
              <span className="font-semibold">VAT</span> = feeds VAT returns
              (MTD).
            </span>
            <span>
              <span className="font-semibold">CIS</span> = feeds CIS300 and
              CIS Statements.
            </span>
            <span title={SA_TAG_HELP_TEXT} className="cursor-help">
              <span className="font-semibold">SA</span> = feeds SA100 / SA103 /
              SA105 / SA110 working papers.
            </span>
            <span>
              <span className="font-semibold">CT</span> = feeds CT600 working
              papers.
            </span>
          </div>

          <ResponsiveTable
            headers={[
              "Date",
              "Description",
              "Amount",
              "Category",
              "VAT / CIS / SA",
              "VAT Amount",
              "Asset Disposal",
              "CT",
            ]}
          >
            {error && (
              <tr>
                <td colSpan={8} className="px-4 py-2 text-red-500">
                  Failed to load transactions
                </td>
              </tr>
            )}

            {!data && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-2 text-slate-500">
                  Loading transactions...
                </td>
              </tr>
            )}

            {data && filtered.length === 0 && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-2 text-slate-500">
                  No transactions in this period.
                </td>
              </tr>
            )}

            {data &&
              filtered.length > 0 &&
              filtered.map((tx) => {
                const businessCategory =
                  (tx.business_category && tx.business_category.trim()) ||
                  "Uncategorised";

                const defaultVatRate = (() => {
                  if (
                    [
                      "Rent",
                      "Loan Repayments",
                      "Insurance",
                      "Professional Fees",
                      "Council Tax",
                    ].includes(businessCategory)
                  )
                    return 0;
                  if (
                    ["Groceries", "Books", "Education", "Childcare"].includes(
                      businessCategory
                    )
                  )
                    return 0;
                  return 20;
                })();

                const vatRate =
                  tx.vat_rate != null ? tx.vat_rate : defaultVatRate;

                const cisSelection =
                  tx.cis_type === "deducted"
                    ? "deducted"
                    : tx.cis_type === "suffered"
                    ? "suffered"
                    : "none";

                const saSelection = tx.includedinsa ? "included" : "excluded";

                const effectiveVatAmount =
                  tx.vat_amount != null
                    ? Number(tx.vat_amount)
                    : Number(tx.amount) * (vatRate / 100);

                return (
                  <tr key={tx.id} className="border-t">
                    <td>{safeDate(tx.date)?.toLocaleDateString() ?? "—"}</td>

                    <td>{tx.description}</td>

                    <td
                      className={
                        tx.amount >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {tx.amount >= 0
                        ? `+£${tx.amount.toFixed(2)}`
                        : `−£${Math.abs(tx.amount).toFixed(2)}`}
                    </td>

                    {/* ✅ Category dropdown + auto‑CT hint via updateBusinessCategory */}
                    <td>
                      <select
                        className="border p-1 rounded text-sm"
                        value={businessCategory}
                        onChange={(e) =>
                          updateBusinessCategory(tx.id, e.target.value)
                        }
                      >
                        {CT_CATEGORY_OPTIONS.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* ✅ VAT + CIS + SA */}
                    <td>
                      <div className="flex flex-col gap-1">
                        {/* VAT */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">VAT:</span>
                          <select
                            className="border p-1 rounded text-sm"
                            value={vatRate}
                            onChange={(e) =>
                              updateVATForTx(tx, e.target.value)
                            }
                          >
                            <option value={20}>20% Standard</option>
                            <option value={5}>5% Reduced</option>
                            <option value={0}>0% Zero Rated</option>
                            <option value={0}>Exempt</option>
                            <option value={0}>Out of Scope</option>
                          </select>
                        </div>

                        {/* CIS */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">CIS:</span>
                          <select
                            className="border p-1 rounded text-sm"
                            value={cisSelection}
                            onChange={(e) =>
                              updateCISForTx(tx, e.target.value)
                            }
                          >
                            <option value="none">No CIS</option>
                            <option value="deducted">CIS Deducted</option>
                            <option value="suffered">CIS Suffered</option>
                          </select>
                        </div>

                        {/* ⭐ SA */}
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs text-slate-500 cursor-help"
                            title={SA_TAG_HELP_TEXT}
                          >
                            SA:
                          </span>
                          <select
                            className="border p-1 rounded text-sm"
                            value={saSelection}
                            onChange={(e) =>
                              updateSAForTx(tx, e.target.value)
                            }
                          >
                            <option value="excluded">Not SA</option>
                            <option value="included">Include in SA</option>
                          </select>
                        </div>
                      </div>
                    </td>

                    {/* ✅ VAT Amount */}
                    <td>£{effectiveVatAmount.toFixed(2)}</td>

                    {/* ✅ Asset Disposal Column */}
                    <td>
                      <select
                        className="border p-1 rounded text-sm"
                        value={tx.assetdisposaltype || "NONE"}
                        onChange={(e) =>
                          handleAssetDisposalChange(tx, e.target.value)
                        }
                      >
                        <option value="NONE">No</option>
                        <option value="MAIN_POOL">Main Pool</option>
                        <option value="SPECIAL_RATE_POOL">
                          Special Rate
                        </option>
                        <option value="CARS">Cars</option>
                        <option value="SHORT_LIFE">Short‑Life</option>
                      </select>
                    </td>

                    {/* ✅ CT Flag: ON/OFF manual override toggle */}
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={tx.includedinct === true}
                        onChange={async (e) => {
                          await updateTransaction(tx.id, {
                            includedinct: e.target.checked,
                            manualctoverride: true,
                          });
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
          </ResponsiveTable>
        </ResponsiveCard>

        {/* ✅ In‑App Disclaimer */}
        <p className="text-xs text-slate-500 mt-8 text-center max-w-2xl mx-auto">
          ProfitLens provides estimates only. Always verify figures before
          filing with HMRC. Nothing displayed here constitutes tax, accounting,
          or legal advice.
        </p>
      </div>

      {/* ✅ Asset Disposal Modal */}
      {assetModalOpen && assetModalTx && (
        <AssetDisposalModal
          transaction={assetModalTx}
          onClose={() => setAssetModalOpen(false)}
          onSave={async (payload) => {
            await updateTransaction(assetModalTx.id, {
              ...payload,
              includedinct: true,
              manualctoverride: true,
            });
            setAssetModalOpen(false);
          }}
        />
      )}
    </ResponsiveLayout>
  );
}

/* ✅ FULL ASSET DISPOSAL MODAL COMPONENT */
function AssetDisposalModal({ transaction, onClose, onSave }) {
  const [purchasePrice, setPurchasePrice] = useState("");
  const [capitalClaimed, setCapitalClaimed] = useState("");

  const disposalValue = Math.abs(Number(transaction.amount));

  const result =
    purchasePrice !== "" && capitalClaimed !== ""
      ? computeAssetDisposal({
          poolType: transaction.assetdisposaltype || "NONE",
          purchasePrice: Number(purchasePrice),
          capitalClaimed: Number(capitalClaimed),
          disposalProceeds: disposalValue,
        })
      : null;

  const twdv = result?.values?.assettwdv ?? null;
  const balancingCharge = result?.values?.assetbalancingcharge ?? null;
  const balancingAllowance = result?.values?.assetbalancingallowance ?? null;

  const handleSave = () => {
    onSave({
      assetdisposaltype: transaction.assetdisposaltype,
      assetpurchaseprice: purchasePrice === "" ? null : Number(purchasePrice),
      assetcapitalclaimed:
        capitalClaimed === "" ? null : Number(capitalClaimed),
      assettwdv: twdv,
      assetbalancingcharge: balancingCharge,
      assetbalancingallowance: balancingAllowance,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          Asset Disposal Details
        </h2>

        <p className="text-slate-600 mb-4">
          {transaction.description} — Disposal value:{" "}
          <span className="font-semibold">£{disposalValue.toFixed(2)}</span>
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-600 mb-1">
              Purchase Price
            </label>
            <input
              type="number"
              className="border rounded p-2 w-full"
              value={purchasePrice}
              onChange={(e) =>
                setPurchasePrice(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
            />
          </div>

          <div>
            <label className="block text-sm text-slate-600 mb-1">
              Capital Allowances Claimed So Far
            </label>
            <input
              type="number"
              className="border rounded p-2 w-full"
              value={capitalClaimed}
              onChange={(e) =>
                setCapitalClaimed(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
            />
          </div>

          {/* ✅ ENGINE OUTPUT PANEL */}
          <div className="bg-slate-50 p-3 rounded border text-sm">
            <p>
              <span className="font-semibold">TWDV:</span>{" "}
              {twdv !== null ? `£${twdv.toFixed(2)}` : "—"}
            </p>
            <p>
              <span className="font-semibold">Balancing Charge:</span>{" "}
              {balancingCharge !== null
                ? `£${balancingCharge.toFixed(2)}`
                : "£0.00"}
            </p>
            <p>
              <span className="font-semibold">Balancing Allowance:</span>{" "}
              {balancingAllowance !== null
                ? `£${balancingAllowance.toFixed(2)}`
                : "£0.00"}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
            disabled={twdv === null}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
