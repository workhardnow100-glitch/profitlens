// pages/corp.js
import { useState, useEffect } from "react";
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

  // ✅ Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDirection, setPaymentDirection] = useState("payment");
  const [paymentReference, setPaymentReference] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) router.replace("/login");
  }, [session, status, router]);

  // ✅ Fetch Corporation Tax summary
  async function fetchCorp(start = from, end = to) {
    if (!start || !end) return alert("Please select both start and end dates.");
    setLoading(true);
    try {
      const res = await fetch("/api/corp/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.clientId,
          periodStart: start,
          periodEnd: end
        })
      });
      const data = await res.json();
      setResult({ ...data, locked: data.locked || false });
    } catch (err) {
      console.error(err);
      alert("Error fetching Corporation Tax summary: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ✅ Submit Corporation Tax period
  async function submitCorp() {
    if (!from || !to) return alert("Please select both start and end dates.");
    if (!confirm("Submit this Corporation Tax period? This will lock it.")) return;

    setLoading(true);
    try {
      const res = await fetch("/api/corp/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.clientId,
          periodStart: from,
          periodEnd: to
        })
      });
      const data = await res.json();
      if (data.success) {
        alert("Corporation Tax period locked successfully.");
        setResult({ ...result, locked: true });
      } else {
        alert("Error submitting Corporation Tax: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Submission failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ✅ Add CT payment
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
          clientId: session.user.clientId,
          paymentDate,
          amount: paymentAmount,
          direction: paymentDirection,
          reference: paymentReference
        })
      });

      const data = await res.json();

      if (!data.success) {
        alert("Error adding payment: " + data.error);
        return;
      }

      alert("Payment added successfully.");

      // ✅ Close modal + reset fields
      setShowPaymentModal(false);
      setPaymentDate("");
      setPaymentAmount("");
      setPaymentDirection("payment");
      setPaymentReference("");

      // ✅ Refresh CT summary
      fetchCorp(from, to);

    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    }
  }

  if (!session?.user) return null;

  return (
    <ResponsiveLayout currentPageName="Corporation Tax">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Corporation Tax</h1>

        {/* Controls */}
        <ResponsiveCard title="Select Accounting Year">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border p-2 rounded"
              disabled={result?.locked}
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border p-2 rounded"
              disabled={result?.locked}
            />
            <div className="flex gap-2">
              <button
                onClick={() => fetchCorp()}
                className="bg-blue-600 text-white rounded px-4 py-2"
                disabled={result?.locked || loading}
              >
                {loading ? "Loading…" : "Get Summary"}
              </button>
              {result && !result.locked && (
                <button
                  onClick={submitCorp}
                  className="bg-green-600 text-white px-4 py-2 rounded"
                  disabled={loading}
                >
                  {loading ? "Submitting…" : "Lock Period"}
                </button>
              )}
            </div>
          </div>
        </ResponsiveCard>

        {/* Results */}
        {result && (
          <>
            <ResponsiveCard title={`Summary ${result.locked ? "(Locked)" : ""}`}>
              <p><strong>Total Income:</strong> £{result.totalIncome.toFixed(2)}</p>
              <p><strong>Total Expenses:</strong> £{result.totalExpenses.toFixed(2)}</p>
              <p><strong>Profit:</strong> £{result.profit.toFixed(2)}</p>
              <p><strong>Estimated Tax (19%):</strong> £{result.taxLiability.toFixed(2)}</p>
            </ResponsiveCard>

            {/* ✅ CT Payments */}
            <ResponsiveCard title="Corporation Tax Payments">
              <p><strong>Total CT Due:</strong> £{result.totalCorpTaxDue.toFixed(2)}</p>
              <p><strong>Total Paid:</strong> £{result.totalCtPaid.toFixed(2)}</p>
              <p><strong>Balance:</strong> £{result.ctBalance.toFixed(2)}</p>

              <div className="mt-4">
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                  Add Payment
                </button>
              </div>
            </ResponsiveCard>

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
      </div>

      {/* ✅ Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md space-y-4">

            <h2 className="text-xl font-bold">Add Corporation Tax Payment</h2>

            <div className="space-y-2">
              <label className="block font-medium">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="border p-2 rounded w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="block font-medium">Amount (£)</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="border p-2 rounded w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="block font-medium">Direction</label>
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
              <label className="block font-medium">Reference (optional)</label>
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
                Save Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </ResponsiveLayout>
  );
}
