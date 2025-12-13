// pages/transactions.js
import React, { useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";
import ResponsiveHighchart from "../components/ResponsiveHighchart";

// ⬇️ Inference logic (UK-specific categories)
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

  // access control + Highcharts module loading unchanged …

  const { data, error } = useSWR("/api/transactions", fetcher);

  // filtering, aggregation, chartOptions unchanged …

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

        {/* Custom date range */}
        {period === "custom" && (
          <ResponsiveCard title="Custom Date Range">
            <div className="flex flex-wrap items-center gap-4">
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
          </ResponsiveCard>
        )}

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
              filtered.map((tx) => (
                <tr key={tx.id} className="border-t">
                  <td>{safeDate(tx.date)?.toLocaleDateString() ?? "—"}</td>
                  <td>{tx.description}</td>
                  <td className={tx.amount >= 0 ? "text-green-600" : "text-red-600"}>
                    {tx.amount >= 0
                      ? `+£${tx.amount.toFixed(2)}`
                      : `−£${Math.abs(tx.amount).toFixed(2)}`}
                  </td>
                  <td>{tx.category || inferCategory(tx.description)}</td>
                </tr>
              ))}
          </ResponsiveTable>
        </ResponsiveCard>
      </div>
    </ResponsiveLayout>
  );
}
