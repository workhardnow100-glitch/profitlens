// pages/sa.js
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";

// ✅ Chart.js imports
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend
);

export default function SAPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState("");
  const [result, setResult] = useState(null);
  const [payments, setPayments] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // ⭐ MTD SA state (HMRC)
  const [mtdObligations, setMtdObligations] = useState(null);
  const [mtdSummaries, setMtdSummaries] = useState(null);
  const [mtdEops, setMtdEops] = useState(null);
  const [mtdFinalDec, setMtdFinalDec] = useState(null);
  const [mtdReturns, setMtdReturns] = useState(null);
  const [mtdReceipt, setMtdReceipt] = useState(null);

  // ✅ Auto-generate SA tax years (2020/21 → 2030/31)
  const saYears = [];
  for (let y = 2020; y <= 2030; y++) {
    saYears.push({
      label: `${y}/${String(y + 1).slice(2)}`,
      start: `${y}-04-06`,
      end: `${y + 1}-04-05`,
    });
  }

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) router.replace("/login");
  }, [session, status]);

  async function fetchSA() {
    if (!selectedYear) return alert("Please select a tax year.");

    const year = saYears.find((y) => y.label === selectedYear);
    if (!year) return;

    setLoading(true);
    try {
      // ✅ Summary
      const res = await fetch("/api/sa/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.clientId,
          periodStart: year.start,
          periodEnd: year.end,
        }),
      });

      const data = await res.json();
      setResult({ ...data, locked: data.locked || false });

      // ✅ Payments
      const payRes = await fetch("/api/sa/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: session.user.clientId }),
      });

      const payData = await payRes.json();
      setPayments(payData.payments || []);

      // ✅ Analytics
      const analyticsRes = await fetch("/api/sa/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.clientId,
          periodStart: year.start,
          periodEnd: year.end,
        }),
      });

      const analyticsData = await analyticsRes.json();
      setAnalytics(analyticsData.analytics || []);
    } catch (err) {
      console.error(err);
      alert("Error fetching SA summary: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitSA() {
    if (!selectedYear) return alert("Please select a tax year.");

    const year = saYears.find((y) => y.label === selectedYear);
    if (!year) return;

    if (!confirm("Submit this Self Assessment period? This will lock it.")) return;

    setLoading(true);
    try {
      const res = await fetch("/api/sa/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.clientId,
          periodStart: year.start,
          periodEnd: year.end,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert("Self Assessment period locked successfully.");
        setResult({ ...result, locked: true });
      } else {
        alert("Error submitting SA: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Submission failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addPayment() {
    const date = document.getElementById("saPaymentDate").value;
    const amount = document.getElementById("saPaymentAmount").value;
    const direction = document.getElementById("saPaymentDirection").value;
    const reference = document.getElementById("saPaymentReference").value;

    if (!date || !amount) {
      alert("Please enter a date and amount.");
      return;
    }

    const res = await fetch("/api/sa/add-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: session.user.clientId,
        paymentDate: date,
        amount,
        direction,
        reference,
      }),
    });

    const data = await res.json();
    if (data.success) {
      alert("SA payment recorded.");
      fetchSA();
    } else {
      alert("Error: " + data.error);
    }
  }

  if (!session?.user) return null;

  return (
    <ResponsiveLayout currentPageName="Self Assessment">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Self Assessment</h1>

        {/* ✅ Select SA Tax Year */}
        <ResponsiveCard title="Select Tax Year">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="border p-2 rounded"
              disabled={result?.locked}
            >
              <option value="">Select SA Tax Year</option>
              {saYears.map((y) => (
                <option key={y.label} value={y.label}>
                  {y.label} (6 Apr {y.label.slice(0, 4)} → 5 Apr {y.label.slice(5)})
                </option>
              ))}
            </select>

            <button
              onClick={fetchSA}
              className="bg-blue-600 text-white px-4 py-2 rounded"
              disabled={loading || result?.locked}
            >
              {loading ? "Loading…" : "Get Summary"}
            </button>

            {result && !result.locked && (
              <button
                onClick={submitSA}
                className="bg-green-600 text-white px-4 py-2 rounded"
                disabled={loading}
              >
                {loading ? "Submitting…" : "Lock Period"}
              </button>
            )}
          </div>
        </ResponsiveCard>

        {/* ✅ SA Summary */}
        {result && (
          <>
            <ResponsiveCard title={`Summary ${result.locked ? "(Locked)" : ""}`}>
              <p><strong>Total Income:</strong> £{result.totalIncome.toFixed(2)}</p>
              <p><strong>Total Expenses:</strong> £{result.totalExpenses.toFixed(2)}</p>
              <p><strong>Profit:</strong> £{result.profit.toFixed(2)}</p>

              {/* ✅ Full UK Tax Band Breakdown */}
              <p><strong>Personal Allowance:</strong> £{result.personalAllowance.toFixed(2)}</p>
              <p><strong>Taxable Income:</strong> £{result.taxableIncome.toFixed(2)}</p>
              <p><strong>Tax Liability (UK Bands):</strong> £{result.taxLiability.toFixed(2)}</p>

              <div className="mt-4">
                <button
                  onClick={() => router.push("/sa/history")}
                  className="bg-gray-700 text-white px-4 py-2 rounded"
                >
                  View History
                </button>
              </div>
            </ResponsiveCard>

            {/* ✅ ✅ ✅ SA ANALYTICS WITH VISUAL CHART */}
            <ResponsiveCard title="SA Analytics">
              {!analytics ? (
                <p>Loading analytics…</p>
              ) : analytics.length === 0 ? (
                <p>No SA data available for this year.</p>
              ) : (
                <>
                  {/* ✅ Visual Line Chart */}
                  <div className="w-full mb-6">
                    <Line
                      data={{
                        labels: analytics.map((a) => a.month),
                        datasets: [
                          {
                            label: "Income (£)",
                            data: analytics.map((a) => a.income),
                            borderColor: "rgb(34,197,94)",
                            backgroundColor: "rgba(34,197,94,0.3)",
                            tension: 0.3,
                          },
                          {
                            label: "Expenses (£)",
                            data: analytics.map((a) => a.expenses),
                            borderColor: "rgb(239,68,68)",
                            backgroundColor: "rgba(239,68,68,0.3)",
                            tension: 0.3,
                          },
                          {
                            label: "Profit (£)",
                            data: analytics.map((a) => a.profit),
                            borderColor: "rgb(59,130,246)",
                            backgroundColor: "rgba(59,130,246,0.3)",
                            tension: 0.3,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        plugins: {
                          legend: { position: "bottom" },
                        },
                      }}
                    />
                  </div>

                  {/* ✅ Table View */}
                  <div className="w-full overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="p-2 text-left">Month</th>
                          <th className="p-2 text-left">Income (£)</th>
                          <th className="p-2 text-left">Expenses (£)</th>
                          <th className="p-2 text-left">Profit (£)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.map((row) => (
                          <tr key={row.month} className="border-b">
                            <td className="p-2">{row.month}</td>
                            <td className="p-2 text-green-700">£{row.income.toFixed(2)}</td>
                            <td className="p-2 text-red-600">£{row.expenses.toFixed(2)}</td>
                            <td className="p-2 text-blue-700">£{row.profit.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </ResponsiveCard>

            {/* ✅ ✅ ✅ SA PAYMENTS SECTION */}
            <ResponsiveCard title="SA Payments">
              <div className="mb-4">
                <p className="font-medium">
                  Total Paid:{" "}
                  <span className="text-blue-600">
                    £{payments
                      .filter((p) => p.direction === "payment")
                      .reduce((sum, p) => sum + Number(p.amount), 0)
                      .toFixed(2)}
                  </span>
                </p>

                <p className="font-medium">
                  Total Refunded:{" "}
                  <span className="text-green-600">
                    £{payments
                      .filter((p) => p.direction === "refund")
                      .reduce((sum, p) => sum + Number(p.amount), 0)
                      .toFixed(2)}
                  </span>
                </p>
              </div>

              <div className="mb-4 p-3 border rounded bg-white">
                <h4 className="font-semibold mb-2">Add SA Payment / Refund</h4>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input type="date" className="border p-2 rounded" id="saPaymentDate" />
                  <input
                    type="number"
                    step="0.01"
                    className="border p-2 rounded"
                    placeholder="Amount (£)"
                    id="saPaymentAmount"
                  />
                  <select className="border p-2 rounded" id="saPaymentDirection">
                    <option value="payment">Payment to HMRC</option>
                    <option value="refund">Refund from HMRC</option>
                  </select>
                  <input
                    type="text"
                    className="border p-2 rounded"
                    placeholder="Reference (optional)"
                    id="saPaymentReference"
                  />
                </div>

                <button
                  className="mt-3 bg-blue-600 text-white px-4 py-2 rounded"
                  onClick={addPayment}
                >
                  Add Payment
                </button>
              </div>

              <h4 className="font-semibold mb-2">Payment History</h4>

              {payments.length > 0 ? (
                <ul className="space-y-2">
                  {payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex justify-between items-center border p-2 rounded bg-white"
                    >
                      <span>{p.payment_date}</span>
                      <span
                        className={
                          p.direction === "payment" ? "text-red-600" : "text-green-600"
                        }
                      >
                        {p.direction === "payment" ? "Paid to HMRC" : "Refund from HMRC"}
                      </span>
                      <span className="font-semibold">£{p.amount.toFixed(2)}</span>
                      <span className="text-gray-500">{p.reference || ""}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No SA payments recorded yet.</p>
              )}
            </ResponsiveCard>

            {/* ✅ SA Transactions */}
            <ResponsiveCard title={`Transactions ${result.locked ? "(Locked)" : ""}`}>
              <ResponsiveTable
                columns={[
                  { header: "Date", accessor: "date" },
                  { header: "Description", accessor: "description" },
                  { header: "Type", accessor: "type" },
                  { header: "Amount (£)", accessor: "amount" },
                ]}
                data={result.transactions}
              />
            </ResponsiveCard>
          </>
        )}

        {/* ========================================================= */}
        {/* ⭐⭐⭐ MTD SELF ASSESSMENT (HMRC) ⭐⭐⭐ */}
        {/* ========================================================= */}

        <ResponsiveCard title="MTD SA – HMRC Obligations">
          <button
            onClick={async () => {
              const res = await fetch("/api/mtd/sa/get-obligations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
              });
              const data = await res.json();
              setMtdObligations(data.obligations || null);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
          >
            Load HMRC Obligations
          </button>

          {!mtdObligations ? (
            <p>No obligations loaded.</p>
          ) : (
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
              {JSON.stringify(mtdObligations, null, 2)}
            </pre>
          )}
        </ResponsiveCard>

        <ResponsiveCard title="MTD SA – Period Summaries">
          <div className="flex gap-3 mb-4">
            <button
              onClick={async () => {
                const res = await fetch("/api/mtd/sa/get-period-summaries", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                });
                const data = await res.json();
                setMtdSummaries(data.summaries || null);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Load Period Summaries
            </button>

            <button
              onClick={async () => {
                const periodStart = prompt("Enter period start (YYYY-MM-DD)");
                const periodEnd = prompt("Enter period end (YYYY-MM-DD)");
                if (!periodStart || !periodEnd) return;

                const res = await fetch("/api/mtd/sa/create-period-summary", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ periodStart, periodEnd }),
                });

                const data = await res.json();
                alert("Period summary created.");
                setMtdSummaries(data.summary || null);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Create Period Summary
            </button>
          </div>

          {!mtdSummaries ? (
            <p>No summaries loaded.</p>
          ) : (
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
              {JSON.stringify(mtdSummaries, null, 2)}
            </pre>
          )}
        </ResponsiveCard>

        <ResponsiveCard title="MTD SA – End of Period Statement (EOPS)">
          <div className="flex gap-3 mb-4">
            <button
              onClick={async () => {
                const res = await fetch("/api/mtd/sa/get-eops", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                });
                const data = await res.json();
                setMtdEops(data.eops || null);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Load EOPS
            </button>

            <button
              onClick={async () => {
                const taxYear = prompt("Enter tax year (e.g. 2023-24)");
                const incomeSourceType = prompt(
                  "Income source type (self-employment/property)"
                );
                if (!taxYear || !incomeSourceType) return;

                const res = await fetch("/api/mtd/sa/submit-eops", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ taxYear, incomeSourceType }),
                });

                const data = await res.json();
                alert("EOPS submitted.");
                setMtdEops(data.response || null);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Submit EOPS
            </button>
          </div>

          {!mtdEops ? (
            <p>No EOPS loaded.</p>
          ) : (
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
              {JSON.stringify(mtdEops, null, 2)}
            </pre>
          )}
        </ResponsiveCard>

        <ResponsiveCard title="MTD SA – Final Declaration">
          <div className="flex gap-3 mb-4">
            <button
              onClick={async () => {
                const res = await fetch("/api/mtd/sa/get-final-declaration", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                });
                const data = await res.json();
                setMtdFinalDec(data.declaration || null);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Load Final Declaration
            </button>

            <button
              onClick={async () => {
                const taxYear = prompt("Enter tax year (e.g. 2023-24)");
                if (!taxYear) return;

                const res = await fetch("/api/mtd/sa/submit-final-declaration", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ taxYear }),
                });

                const data = await res.json();
                alert("Final Declaration submitted.");
                setMtdFinalDec(data.response || null);
              }}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Submit Final Declaration
            </button>
          </div>

          {!mtdFinalDec ? (
            <p>No final declaration loaded.</p>
          ) : (
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
              {JSON.stringify(mtdFinalDec, null, 2)}
            </pre>
          )}
        </ResponsiveCard>

        <ResponsiveCard title="MTD SA – HMRC Returns">
          <button
            onClick={async () => {
              const res = await fetch("/api/mtd/sa/get-returns", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
              });
              const data = await res.json();
              setMtdReturns(data.returns || null);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
          >
            Load SA Returns
          </button>

          {!mtdReturns ? (
            <p>No returns loaded.</p>
          ) : (
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
              {JSON.stringify(mtdReturns, null, 2)}
            </pre>
          )}
        </ResponsiveCard>

        <ResponsiveCard title="MTD SA – Receipt Lookup">
          <button
            onClick={async () => {
              const submissionId = prompt("Enter submissionId");
              if (!submissionId) return;

              const res = await fetch("/api/mtd/sa/get-receipt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ submissionId }),
              });

              const data = await res.json();
              setMtdReceipt(data.receipt || null);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded mb-4"
          >
            Load Receipt
          </button>

          {!mtdReceipt ? (
            <p>No receipt loaded.</p>
          ) : (
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
              {JSON.stringify(mtdReceipt, null, 2)}
            </pre>
          )}
        </ResponsiveCard>
      </div>

      {/* ✅ Filing Disclaimer (Strong Version for SA) */}
      <p className="text-xs text-slate-500 mt-8 text-center max-w-2xl mx-auto">
        ProfitLens does not provide tax advice. All calculations are estimates
        only. Users are solely responsible for verifying all figures and
        ensuring accuracy before submitting any tax filings to HMRC.
      </p>
    </ResponsiveLayout>
  );
}
