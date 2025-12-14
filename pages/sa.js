// pages/sa.js
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";

export default function SAPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) router.replace("/login");
  }, [session, status, router]);

  // Fetch SA summary
  async function fetchSA() {
    if (!from || !to) return alert("Please select both start and end dates.");
    setLoading(true);
    try {
      const res = await fetch("/api/sa/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: session.user.clientId, periodStart: from, periodEnd: to }),
      });
      const data = await res.json();
      setResult({ ...data, locked: false });
    } catch (err) {
      console.error(err);
      alert("Error fetching Self Assessment summary: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Lock SA tax year
  async function submitSA() {
    if (!from || !to) return alert("Please select both start and end dates.");
    if (!confirm("Submit this Self Assessment year? This will lock it.")) return;

    setLoading(true);
    try {
      const res = await fetch("/api/sa/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: session.user.clientId, periodStart: from, periodEnd: to }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Self Assessment period locked successfully.");
        setResult({ ...result, locked: true });
      } else {
        alert("Error submitting Self Assessment: " + data.error);
      }
    } catch (err) {
      console.error(err);
      alert("Submission failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!session?.user) return null;

  return (
    <ResponsiveLayout currentPageName="Self Assessment">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Self Assessment</h1>

        {/* Controls */}
        <ResponsiveCard title="Select Tax Year">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border p-2 rounded" disabled={result?.locked} />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border p-2 rounded" disabled={result?.locked} />
            <div className="flex gap-2">
              <button onClick={fetchSA} className="bg-blue-600 text-white rounded px-4 py-2" disabled={result?.locked || loading}>
                {loading ? "Loading…" : "Get Summary"}
              </button>
              {result && !result.locked && (
                <button onClick={submitSA} className="bg-green-600 text-white px-4 py-2 rounded" disabled={loading}>
                  {loading ? "Submitting…" : "Lock Year"}
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
              <p><strong>Estimated Tax (20%):</strong> £{result.taxLiability.toFixed(2)}</p>
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
    </ResponsiveLayout>
  );
}
