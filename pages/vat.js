// pages/vat.js
import { useState, useEffect } from "react";
import { useRouter } from "next/router";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";
import useUser from "../hooks/useUser";

export default function VATPage() {
  const router = useRouter();
  const { user, loadingUser } = useUser();

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

  // HMRC obligations + returns
  const [hmrcObligations, setHmrcObligations] = useState([]);
  const [hmrcReturns, setHmrcReturns] = useState([]);
  const [loadingObligations, setLoadingObligations] = useState(false);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [obligationsError, setObligationsError] = useState(null);
  const [returnsError, setReturnsError] = useState(null);

  // VAT MTD extra data (HMRC)
  const [vatStatus, setVatStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusError, setStatusError] = useState(null);

  const [vatLiabilities, setVatLiabilities] = useState(null);
  const [loadingLiabilities, setLoadingLiabilities] = useState(false);
  const [liabilitiesError, setLiabilitiesError] = useState(null);

  const [vatPayments, setVatPayments] = useState(null);
  const [loadingVatPayments, setLoadingVatPayments] = useState(false);
  const [paymentsError, setPaymentsError] = useState(null);

  const [vatPeriods, setVatPeriods] = useState(null);
  const [loadingPeriods, setLoadingPeriods] = useState(false);
  const [periodsError, setPeriodsError] = useState(null);

  const [receiptSubmissionId, setReceiptSubmissionId] = useState("");
  const [vatReceipt, setVatReceipt] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState(null);

  // ---------------------------------------------------------
  // CLIENT RESOLUTION (same pattern as Tax Hub)
  // ---------------------------------------------------------
  const clientId = user?.actingAsClientId ?? user?.clientId;

  // ---------------------------------------------------------
  // AUTH GUARD
  // ---------------------------------------------------------
  useEffect(() => {
    if (loadingUser) return;
    if (!user) {
      router.replace("/login");
    }
  }, [user, loadingUser, router]);

  // While user is loading, avoid rendering the page
  if (loadingUser) {
    return null;
  }

  if (!user) {
    return null;
  }

  // ---------------------------------------------------------
  // AUTO‑LOAD PERIOD IF COMING FROM TAX HUB
  // ---------------------------------------------------------
  useEffect(() => {
    if (!router.isReady) return;
    const qFrom = router.query.from;
    const qTo = router.query.to;

    if (qFrom && qTo) {
      setFrom(qFrom);
      setTo(qTo);
      // We can trigger immediately; fetchVAT will use current clientId
      fetchVAT(qFrom, qTo);
    }
  }, [router.isReady, router.query]); // clientId is stable enough; no need to depend

  // ---------------------------------------------------------
  // LOAD VAT STAGGER + VAT OVERVIEW + HMRC DATA
  // ---------------------------------------------------------
  useEffect(() => {
    if (!clientId) return;

    async function loadStaggerAndOverview() {
      try {
        const res = await fetch("/api/tax-hub/periods", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId }),
        });

        const data = await res.json().catch(() => null);
        if (!data) return;

        if (data.vatStagger) setVatStagger(data.vatStagger);
        setVatOverview(data);
      } catch (err) {
        console.error("Error loading VAT overview:", err);
      }
    }

    loadStaggerAndOverview();
    loadObligations();
    loadReturns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // ---------------------------------------------------------
  // LOAD HMRC OBLIGATIONS
  // ---------------------------------------------------------
  async function loadObligations() {
    if (!clientId) return;
    setLoadingObligations(true);
    setObligationsError(null);

    try {
      const res = await fetch("/api/mtd/vat/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          (data && data.error) ||
          "Failed to load obligations from HMRC (test mode or not authorised).";
        setObligationsError(msg);
        setHmrcObligations([]);
        return;
      }

      if (data?.obligations?.obligations) {
        setHmrcObligations(data.obligations.obligations);
      } else {
        setHmrcObligations([]);
      }
    } catch (err) {
      console.error("Error loading obligations:", err);
      setObligationsError("Error loading obligations from HMRC.");
      setHmrcObligations([]);
    } finally {
      setLoadingObligations(false);
    }
  }

  // ---------------------------------------------------------
  // LOAD HMRC RETURNS
  // ---------------------------------------------------------
  async function loadReturns() {
    if (!clientId) return;
    setLoadingReturns(true);
    setReturnsError(null);

    try {
      const res = await fetch("/api/mtd/vat/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          (data && data.error) ||
          "Failed to load VAT returns from HMRC (test mode or not authorised).";
        setReturnsError(msg);
        setHmrcReturns([]);
        return;
      }

      if (data?.returns?.returns) {
        setHmrcReturns(data.returns.returns);
      } else {
        setHmrcReturns([]);
      }
    } catch (err) {
      console.error("Error loading returns:", err);
      setReturnsError("Error loading VAT returns from HMRC.");
      setHmrcReturns([]);
    } finally {
      setLoadingReturns(false);
    }
  }

  // ---------------------------------------------------------
  // LOAD VAT MTD CONNECTION STATUS
  // ---------------------------------------------------------
  async function loadVatStatus() {
    if (!clientId) return;
    setLoadingStatus(true);
    setStatusError(null);

    try {
      const res = await fetch("/api/mtd/vat/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (data && data.error) || "Failed to load VAT MTD connection status"
        );
      }
      setVatStatus(data.status || null);
    } catch (err) {
      console.error("Error loading VAT status:", err);
      setVatStatus(null);
      setStatusError(err.message || "Failed to load VAT MTD connection status");
    } finally {
      setLoadingStatus(false);
    }
  }

  // ---------------------------------------------------------
  // LOAD HMRC VAT LIABILITIES
  // ---------------------------------------------------------
  async function loadVatLiabilities() {
    if (!clientId) return;
    setLoadingLiabilities(true);
    setLiabilitiesError(null);

    try {
      const res = await fetch("/api/mtd/vat/get-liabilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (data && data.error) || "Failed to load VAT liabilities"
        );
      }
      setVatLiabilities(data.liabilities || null);
    } catch (err) {
      console.error("Error loading VAT liabilities:", err);
      setVatLiabilities(null);
      setLiabilitiesError(
        err.message || "Failed to load VAT liabilities from HMRC."
      );
    } finally {
      setLoadingLiabilities(false);
    }
  }

  // ---------------------------------------------------------
  // LOAD HMRC VAT PAYMENTS
  // ---------------------------------------------------------
  async function loadVatPayments() {
    if (!clientId) return;
    setLoadingVatPayments(true);
    setPaymentsError(null);

    try {
      const res = await fetch("/api/mtd/vat/get-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (data && data.error) || "Failed to load VAT payments from HMRC"
        );
      }
      setVatPayments(data.payments || null);
    } catch (err) {
      console.error("Error loading VAT payments:", err);
      setVatPayments(null);
      setPaymentsError(
        err.message || "Failed to load VAT payments from HMRC."
      );
    } finally {
      setLoadingVatPayments(false);
    }
  }

  // ---------------------------------------------------------
  // LOAD HMRC VAT PERIODS
  // ---------------------------------------------------------
  async function loadVatPeriods() {
    if (!clientId) return;
    setLoadingPeriods(true);
    setPeriodsError(null);

    try {
      const res = await fetch("/api/mtd/vat/get-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (data && data.error) || "Failed to load VAT periods from HMRC"
        );
      }
      setVatPeriods(data.periods || null);
    } catch (err) {
      console.error("Error loading VAT periods:", err);
      setVatPeriods(null);
      setPeriodsError(
        err.message || "Failed to load VAT periods from HMRC."
      );
    } finally {
      setLoadingPeriods(false);
    }
  }

  // ---------------------------------------------------------
  // LOAD HMRC VAT RECEIPT (JSON VIEW)
  // ---------------------------------------------------------
  async function loadVatReceipt() {
    setReceiptError(null);
    setVatReceipt(null);

    if (!receiptSubmissionId) {
      setReceiptError("Enter a submissionId first.");
      return;
    }

    if (!clientId) {
      setReceiptError("No client selected for receipt lookup.");
      return;
    }

    setLoadingReceipt(true);
    try {
      const res = await fetch("/api/mtd/vat/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          submissionId: receiptSubmissionId,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          (data && data.error) || "Failed to load HMRC VAT receipt"
        );
      }

      setVatReceipt(data || null);
    } catch (err) {
      console.error("Error loading VAT receipt:", err);
      setReceiptError(err.message || "Failed to load HMRC VAT receipt.");
    } finally {
      setLoadingReceipt(false);
    }
  }

  // ---------------------------------------------------------
  // SAVE VAT NUMBER
  // ---------------------------------------------------------
  async function saveVatNumber() {
    if (!vatOverview?.tempVatNumber) {
      alert("Please enter a VAT number.");
      return;
    }

    if (!clientId) {
      alert("No client selected.");
      return;
    }

    try {
      const res = await fetch("/api/tax-hub/save-vat-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          vatNumber: vatOverview.tempVatNumber,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to save VAT number");

      alert("VAT number saved successfully.");

      setVatOverview((prev) => ({
        ...(prev || {}),
        vat_number: vatOverview.tempVatNumber,
      }));
    } catch (err) {
      alert(err.message || "Failed to save VAT number.");
    }
  }

  // ---------------------------------------------------------
  // FETCH VAT SUMMARY
  // ---------------------------------------------------------
  async function fetchVAT(customFrom, customTo) {
    const start = customFrom || from;
    const end = customTo || to;

    if (!start || !end) {
      alert("Please select both start and end dates.");
      return;
    }
    if (!clientId) {
      alert("No client selected.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/vat/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          periodStart: start,
          periodEnd: end,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to fetch VAT summary");
      }

      setResult(data);
      setSubmissionId(null);
    } catch (err) {
      console.error(err);
      alert("Error fetching VAT summary: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------
  // VALIDATE VAT (MTD)
  // ---------------------------------------------------------
  async function validateMTD() {
    if (!from || !to) {
      alert("Please select both start and end dates.");
      return;
    }
    if (!result) {
      alert("Load the VAT summary first.");
      return;
    }
    if (!clientId) {
      alert("No client selected.");
      return;
    }

    setMtdValidating(true);
    try {
      const res = await fetch("/api/mtd/vat/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          periodStart: from,
          periodEnd: to,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to validate VAT return");
      }

      if (!data?.submissionId) throw new Error("No submissionId returned");

      setSubmissionId(data.submissionId);

      if (data.summary) setResult(data.summary);

      alert("VAT return validated for MTD. You can now submit to HMRC.");
    } catch (err) {
      console.error(err);
      alert("Error validating VAT return: " + (err.message || "Unknown error"));
    } finally {
      setMtdValidating(false);
    }
  }

  // ---------------------------------------------------------
  // SUBMIT VAT (MTD)
  // ---------------------------------------------------------
  async function submitVAT() {
    if (!submissionId) {
      alert("Please validate the VAT return for MTD first.");
      return;
    }
    if (!clientId) {
      alert("No client selected.");
      return;
    }
    if (
      !confirm(
        "Submit this VAT period to HMRC? This will lock the period for this client."
      )
    ) {
      return;
    }

    setMtdSubmitting(true);
    try {
      const res = await fetch("/api/mtd/vat/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, submissionId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "HMRC submission failed");
      }

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
      alert("Submission failed: " + (err.message || "Unknown error"));
    } finally {
      setMtdSubmitting(false);
    }
  }

  // ---------------------------------------------------------
  // ADD ADJUSTMENT
  // ---------------------------------------------------------
  async function addAdjustment() {
    if (!result) return;
    if (!newAdj.amount) {
      alert("Enter an amount for the adjustment.");
      return;
    }
    if (!clientId) {
      alert("No client selected.");
      return;
    }

    try {
      const res = await fetch("/api/vat/adjustment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId, // FIXED typo: was "cliclientId"
          vatPeriodId: result.vatPeriodId,
          box: Number(newAdj.box),
          amount: Number(newAdj.amount),
          reason: newAdj.reason,
          userId: user.id,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to add adjustment");

      await fetchVAT(from, to);
      setNewAdj({ box: 1, amount: "", reason: "" });
    } catch (err) {
      console.error(err);
      alert("Error adding adjustment: " + (err.message || "Unknown error"));
    }
  }

  // ---------------------------------------------------------
  // DOWNLOAD HMRC RECEIPT (PDF)
  // ---------------------------------------------------------
  async function downloadReceipt(customStart, customEnd) {
    const start = customStart || from;
    const end = customEnd || to;

    if (!result?.submitted) {
      alert("HMRC receipt is only available after submission.");
      return;
    }
    if (!start || !end) {
      alert("Missing VAT period dates.");
      return;
    }
    if (!clientId) {
      alert("No client selected.");
      return;
    }

    try {
      const res = await fetch("/api/mtd/vat/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          periodStart: start,
          periodEnd: end,
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
      a.download = `VAT-Receipt-${start}-to-${end}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Error downloading HMRC receipt: " + (err.message || "Unknown error"));
    }
  }

  // ---------------------------------------------------------
  // PERIOD + PAYMENTS
  // ---------------------------------------------------------
  let currentVatPeriod = null;
  let previousVatPeriod = null;
  let periodPayments = [];
  let periodPaymentsTotal = 0;

  if (vatOverview?.vat && from && to) {
    const vatPeriodsList = vatOverview.vat;
    const idx = vatPeriodsList.findIndex(
      (p) => p.periodStart === from && p.periodEnd === to
    );
    if (idx !== -1) {
      currentVatPeriod = vatPeriodsList[idx];
      if (idx + 1 < vatPeriodsList.length) {
        previousVatPeriod = vatPeriodsList[idx + 1];
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

  const locked = result?.locked;
  const statusLabel = result
    ? `${result.status || "draft"}${result.submitted ? " (submitted)" : ""}`
    : "";

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------
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

        {/* VAT Number Input */}
        {!vatOverview?.vat_number && (
          <div className="mt-4 p-4 border rounded bg-yellow-50">
            <label className="block text-sm font-medium mb-2">
              VAT Number (VRN)
            </label>

            <input
              type="text"
              value={vatOverview?.tempVatNumber || ""}
              onChange={(e) =>
                setVatOverview((prev) => ({
                  ...(prev || {}),
                  tempVatNumber: e.target.value,
                }))
              }
              placeholder="Enter 9‑digit VAT number"
              className="border p-2 rounded w-full"
            />

            <button
              onClick={saveVatNumber}
              className="mt-3 bg-blue-600 text-white px-4 py-2 rounded"
            >
              Save VAT Number
            </button>
          </div>
        )}

        {/* HMRC Authorisation */}
        {vatOverview?.vat_number && !vatOverview?.hmrcConnected && (
          <div className="mt-4">
            <button
              onClick={() => {
                if (!clientId) {
                  alert("No client selected.");
                  return;
                }
                window.location.href = `/api/hmrc/oauth/start?clientId=${clientId}`;
              }}
              className="bg-purple-600 text-white px-4 py-2 rounded"
            >
              Authorise HMRC (Required for MTD)
            </button>

            <p className="text-sm text-gray-600 mt-1">
              You must authorise HMRC before validating or submitting VAT
              returns.
            </p>
          </div>
        )}

        {/* HMRC Obligations */}
        <ResponsiveCard title="HMRC Obligations (Live from HMRC)">
          {loadingObligations ? (
            <p className="text-sm text-gray-600">Loading obligations…</p>
          ) : obligationsError ? (
            <p className="text-sm text-red-600">{obligationsError}</p>
          ) : hmrcObligations.length === 0 ? (
            <p className="text-sm text-gray-600">No obligations found.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {hmrcObligations.map((o, idx) => (
                <div
                  key={idx}
                  className="p-3 border rounded cursor-pointer hover:bg-blue-50"
                  onClick={() => {
                    setFrom(o.start);
                    setTo(o.end);
                    fetchVAT(o.start, o.end);
                  }}
                >
                  <p>
                    <strong>Period:</strong> {o.start} → {o.end}
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    {o.status === "O" ? "Open" : "Fulfilled"}
                  </p>
                  <p>
                    <strong>Due:</strong> {o.due}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ResponsiveCard>

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

        {/* VAT STAGGER BADGE */}
        {vatStagger && (
          <div className="inline-block bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm font-medium">
            VAT Stagger: {vatStagger}
          </div>
        )}

        {/* RESULTS */}
        {result && (
          <>
            {/* HMRC Submission Details */}
            {(result.hmrcReference ||
              result.processingDate ||
              result.submitted) && (
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
                    onClick={() => downloadReceipt()}
                    className="bg-blue-600 text-white px-4 py-2 rounded mt-2"
                    disabled={!result.submitted}
                  >
                    Download HMRC Receipt (PDF)
                  </button>
                </div>
              </ResponsiveCard>
            )}

            {/* Draft VAT Return Snapshot */}
            <ResponsiveCard
              title={`Draft VAT Return Summary ${locked ? "(Locked)" : ""}`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p>
                    <span className="font-semibold">
                      Box 1 – VAT due on sales:
                    </span>{" "}
                    £{Number(result.boxes?.box1 || 0).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">
                      Box 2 – VAT due on acquisitions:
                    </span>{" "}
                    £{Number(result.boxes?.box2 || 0).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">
                      Box 3 – Total VAT due (1 + 2):
                    </span>{" "}
                    £{Number(result.boxes?.box3 || 0).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">
                      Box 4 – VAT reclaimed on purchases:
                    </span>{" "}
                    £{Number(result.boxes?.box4 || 0).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">
                      Box 5 – Net VAT to pay (3 − 4):
                    </span>{" "}
                    £{Number(result.boxes?.box5 || 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p>
                    <span className="font-semibold">
                      Box 6 – Total sales (net):
                    </span>{" "}
                    £{Number(result.boxes?.box6 || 0).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">
                      Box 7 – Total purchases (net):
                    </span>{" "}
                    £{Number(result.boxes?.box7 || 0).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">
                      Box 8 – EU supplies (net):
                    </span>{" "}
                    £{Number(result.boxes?.box8 || 0).toFixed(2)}
                  </p>
                  <p>
                    <span className="font-semibold">
                      Box 9 – EU acquisitions (net):
                    </span>{" "}
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
                      currentVatPeriod.netVat ?? result.boxes?.box5 ?? 0
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
                      (currentVatPeriod.netVat || 0) -
                        (periodPaymentsTotal || 0)
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

            {/* HMRC VAT Returns (from HMRC) */}
            <ResponsiveCard title="HMRC VAT Returns (from HMRC)">
              {loadingReturns ? (
                <p className="text-sm text-gray-600">Loading HMRC returns…</p>
              ) : returnsError ? (
                <p className="text-sm text-red-600">{returnsError}</p>
              ) : hmrcReturns.length === 0 ? (
                <p className="text-sm text-gray-600">No HMRC returns found.</p>
              ) : (
                <ResponsiveTable
                  columns={[
                    { header: "Period Key", accessor: "periodKey" },
                    { header: "Start", accessor: "start" },
                    { header: "End", accessor: "end" },
                    { header: "Received", accessor: "received" },
                    { header: "Net VAT", accessor: "netVatDue" },
                    {
                      header: "Receipt",
                      accessor: "receipt",
                      render: (row) => (
                        <button
                          className="bg-blue-600 text-white px-3 py-1 rounded"
                          onClick={() =>
                            downloadReceipt(row.start, row.end)
                          }
                        >
                          Download Receipt
                        </button>
                      ),
                    },
                  ]}
                  data={hmrcReturns}
                />
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

        {/* NEW: VAT MTD Connection Status */}
        <ResponsiveCard title="HMRC VAT MTD Connection Status">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={loadVatStatus}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
              disabled={loadingStatus}
            >
              {loadingStatus ? "Checking connection…" : "Refresh Status"}
            </button>
          </div>

          {statusError && (
            <p className="text-sm text-red-600 mb-2">{statusError}</p>
          )}

          {!vatStatus ? (
            <p className="text-sm text-gray-600">
              No VAT MTD connection status loaded yet.
            </p>
          ) : (
            <div className="text-sm space-y-1">
              <p>
                <strong>Connected:</strong>{" "}
                {vatStatus.isConnected ? "Yes" : "No"}
              </p>
              <p>
                <strong>Token valid:</strong>{" "}
                {vatStatus.tokenValid ? "Yes" : "No"}
              </p>
              <p>
                <strong>VRN linked:</strong>{" "}
                {vatStatus.vrnLinked ? "Yes" : "No"}
              </p>
              <p>
                <strong>MTD enabled:</strong>{" "}
                {vatStatus.mtdEnabled ? "Yes" : "No"}
              </p>
              {vatStatus.expiresAt && (
                <p>
                  <strong>Token expires:</strong> {vatStatus.expiresAt}
                </p>
              )}
              {Array.isArray(vatStatus.scopes) && vatStatus.scopes.length > 0 && (
                <p>
                  <strong>Scopes:</strong> {vatStatus.scopes.join(", ")}
                </p>
              )}
              {vatStatus.needsReconnect && (
                <p className="text-red-600 font-semibold">
                  HMRC connection needs to be refreshed.
                </p>
              )}
            </div>
          )}
        </ResponsiveCard>

        {/* NEW: VAT Liabilities (HMRC) */}
        <ResponsiveCard title="VAT Liabilities (from HMRC)">
          <button
            onClick={loadVatLiabilities}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm mb-3"
            disabled={loadingLiabilities}
          >
            {loadingLiabilities ? "Loading liabilities…" : "Load Liabilities"}
          </button>

          {liabilitiesError && (
            <p className="text-sm text-red-600 mb-2">{liabilitiesError}</p>
          )}

          {!vatLiabilities ? (
            <p className="text-sm text-gray-600">
              No liabilities loaded yet.
            </p>
          ) : Array.isArray(vatLiabilities.liabilities) &&
            vatLiabilities.liabilities.length > 0 ? (
            <ResponsiveTable
              columns={[
                { header: "Type", accessor: "type" },
                { header: "From", accessor: "taxPeriodFrom" },
                { header: "To", accessor: "taxPeriodTo" },
                { header: "Outstanding", accessor: "outstandingAmount" },
                { header: "Due", accessor: "due" },
              ]}
              data={vatLiabilities.liabilities}
            />
          ) : (
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
              {JSON.stringify(vatLiabilities, null, 2)}
            </pre>
          )}
        </ResponsiveCard>

        {/* NEW: VAT Payments (HMRC) */}
        <ResponsiveCard title="VAT Payments (from HMRC)">
          <button
            onClick={loadVatPayments}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm mb-3"
            disabled={loadingVatPayments}
          >
            {loadingVatPayments ? "Loading payments…" : "Load Payments"}
          </button>

          {paymentsError && (
            <p className="text-sm text-red-600 mb-2">{paymentsError}</p>
          )}

          {!vatPayments ? (
            <p className="text-sm text-gray-600">
              No HMRC VAT payments loaded yet.
            </p>
          ) : Array.isArray(vatPayments.payments) &&
            vatPayments.payments.length > 0 ? (
            <ResponsiveTable
              columns={[
                { header: "Date", accessor: "received" },
                { header: "Amount", accessor: "amount" },
                { header: "Method", accessor: "method" },
              ]}
              data={vatPayments.payments}
            />
          ) : (
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
              {JSON.stringify(vatPayments, null, 2)}
            </pre>
          )}
        </ResponsiveCard>

        {/* NEW: VAT Periods (HMRC) */}
        <ResponsiveCard title="HMRC VAT Periods">
          <button
            onClick={loadVatPeriods}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm mb-3"
            disabled={loadingPeriods}
          >
            {loadingPeriods ? "Loading periods…" : "Load VAT Periods"}
          </button>

          {periodsError && (
            <p className="text-sm text-red-600 mb-2">{periodsError}</p>
          )}

          {!vatPeriods ? (
            <p className="text-sm text-gray-600">
              No HMRC VAT periods loaded yet.
            </p>
          ) : Array.isArray(vatPeriods) && vatPeriods.length > 0 ? (
            <ResponsiveTable
              columns={[
                { header: "Period Key", accessor: "periodKey" },
                { header: "Start", accessor: "start" },
                { header: "End", accessor: "end" },
                { header: "Status", accessor: "status" },
                { header: "Due", accessor: "due" },
              ]}
              data={vatPeriods}
            />
          ) : (
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
              {JSON.stringify(vatPeriods, null, 2)}
            </pre>
          )}
        </ResponsiveCard>

        {/* NEW: VAT Receipt Lookup (JSON view) */}
        <ResponsiveCard title="HMRC VAT Receipt Lookup">
          <div className="space-y-3 text-sm">
            <p>
              Use this tool to inspect the raw HMRC receipt by{" "}
              <code>submissionId</code>.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={receiptSubmissionId}
                onChange={(e) => setReceiptSubmissionId(e.target.value)}
                placeholder="Enter HMRC submissionId"
                className="border p-2 rounded flex-1"
              />
              <button
                onClick={loadVatReceipt}
                className="bg-blue-600 text-white px-4 py-2 rounded"
                disabled={loadingReceipt}
              >
                {loadingReceipt ? "Loading receipt…" : "Load Receipt"}
              </button>
            </div>

            {receiptError && (
              <p className="text-sm text-red-600">{receiptError}</p>
            )}

            {vatReceipt && (
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto mt-2">
                {JSON.stringify(vatReceipt, null, 2)}
              </pre>
            )}
          </div>
        </ResponsiveCard>

        {/* Filing Disclaimer */}
        <p className="text-xs text-slate-500 mt-8 text-center max-w-2xl mx-auto">
          ProfitLens does not provide tax advice. All calculations are estimates
          only. Users are solely responsible for verifying all figures and
          ensuring accuracy before submitting any tax filings to HMRC.
        </p>
      </div>
    </ResponsiveLayout>
  );
}
