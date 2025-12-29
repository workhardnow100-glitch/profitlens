// pages/corp.js
import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";

export default function CorpPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // CT payments (front-end view only; backend stores the truth)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDirection, setPaymentDirection] = useState("payment");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentTotals, setPaymentTotals] = useState(null);

  // CT MTD (HMRC) cockpit state
  const [ctStatus, setCtStatus] = useState(null);
  const [ctObligations, setCtObligations] = useState([]);
  const [ctReturns, setCtReturns] = useState([]);
  const [ctLiabilities, setCtLiabilities] = useState([]);
  const [ctPayments, setCtPayments] = useState([]);
  const [ctLoading, setCtLoading] = useState(false);
  const [ctError, setCtError] = useState(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) router.replace("/login");
  }, [session, status, router]);

  // Derived drilldown groups from result.breakdown
  const { incomeRows, allowableRows, disallowableRows, reviewRows } = useMemo(() => {
    if (!result?.breakdown) {
      return { incomeRows: [], allowableRows: [], disallowableRows: [], reviewRows: [] };
    }

    const incomeRows = [];
    const allowableRows = [];
    const disallowableRows = [];
    const reviewRows = [];

    for (const row of result.breakdown) {
      if (row.ctType === "income") incomeRows.push(row);
      else if (row.ctType === "allowable") allowableRows.push(row);
      else if (row.ctType === "disallowable") disallowableRows.push(row);
      else reviewRows.push(row);
    }

    return { incomeRows, allowableRows, disallowableRows, reviewRows };
  }, [result]);

  async function fetchCorp(start = from, end = to) {
    if (!start || !end) {
      alert("Please select both start and end dates.");
      return;
    }
    if (!session?.user?.clientId) {
      alert("Missing client ID.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/corp/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.actingAsClientId ?? session.user.clientId,
          periodStart: start,
          periodEnd: end,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert("Error fetching Corporation Tax summary: " + (data.error || "Unknown error"));
        return;
      }
      setResult({ ...data, locked: data.locked || false });
    } catch (err) {
      console.error(err);
      alert("Error fetching Corporation Tax summary: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitCorp() {
    if (!from || !to) {
      alert("Please select both start and end dates.");
      return;
    }
    if (!confirm("Submit this Corporation Tax period? This will lock it.")) return;

    setLoading(true);
    try {
      const res = await fetch("/api/corp/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.actingAsClientId ?? session.user.clientId,
          periodStart: from,
          periodEnd: to,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Corporation Tax period locked successfully.");
        setResult((prev) => (prev ? { ...prev, locked: true } : prev));
      } else {
        alert("Error submitting Corporation Tax: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Submission failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitPayment() {
    if (!paymentDate || !paymentAmount) {
      alert("Please enter date and amount.");
      return;
    }

    try {
      const res = await fetch("/api/ct/add-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.actingAsClientId ?? session.user.clientId,
          paymentDate,
          amount: paymentAmount,
          direction: paymentDirection,
          reference: paymentReference,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert("Error adding payment: " + (data.error || "Unknown error"));
        return;
      }

      alert("Payment added successfully.");

      setShowPaymentModal(false);
      setPaymentDate("");
      setPaymentAmount("");
      setPaymentDirection("payment");
      setPaymentReference("");

      // The API returns totals for all payments for this client
      if (data.totals) {
        setPaymentTotals(data.totals);
      }

      if (from && to) {
        fetchCorp(from, to);
      }
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    }
  }

  // Fetch CT MTD data from HMRC via new API routes
  async function fetchCtMtd() {
    setCtLoading(true);
    setCtError(null);

    try {
      const [statusRes, obligationsRes, returnsRes, liabilitiesRes, paymentsRes] =
        await Promise.all([
          fetch("/api/mtd/ct/status"),
          fetch("/api/mtd/ct/obligations"),
          fetch("/api/mtd/ct/returns"),
          fetch("/api/mtd/ct/liabilities"),
          fetch("/api/mtd/ct/payments"),
        ]);

      const [statusData, obligationsData, returnsData, liabilitiesData, paymentsData] =
        await Promise.all([
          statusRes.json(),
          obligationsRes.json(),
          returnsRes.json(),
          liabilitiesRes.json(),
          paymentsRes.json(),
        ]);

      if (!statusRes.ok) throw new Error(statusData.error || "Error fetching CT MTD status");
      if (!obligationsRes.ok)
        throw new Error(obligationsData.error || "Error fetching CT obligations");
      if (!returnsRes.ok) throw new Error(returnsData.error || "Error fetching CT returns");
      if (!liabilitiesRes.ok)
        throw new Error(liabilitiesData.error || "Error fetching CT liabilities");
      if (!paymentsRes.ok)
        throw new Error(paymentsData.error || "Error fetching CT payments");

      setCtStatus(statusData.status || statusData || null);
      setCtObligations(obligationsData.obligations || obligationsData || []);
      setCtReturns(returnsData.returns || returnsData || []);
      setCtLiabilities(liabilitiesData.liabilities || liabilitiesData || []);
      setCtPayments(paymentsData.payments || paymentsData || []);
    } catch (err) {
      console.error("CT MTD fetch error:", err);
      setCtError(err.message);
    } finally {
      setCtLoading(false);
    }
  }

  if (!session?.user) return null;

  const hasResult = !!result;

  return (
    <ResponsiveLayout currentPageName="Corporation Tax">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">Corporation Tax</h1>
        <p className="text-slate-600">
          Cockpit view of trading income, allowable expenses, add‑backs, and Corporation Tax
          liability for your chosen accounting year.
        </p>

        {/* Period controls */}
        <ResponsiveCard title="Select Accounting Year">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Period start
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border p-2 rounded w-full"
                disabled={result?.locked}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Period end
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border p-2 rounded w-full"
                disabled={result?.locked}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => fetchCorp()}
                className="bg-blue-600 text-white rounded px-4 py-2 w-full sm:w-auto"
                disabled={result?.locked || loading}
              >
                {loading ? "Loading…" : "Get Summary"}
              </button>
              {hasResult && !result.locked && (
                <button
                  onClick={submitCorp}
                  className="bg-green-600 text-white px-4 py-2 rounded w-full sm:w-auto"
                  disabled={loading}
                >
                  {loading ? "Submitting…" : "Lock Period"}
                </button>
              )}
            </div>
          </div>
        </ResponsiveCard>

        {/* Summary + KPIs */}
        {hasResult && (
          <>
            <ResponsiveCard
              title={`Corporation Tax Summary ${result.locked ? "(Locked)" : ""}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Trading income</p>
                  <p className="text-xl font-semibold text-emerald-700">
                    £{result.income.toFixed(2)}
                  </p>
                </div>
                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Allowable expenses</p>
                  <p className="text-xl font-semibold text-red-600">
                    £{result.allowable.toFixed(2)}
                  </p>
                </div>
                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Add‑backs (disallowable)</p>
                  <p className="text-xl font-semibold text-amber-600">
                    £{result.disallowable.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Profit</p>
                  <p className="text-xl font-semibold text-slate-900">
                    £{result.profit.toFixed(2)}
                  </p>
                </div>
                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Adjusted profit</p>
                  <p className="text-xl font-semibold text-slate-900">
                    £{result.adjustedProfit.toFixed(2)}
                  </p>
                </div>
                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Corporation Tax due</p>
                  <p className="text-xl font-semibold text-indigo-700">
                    £{result.corpTaxDue.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Effective rate: {result.effectiveRate.toFixed(2)}%
                  </p>
                </div>
              </div>

              {reviewRows.length > 0 && (
                <div className="mt-4 p-3 rounded border border-amber-300 bg-amber-50 text-amber-900 text-sm">
                  There are <strong>{reviewRows.length}</strong> transactions marked as{" "}
                  <strong>review/uncategorised</strong>. These do not slot cleanly into HMRC‑aligned
                  CT rules and should be checked before filing.
                </div>
              )}
            </ResponsiveCard>

            {/* Corporation Tax Payments */}
            <ResponsiveCard title="Corporation Tax Payments">
              <p className="text-sm text-slate-600 mb-2">
                Track payments to and refunds from HMRC for this client. These records are stored
                separately from transactions and used for reconciliation.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">CT due (this period)</p>
                  <p className="text-lg font-semibold text-indigo-700">
                    £{result.corpTaxDue.toFixed(2)}
                  </p>
                </div>

                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Total paid (all time)</p>
                  <p className="text-lg font-semibold text-emerald-700">
                    £{paymentTotals?.totalPaid?.toFixed(2) ?? "0.00"}
                  </p>
                </div>

                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Net paid (payments - refunds)</p>
                  <p className="text-lg font-semibold text-slate-900">
                    £{paymentTotals?.netPaid?.toFixed(2) ?? "0.00"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowPaymentModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Add payment or refund
              </button>
            </ResponsiveCard>

            {/* Drilldown: Income */}
            <ResponsiveCard title="Trading income breakdown">
              <ResponsiveTable
                columns={[
                  { header: "Date", accessor: "date" },
                  { header: "Description", accessor: "description" },
                  { header: "Category", accessor: "business_category" },
                  { header: "Amount (£)", accessor: "amount" },
                ]}
                data={incomeRows}
              />
            </ResponsiveCard>

            {/* Drilldown: Allowable */}
            <ResponsiveCard title="Allowable expenses breakdown">
              <ResponsiveTable
                columns={[
                  { header: "Date", accessor: "date" },
                  { header: "Description", accessor: "description" },
                  { header: "Category", accessor: "business_category" },
                  { header: "Amount (£)", accessor: "amount" },
                ]}
                data={allowableRows}
              />
            </ResponsiveCard>

            {/* Drilldown: Disallowable / add-backs */}
            <ResponsiveCard title="Disallowable expenses (add‑backs)">
              <ResponsiveTable
                columns={[
                  { header: "Date", accessor: "date" },
                  { header: "Description", accessor: "description" },
                  { header: "Category", accessor: "business_category" },
                  { header: "Amount (£)", accessor: "amount" },
                ]}
                data={disallowableRows}
              />
            </ResponsiveCard>

            {/* Drilldown: Review / uncategorised */}
            {reviewRows.length > 0 && (
              <ResponsiveCard title="Review / uncategorised transactions">
                <p className="text-sm text-slate-600 mb-2">
                  These rows are not clearly allowable or disallowable. Adjust their categories on
                  the Transactions page to tidy your Corporation Tax position.
                </p>
                <ResponsiveTable
                  columns={[
                    { header: "Date", accessor: "date" },
                    { header: "Description", accessor: "description" },
                    { header: "Category", accessor: "business_category" },
                    { header: "CT Type", accessor: "ctType" },
                    { header: "Amount (£)", accessor: "amount" },
                  ]}
                  data={reviewRows}
                />
              </ResponsiveCard>
            )}
          </>
        )}

        {/* CT MTD – HMRC cockpit (placed at the bottom) */}
        <ResponsiveCard title="HMRC MTD – Corporation Tax">
          <div className="flex items-center justify-between mb-3 gap-3">
            <p className="text-sm text-slate-600">
              Live HMRC view for Corporation Tax: obligations, returns, liabilities and payments for
              the selected client.
            </p>
            <button
              onClick={fetchCtMtd}
              className="bg-indigo-600 text-white px-4 py-2 rounded text-sm"
              disabled={ctLoading}
            >
              {ctLoading ? "Refreshing…" : "Refresh from HMRC"}
            </button>
          </div>

          {ctError && (
            <div className="mb-3 p-3 rounded border border-red-300 bg-red-50 text-red-800 text-sm">
              HMRC error: {ctError}
            </div>
          )}

          {ctStatus && (
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded p-3 bg-slate-50">
                <p className="text-xs uppercase text-slate-500">MTD connection</p>
                <p className="text-sm font-semibold text-slate-900">
                  {ctStatus.isConnected ? "Connected" : "Not connected"}
                </p>
                {!ctStatus.isConnected && (
                  <p className="text-xs text-slate-500 mt-1">
                    HMRC did not return CT obligations. Check authorisation or UTR.
                  </p>
                )}
              </div>
              <div className="border rounded p-3 bg-slate-50">
                <p className="text-xs uppercase text-slate-500">Token</p>
                <p className="text-sm font-semibold text-slate-900">
                  {ctStatus.tokenValid ? "Valid" : "Invalid / expired"}
                </p>
              </div>
              <div className="border rounded p-3 bg-slate-50">
                <p className="text-xs uppercase text-slate-500">UTR linked</p>
                <p className="text-sm font-semibold text-slate-900">
                  {ctStatus.utrLinked ? "Yes" : "No"}
                </p>
              </div>
            </div>
          )}

          {/* Obligations */}
          {ctObligations && ctObligations.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                HMRC CT obligations
              </h3>
              <ResponsiveTable
                columns={[
                  { header: "Period start", accessor: "start" },
                  { header: "Period end", accessor: "end" },
                  { header: "Due date", accessor: "due" },
                  { header: "Status", accessor: "status" },
                ]}
                data={ctObligations}
              />
            </div>
          )}

          {/* Returns */}
          {ctReturns && ctReturns.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                HMRC CT returns
              </h3>
              <ResponsiveTable
                columns={[
                  { header: "Period start", accessor: "start" },
                  { header: "Period end", accessor: "end" },
                  { header: "Received", accessor: "received" },
                  { header: "Status", accessor: "status" },
                ]}
                data={ctReturns}
              />
            </div>
          )}

          {/* Liabilities */}
          {ctLiabilities && ctLiabilities.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                HMRC CT liabilities
              </h3>
              <ResponsiveTable
                columns={[
                  { header: "Tax year", accessor: "taxYear" },
                  { header: "Amount (£)", accessor: "amount" },
                  { header: "Due date", accessor: "due" },
                  { header: "Status", accessor: "status" },
                ]}
                data={ctLiabilities}
              />
            </div>
          )}

          {/* Payments */}
          {ctPayments && ctPayments.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                HMRC CT payments
              </h3>
              <ResponsiveTable
                columns={[
                  { header: "Date", accessor: "date" },
                  { header: "Amount (£)", accessor: "amount" },
                  { header: "Reference", accessor: "reference" },
                  { header: "Method", accessor: "method" },
                ]}
                data={ctPayments}
              />
            </div>
          )}

          {!ctLoading &&
            !ctError &&
            !ctStatus &&
            ctObligations.length === 0 &&
            ctReturns.length === 0 &&
            ctLiabilities.length === 0 &&
            ctPayments.length === 0 && (
              <p className="text-xs text-slate-500 mt-2">
                No HMRC CT data loaded yet. Use “Refresh from HMRC” to pull the latest obligations,
                returns, liabilities and payments.
              </p>
            )}
        </ResponsiveCard>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold">Add Corporation Tax Payment</h2>

            <div className="space-y-2">
              <label className="block font-medium text-sm">Payment date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="border p-2 rounded w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-sm">Amount (£)</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="border p-2 rounded w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-sm">Direction</label>
              <select
                value={paymentDirection}
                onChange={(e) => setPaymentDirection(e.target.value)}
                className="border p-2 rounded w-full"
              >
                <option value="payment">Payment to HMRC</option>
                <option value="refund">Refund from HMRC</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-sm">Reference (optional)</label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="border p-2 rounded w-full"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={submitPayment}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Save payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Filing Disclaimer (Strong Version for Corporation Tax) */}
      <p className="text-xs text-slate-500 mt-8 text-center max-w-2xl mx-auto">
        ProfitLens does not provide tax advice. All calculations are estimates only. Users are
        solely responsible for verifying all figures and ensuring accuracy before submitting any tax
        filings to HMRC.
      </p>
    </ResponsiveLayout>
  );
}

