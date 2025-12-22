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

  const [vatStagger, setVatStagger] = useState(null);

  const [newAdj, setNewAdj] = useState({ box: 1, amount: "", reason: "" });

  const [submissionId, setSubmissionId] = useState(null);
  const [mtdSubmitting, setMtdSubmitting] = useState(false);
  const [mtdValidating, setMtdValidating] = useState(false);

  const [vatOverview, setVatOverview] = useState(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) router.replace("/login");
  }, [session, status, router]);

  useEffect(() => {
    if (!router.isReady) return;
    const qFrom = router.query.from;
    const qTo = router.query.to;

    if (qFrom && qTo) {
      setFrom(qFrom);
      setTo(qTo);
      fetchVAT(qFrom, qTo);
    }
  }, [router.isReady, router.query]);

  useEffect(() => {
    async function loadStaggerAndOverview() {
      if (!session?.user) return;

      try {
        const res = await fetch("/api/tax-hub/periods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId: session.user.clientId }),
        });

        const data = await res.json();
        if (data.vatStagger) setVatStagger(data.vatStagger);
        setVatOverview(data);
      } catch (err) {
        console.error("Error loading VAT overview:", err);
      }
    }

    loadStaggerAndOverview();
  }, [session]);

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
      if (!res.ok) throw new Error(data.error || "Failed to fetch VAT summary");

      setResult(data);
      setSubmissionId(null);
    } catch (err) {
      console.error(err);
      alert("Error fetching VAT summary: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function validateMTD() {
    if (!from || !to) {
      alert("Please select both start and end dates.");
      return;
    }
    if (!result) {
      alert("Load the VAT summary first.");
      return;
    }

    setMtdValidating(true);
    try {
      const res = await fetch("/api/mtd/vat/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.clientId,
          periodStart: from,
          periodEnd: to,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to validate VAT return");

      if (!data.submissionId) throw new Error("No submissionId returned");

      setSubmissionId(data.submissionId);

      if (data.summary) setResult(data.summary);

      alert("VAT return validated for MTD. You can now submit to HMRC.");
    } catch (err) {
      console.error(err);
      alert("Error validating VAT return: " + err.message);
    } finally {
      setMtdValidating(false);
    }
  }

  async function submitVAT() {
    if (!submissionId) {
      alert("Please validate the VAT return for MTD first.");
      return;
    }
    if (!confirm("Submit this VAT period to HMRC? This will lock the period.")) {
      return;
    }

    setMtdSubmitting(true);
    try {
      const res = await fetch("/api/mtd/vat/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error || "HMRC submission failed");

      alert("VAT submitted to HMRC successfully. Period locked.");

      setResult((prev) =>
        prev
          ? {
              ...prev,
              locked: true,
              submitted: true,
              status: "submitted",
              hmrcReference: data.hmrcReference,
              processingDate: data.processingDate,
              hmrcSubmission: data.hmrcResponse,
            }
          : prev
      );
    } catch (err) {
      console.error(err);
      alert("Submission failed: " + err.message);
    } finally {
      setMtdSubmitting(false);
    }
  }

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

      await fetchVAT(from, to);
      setNewAdj({ box: 1, amount: "", reason: "" });
    } catch (err) {
      console.error(err);
      alert("Error adding adjustment: " + err.message);
    }
  }

  async function downloadReceipt() {
    if (!result?.submitted) {
      alert("HMRC receipt is only available after submission.");
      return;
    }
    if (!from || !to) {
      alert("Missing VAT period dates.");
      return;
    }

    try {
      const res = await fetch("/api/mtd/vat/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.clientId,
          periodStart: from,
          periodEnd: to,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate HMRC receipt");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `VAT-Receipt-${from}-to-${to}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Error downloading HMRC receipt: " + err.message);
    }
  }

  let currentVatPeriod = null;
  let previousVatPeriod = null;
  let periodPayments = [];
  let periodPaymentsTotal = 0;

  if (vatOverview?.vat && from && to) {
    const vatPeriods = vatOverview.vat;
    const idx = vatPeriods.findIndex(
      (p) => p.periodStart === from && p.periodEnd === to
    );
    if (idx !== -1) {
      currentVatPeriod = vatPeriods[idx];
      if (idx + 1 < vatPeriods.length) {
        previousVatPeriod = vatPeriods[idx + 1];
      }
    }
  }

  if (vatOverview?.vatPayments && from && to) {
    const startDate = new Date(from);
    const endDate = new Date(to);
    periodPayments = vatOverview.vatPayments.filter((p) => {
      if (!p.payment_date) return false;
      const d = new Date(p.payment_date);
      return d >= startDate && d <= endDate;
    });

    periodPaymentsTotal = periodPayments.reduce((sum, p) => {
      const amount = Number(p.amount || 0);
      return sum + (p.direction === "payment" ? amount : -amount);
    }, 0);
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

        {/* Back to Tax Hub */}
        <button
          onClick={() => router.push("/tax-hub")}
          className="bg-gray-200 text-gray-800 px-3 py-1 rounded text-sm"
        >
          ← Back to Tax Hub
        </button>

        {/* HMRC Authorisation */}
        {!vatOverview?.hmrcConnected && (
          <div className="mt-4">
            <button
              onClick={() =>
                (window.location.href = `/api/hmrc/oauth/start?clientId=${session.user.clientId}`)
              }
              className="bg-purple-600 text-white px-4 py-2 rounded"
            >
              Authorise HMRC (Required for MTD)
            </button>

            <p className="text-sm text-gray-600 mt-1">
              You must authorise HMRC before validating or submitting VAT returns.
            </p>
          </div>
        )}

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

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => fetchVAT()}
                className="bg-blue-600 text-white rounded px-4 py-2"
                disabled={locked || loading}
              >
                {loading ? "Loading…" : "Get VAT Summary"}
              </button>

              {result && !locked && (
                <>
                  <button
                    onClick={validateMTD}
                    className="bg-yellow-500 text-white px-4 py-2 rounded"
                    disabled={mtdValidating || mtdSubmitting}
                  >
                    {mtdValidating ? "Validating…" : "Validate VAT (MTD)"}
                  </button>

                  <button
                    onClick={submitVAT}
                    className="bg-green-600 text-white px-4 py-2 rounded"
                    disabled={mtdSubmitting || !submissionId}
                    title={
                      submissionId
                        ? ""
                        : "Validate the VAT return for MTD before submitting"
                    }
                  >
                    {mtdSubmitting ? "Submitting…" : "Submit to HMRC (MTD)"}
                  </button>
                </>
              )}
            </div>
          </div>

          {result && (
            <p className="mt-2 text-sm text-gray-600">
              Period: {result.period} • Status: {statusLabel}
              {submissionId && !locked && (
                <> • MTD: validated (submission id: {submissionId})</>
              )}
            </p>
          )}
        </ResponsiveCard>

        {vatStagger && (
          <div className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm font-medium">
            VAT Stagger: {vatStagger}
          </div>
        )}

        {result && (
          <>
            {(result.hmrcReference || result.processingDate || result.submitted) && (
              <ResponsiveCard title="HMRC Submission Details">
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>HMRC Reference:</strong>{" "}
                    {result.hmrcReference || "N/A"}
                  </p>
                  <p>
                    <strong>Processing Date:</strong>{" "}
                    {result.processingDate || "N/A"}
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    {result.submitted ? "Submitted (MTD)" : "Not Submitted"}
                  </p>
                  <button
                    onClick={downloadReceipt}
                    className="bg-blue-600 text-white px-4 py-2 rounded mt-2"
                    disabled={!result.submitted}
                  >
                    Download HMRC Receipt (PDF)
                  </button>
                </div>
              </ResponsiveCard>
            )}

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

            <ResponsiveCard title="Compare With Previous Period">
              {currentVatPeriod ? (
                <div className="text-sm space-y-2">
                  <p className="font-semibold">
                    Current period: {currentVatPeriod.periodLabel}
                  </p>
                  <p>
                    Net VAT (current): £
                    {Number(
                      currentVatPeriod.netVat ??
                        result.boxes?.box5 ??
                        0
                    ).toFixed(2)}
                  </p>

                  {previousVatPeriod ? (
                    <>
                      <p className="font-semibold mt-2">
                        Previous period: {previousVatPeriod.periodLabel}
                      </p>
                      <p>
                        Net VAT (previous): £
                        {Number(previousVatPeriod.netVat || 0).toFixed(2)}
                      </p>
                      <p className="mt-2">
                        Change: £
                        {Number(
                          (currentVatPeriod.netVat || 0) -
                            (previousVatPeriod.netVat || 0)
                        ).toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-600">
                      No previous VAT period found in Tax Hub.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  This period is not yet visible in Tax Hub VAT periods.
                </p>
              )}
            </ResponsiveCard>

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

            {/* VAT Adjustments */}
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

            {/* VAT Payments & Reconciliation */}
            <ResponsiveCard title="VAT Payments & Reconciliation">
              {currentVatPeriod ? (
                <div className="space-y-3 text-sm">
                  <p>
                    <strong>Net VAT due for this period:</strong>{" "}
                    £{Number(currentVatPeriod.netVat || 0).toFixed(2)}
                  </p>
                  <p>
                    <strong>Total VAT payments in this period:</strong>{" "}
                    £{Number(periodPaymentsTotal || 0).toFixed(2)}
                  </p>
                  <p>
                    <strong>Difference:</strong>{" "}
                    £{Number(
                      (currentVatPeriod.netVat || 0) - (periodPaymentsTotal || 0)
                    ).toFixed(2)}
                  </p>

                  {periodPayments.length > 0 ? (
                    <ResponsiveTable
                      columns={[
                        { header: "Date", accessor: "payment_date" },
                        { header: "Direction", accessor: "direction" },
                        { header: "Amount (£)", accessor: "amount" },
                        { header: "Reference", accessor: "reference" },
                      ]}
                      data={periodPayments}
                    />
                  ) : (
                    <p className="text-gray-600">
                      No VAT payments recorded for this period.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600">
                  This period is not yet visible in Tax Hub VAT periods, so
                  reconciliation is not available.
                </p>
              )}
            </ResponsiveCard>

            {/* HMRC Submission Info (raw JSON) */}
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

      {/* Filing Disclaimer */}
      <p className="text-xs text-slate-500 mt-8 text-center max-w-2xl mx-auto">
        ProfitLens does not provide tax advice. All calculations are estimates
        only. Users are solely responsible for verifying all figures and
        ensuring accuracy before submitting any tax filings to HMRC.
      </p>
    </ResponsiveLayout>
  );
}

