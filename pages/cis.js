// pages/cis.js
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";

export default function CISPage() {
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

  // Fetch CIS summary
  async function fetchCIS() {
    if (!from || !to) return alert("Please select both start and end dates.");
    setLoading(true);
    try {
      const res = await fetch("/api/cis/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.clientId,
          periodStart: from,
          periodEnd: to,
        }),
      });
      const data = await res.json();
      setResult({ ...data, locked: false });
    } catch (err) {
      console.error(err);
      alert("Error fetching CIS summary: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Lock CIS period (similar to VAT)
  async function submitCIS() {
    if (!from || !to) return alert("Please select both start and end dates.");
    if (!confirm("Submit this CIS period? This will lock the period.")) return;

    setLoading(true);
    try {
      const res = await fetch("/api/cis/submit", { // optional HMRC submission
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.clientId,
          periodStart: from,
          periodEnd: to,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert("CIS submitted successfully. Period locked.");
        setResult({ ...result, locked: true });
      } else {
        alert("Error submitting CIS: " + data.error);
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
    <ResponsiveLayout currentPageName="CIS">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">CIS Return</h1>

        {/* Controls */}
        <ResponsiveCard title="Select Period">
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
                onClick={fetchCIS}
                className="bg-blue-600 text-white rounded px-4 py-2"
                disabled={result?.locked || loading}
              >
                {loading ? "Loading…" : "Get CIS Summary"}
              </button>
              {result && !result.locked && (
                <button
                  onClick={submitCIS}
                  className="bg-green-600 text-white px-4 py-2 rounded"
                  disabled={loading}
                >
                  {loading ? "Submitting…" : "Submit CIS"}
                </button>
              )}
            </div>
          </div>
        </ResponsiveCard>

        {/* Results */}
        {result && (
          <>
            <ResponsiveCard title={`CIS Summary ${result.locked ? "(Locked)" : ""}`}>
              <p><strong>Total Gross Payments:</strong> £{result.totalGross.toFixed(2)}</p>
              <p><strong>Total CIS Deducted:</strong> £{result.totalCIS.toFixed(2)}</p>
            </ResponsiveCard>

            <ResponsiveCard title={`Transactions ${result.locked ? "(Locked)" : ""}`}>
              <ResponsiveTable
                columns={[
                  { header: "Date", accessor: "date" },
                  { header: "Description", accessor: "description" },
                  { header: "Amount (£)", accessor: "amount" },
                  { header: "CIS Amount (£)", accessor: "cis_amount" },
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
