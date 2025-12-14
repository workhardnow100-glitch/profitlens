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

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) router.replace("/login");
  }, [session, status, router]);

  // Fetch Corporation Tax summary
  async function fetchCorp() {
    if (!from || !to) return alert("Please select both start and end dates.");
    setLoading(true);
    try {
      const res = await fetch("/api/corp/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: session.user.clientId, periodStart: from, periodEnd: to })
      });
      const data = await res.json();
      setResult({ ...data, locked: false });
    } catch (err) {
      console.error(err);
      alert("Error fetching Corporation Tax summary: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Lock accounting year
  async function submitCorp() {
    if (!from || !to) return alert("Please select both start and end dates.");
    if (!confirm("Submit this Corporation Tax period? This will lock it.")) return;

    setLoading(true);
    try {
      const res = await fetch("/api/corp/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: session.user.clientId, periodStart: from, periodEnd: to })
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
              <button onClick={fetchCorp} className="bg-blue-600 text-white rounded px-4 py-2" disabled={result?.locked || loading}>
                {loading ? "Loading…" : "Get Summary"}
              </button>
              {result && !result.locked && (
                <button onClick={submitCorp} className="bg-green-600 text-white px-4 py-2 rounded" disabled={loading}>
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
