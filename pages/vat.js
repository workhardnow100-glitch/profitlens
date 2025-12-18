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

  // ✅ VAT Stagger state
  const [vatStagger, setVatStagger] = useState(null);

  // ✅ VAT adjustment draft state
  const [newAdj, setNewAdj] = useState({ box: 1, amount: "", reason: "" });

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) router.replace("/login");
  }, [session, status, router]);

  // ✅ Load VAT stagger from Tax Hub API
  useEffect(() => {
    async function loadStagger() {
      if (!session?.user) return;

      try {
        const res = await fetch("/api/tax-hub/periods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: session.user.clientId }),
        });

        const data = await res.json();
        if (data.vatStagger) setVatStagger(data.vatStagger);
      } catch (err) {
        console.error("Error loading VAT stagger:", err);
      }
    }

    loadStagger();
  }, [session]);

  // ✅ Fetch VAT summary (uses new HMRC-shaped API)
  async function fetchVAT(customFrom, customTo) {
    const start = customFrom || from;
    const end = customTo || to;

    if (!start || !end) {
      alert("Please select both start and end dates.");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/vat/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.clientId,
          periodStart: start,
          periodEnd: end,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch VAT summary");
      }

      // ✅ Keep API's locked/submitted/status as source of truth
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Error fetching VAT summary: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // 🚧 Submit VAT to HMRC (placeholder until HMRC APIs wired)
  async function submitVAT() {
    if (!from || !to) {
      alert("Please select both start and end dates.");
      return;
    }
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
        setResult((prev) =>
          prev
            ? {
                ...prev,
                locked: true,
                submitted: true,
                status: "filed",
                hmrcSubmission: data.hmrcResponse || prev.hmrcSubmission,
              }
            : prev
        );
      } else {
        alert("Error submitting VAT: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Submission failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ✅ Add VAT adjustment
  async function addAdjustment() {
    if (!result) return;
    if (!newAdj.amount) {
      alert("Enter an amount for the adjustment.");
      return;
    }

    try {
      const res = await fetch("/api/vat/adjustment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.clientId,
          vatPeriodId: result.vatPeriodId,
          box: Number(newAdj.box),
          amount: Number(newAdj.amount),
          reason: newAdj.reason,
          userId: session.user.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add adjustment");

      // ✅ Re-fetch VAT summary to update boxes + adjustment list
      await fetchVAT(from, to);


      // Reset form
      setNewAdj({ box: 1, amount: "", reason: "" });
    } catch (err) {
      console.error(err);
      alert("Error adding adjustment: " + err.message);
    }
  }

  if (!session?.user) return null;

  const locked = result?.locked;
  const statusLabel = result
    ? `${result.status || "draft"}${result.submitted ? " (submitted)" : ""}`
    : "";

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
              disabled={locked}
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border p-2 rounded"
              disabled={locked}
            />
            <div className="flex gap-2">
              <button
                onClick={() => fetchVAT()}
                className="bg-blue-600 text-white rounded px-4 py-2"
                disabled={locked || loading}
              >
                {loading ? "Loading…" : "Get VAT Summary"}
              </button>
              {result && !locked && (
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

          {result && (
            <p className="mt-2 text-sm text-gray-600">
              Period: {result.period} • Status: {statusLabel}
            </p>
          )}
        </ResponsiveCard>

        {/* ✅ VAT STAGGER BADGE */}
        {vatStagger && (
          <div className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm font-medium">
            VAT Stagger: {vatStagger}
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Draft VAT Return Snapshot (print-style summary) */}
            <ResponsiveCard
              title={`Draft VAT Return Summary ${locked ? "(Locked)" : ""}`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p>
                    <span className="font-semibold">Box 1 – VAT due on sales:</span>{" "}
                    £{Number(result.boxes?.box1 || 0).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">Box 2 – VAT due on acquisitions:</span>{" "}
                    £{Number(result.boxes?.box2 || 0).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">Box 3 – Total VAT due (1 + 2):</span>{" "}
                    £{Number(result.boxes?.box3 || 0).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">Box 4 – VAT reclaimed on purchases:</span>{" "}
                    £{Number(result.boxes?.box4 || 0).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">Box 5 – Net VAT to pay (3 − 4):</span>{" "}
                    £{Number(result.boxes?.box5 || 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p>
                    <span className="font-semibold">Box 6 – Total sales (net):</span>{" "}
                    £{Number(result.boxes?.box6 || 0).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">Box 7 – Total purchases (net):</span>{" "}
                    £{Number(result.boxes?.box7 || 0).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">Box 8 – EU supplies (net):</span>{" "}
                    £{Number(result.boxes?.box8 || 0).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">Box 9 – EU acquisitions (net):</span>{" "}
                    £{Number(result.boxes?.box9 || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </ResponsiveCard>

            {/* Raw VAT Boxes Table (for detailed review) */}
            <ResponsiveCard
              title={`VAT Boxes Detail ${locked ? "(Locked)" : ""}`}
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr>
                    <th className="border p-2">Box</th>
                    <th className="border p-2">Amount (£)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.boxes || {}).map(([box, value]) => (
                    <tr key={box}>
                      <td className="border p-2">{box}</td>
                      <td className="border p-2">
                        {Number(value || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveCard>

            {/* ✅ VAT Adjustments (Collapsible Master Panel) */}
            <ResponsiveCard title="VAT Adjustments">
              <details className="group">
                <summary className="cursor-pointer text-lg font-semibold text-blue-700 group-open:text-blue-900">
                  Adjustments (click to expand)
                </summary>

                <div className="mt-4 space-y-4">
                  {/* Add Adjustment Form */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <select
                      value={newAdj.box}
                      onChange={(e) =>
                        setNewAdj((prev) => ({
                          ...prev,
                          box: Number(e.target.value),
                        }))
                      }
                      className="border p-2 rounded"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((b) => (
                        <option key={b} value={b}>
                          Box {b}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      step="0.01"
                      value={newAdj.amount}
                      onChange={(e) =>
                        setNewAdj((prev) => ({
                          ...prev,
                          amount: e.target.value,
                        }))
                      }
                      placeholder="Amount"
                      className="border p-2 rounded"
                    />

                    <input
                      type="text"
                      value={newAdj.reason}
                      onChange={(e) =>
                        setNewAdj((prev) => ({
                          ...prev,
                          reason: e.target.value,
                        }))
                      }
                      placeholder="Reason"
                      className="border p-2 rounded"
                    />

                    <button
                      onClick={addAdjustment}
                      className="bg-green-600 text-white rounded px-4 py-2"
                    >
                      Add Adjustment
                    </button>
                  </div>

                  {/* Adjustment List */}
                  {result.adjustments && result.adjustments.length > 0 ? (
                    <ResponsiveTable
                      columns={[
                        { header: "Box", accessor: "box" },
                        { header: "Amount (£)", accessor: "amount" },
                        { header: "Reason", accessor: "reason" },
                        { header: "Created At", accessor: "created_at" },
                      ]}
                      data={result.adjustments}
                    />
                  ) : (
                    <p className="text-sm text-gray-600">
                      No adjustments for this period.
                    </p>
                  )}
                </div>
              </details>
            </ResponsiveCard>

            {/* VAT Transactions */}
            <ResponsiveCard
              title={`Transactions Included ${locked ? "(Locked)" : ""}`}
            >
              <ResponsiveTable
                columns={[
                  { header: "Date", accessor: "date" },
                  { header: "Description", accessor: "description" },
                  { header: "Amount (£)", accessor: "amount" },
                  { header: "VAT Amount (£)", accessor: "vat_amount" },
                  { header: "VAT Rate (%)", accessor: "vat_rate" },
                ]}
                data={result.transactions || []}
              />
            </ResponsiveCard>

            {/* HMRC Submission Info (future real integration) */}
            {result.hmrcSubmission && (
              <ResponsiveCard title="HMRC Submission">
                <div className="space-y-2">
                  <p>
                    <strong>Submission date:</strong>{" "}
                    {result.hmrcSubmission.processingDate || "N/A"}
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    {result.hmrcSubmission.status || "Submitted"}
                  </p>
                  <pre className="bg-gray-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(result.hmrcSubmission, null, 2)}
                  </pre>
                </div>
              </ResponsiveCard>
             )}
          </>
        )}
      </div>

      {/* ✅ Filing Disclaimer (Strong Version for HMRC Submission Pages) */}
      <p className="text-xs text-slate-500 mt-8 text-center max-w-2xl mx-auto">
        ProfitLens does not provide tax advice. All calculations are estimates
        only. Users are solely responsible for verifying all figures and
        ensuring accuracy before submitting any tax filings to HMRC.
      </p>

    </ResponsiveLayout>
  );
}
