// pages/vat.js
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";

export default function VATPage() {
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

  // Fetch VAT summary
  async function fetchVAT() {
    if (!from || !to) return alert("Please select both start and end dates.");
    setLoading(true);

    try {
      const res = await fetch("/api/vat/summary", {
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
      alert("Error fetching VAT summary: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Submit VAT to HMRC
  async function submitVAT() {
    if (!from || !to) return alert("Please select both start and end dates.");
    if (!confirm("Submit this VAT period? This will lock the period.")) return;

    setLoading(true);
    try {
      const res = await fetch("/api/vat/submit", {
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
        alert("VAT submitted successfully. Period locked.");
        setResult({ ...result, locked: true, hmrcSubmission: data.hmrcResponse });
      } else {
        alert("Error submitting VAT: " + data.error);
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
    <ResponsiveLayout currentPageName="VAT Return">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">VAT Return (Making Tax Digital)</h1>

        {/* Controls */}
        <ResponsiveCard title="Select VAT Period">
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
                onClick={fetchVAT}
                className="bg-blue-600 text-white rounded px-4 py-2"
                disabled={result?.locked || loading}
              >
                {loading ? "Loading…" : "Get VAT Summary"}
              </button>
              {result && !result.locked && (
                <button
                  onClick={submitVAT}
                  className="bg-green-600 text-white px-4 py-2 rounded"
                  disabled={loading}
                >
                  {loading ? "Submitting…" : "Submit to HMRC"}
                </button>
              )}
            </div>
          </div>
        </ResponsiveCard>

        {/* Results */}
        {result && (
          <>
            <ResponsiveCard title={`VAT Boxes ${result.locked ? "(Locked)" : ""}`}>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="border p-2">Box</th>
                    <th className="border p-2">Amount (£)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.boxes).map(([box, value]) => (
                    <tr key={box}>
                      <td className="border p-2">{box}</td>
                      <td className="border p-2">{Number(value).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveCard>

            <ResponsiveCard title={`Transactions Included ${result.locked ? "(Locked)" : ""}`}>
              <ResponsiveTable
                columns={[
                  { header: "Date", accessor: "date" },
                  { header: "Description", accessor: "description" },
                  { header: "Amount (£)", accessor: "amount" },
                  { header: "VAT Amount (£)", accessor: "vat_amount" },
                  { header: "VAT Rate (%)", accessor: "vat_rate" },
                ]}
                data={result.transactions}
              />
            </ResponsiveCard>

            {/* HMRC Submission Info */}
            {result.hmrcSubmission && (
              <ResponsiveCard title="HMRC Submission">
                <div className="space-y-2">
                  <p><strong>Submission ID / Date:</strong> {result.hmrcSubmission.processingDate || "N/A"}</p>
                  <p><strong>Status:</strong> {result.hmrcSubmission.status || "Submitted"}</p>
                  <pre className="bg-gray-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(result.hmrcSubmission, null, 2)}
                  </pre>
                </div>
              </ResponsiveCard>
            )}
          </>
        )}
      </div>
    </ResponsiveLayout>
  );
}
