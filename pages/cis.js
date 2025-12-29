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

  // NEW: CIS MTD state
  const [cisObligations, setCisObligations] = useState([]);
  const [cisReturns, setCisReturns] = useState([]);
  const [cisDeductions, setCisDeductions] = useState([]);

  const [cisStatus, setCisStatus] = useState(null);
  const [cisReceipt, setCisReceipt] = useState(null);
  const [cisVerification, setCisVerification] = useState(null);

  const [loadingObligations, setLoadingObligations] = useState(false);
  const [loadingReturns, setLoadingReturns] = useState(false);
  const [loadingDeductions, setLoadingDeductions] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [loadingVerify, setLoadingVerify] = useState(false);

  const [receiptSubmissionId, setReceiptSubmissionId] = useState("");
  const [verifyUtr, setVerifyUtr] = useState("");
  const [receiptError, setReceiptError] = useState(null);
  const [verifyError, setVerifyError] = useState(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) router.replace("/login");

    // ✅ Auto-fill period from Tax Hub link
    if (router.query.from && router.query.to) {
      setFrom(router.query.from);
      setTo(router.query.to);
      fetchCIS(router.query.from, router.query.to);
    }
  }, [session, status, router.query]);

  // ✅ Fetch CIS summary (internal engine)
  async function fetchCIS(start, end) {
    const periodStart = start || from;
    const periodEnd = end || to;

    if (!periodStart || !periodEnd)
      return alert("Please select both start and end dates.");

    setLoading(true);

    try {
      const res = await fetch("/api/cis/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.actingAsClientId ?? session.user.clientId,
          periodStart,
          periodEnd,
        }),
      });

      const data = await res.json();
      setResult({ ...data, locked: data.locked || false });
    } catch (err) {
      console.error(err);
      alert("Error fetching CIS summary: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // ✅ Submit CIS return (current behaviour – internal endpoint)
  async function submitCIS() {
    if (!from || !to)
      return alert("Please select both start and end dates.");

    if (!confirm("Submit this CIS period? This will lock the period."))
      return;

    setLoading(true);

    try {
      const res = await fetch("/api/cis/submit", {
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
        alert("CIS return submitted successfully. Period locked.");
        setResult({
          ...result,
          locked: true,
          hmrcSubmission: data.hmrcResponse,
        });
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

  // ---------------------------------------------------------
  // NEW: CIS MTD LOADERS (HMRC)
  // ---------------------------------------------------------

  // CIS MTD connection status
  async function loadCISStatus() {
    setLoadingStatus(true);
    try {
      const res = await fetch("/api/mtd/cis/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load CIS status");
      setCisStatus(data.status || null);
    } catch (err) {
      console.error("Error loading CIS MTD status:", err);
      setCisStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }

  // CIS obligations (HMRC periods)
  async function loadCISObligations() {
    setLoadingObligations(true);
    try {
      const res = await fetch("/api/mtd/cis/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to load CIS obligations");
      setCisObligations(data.obligations || []);
    } catch (err) {
      console.error("Error loading CIS obligations:", err);
      setCisObligations([]);
    } finally {
      setLoadingObligations(false);
    }
  }

  // CIS returns (HMRC history)
  async function loadCISReturns() {
    setLoadingReturns(true);
    try {
      const res = await fetch("/api/mtd/cis/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to load CIS returns");
      setCisReturns(data.returns || []);
    } catch (err) {
      console.error("Error loading CIS returns:", err);
      setCisReturns([]);
    } finally {
      setLoadingReturns(false);
    }
  }

  // CIS deductions (contractor + suffered view)
  async function loadCISDeductions() {
    setLoadingDeductions(true);
    try {
      const res = await fetch("/api/mtd/cis/deductions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to load CIS deductions");
      setCisDeductions(data.deductions || []);
    } catch (err) {
      console.error("Error loading CIS deductions:", err);
      setCisDeductions([]);
    } finally {
      setLoadingDeductions(false);
    }
  }

  // CIS receipt lookup (by submissionId)
  async function loadCISReceipt() {
    setReceiptError(null);
    setCisReceipt(null);

    if (!receiptSubmissionId) {
      setReceiptError("Enter a submissionId first.");
      return;
    }

    setLoadingReceipt(true);
    try {
      const res = await fetch("/api/mtd/cis/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: receiptSubmissionId }),
      });
      const data = await res
        .json()
        .catch(() => null);

      if (!res.ok) {
        throw new Error(
          (data && data.error) || "Failed to load CIS receipt from HMRC"
        );
      }

      setCisReceipt(data || null);
    } catch (err) {
      console.error("Error loading CIS receipt:", err);
      setReceiptError(err.message);
    } finally {
      setLoadingReceipt(false);
    }
  }

  // CIS verification (subcontractor UTR)
  async function verifySubcontractor() {
    setVerifyError(null);
    setCisVerification(null);

    if (!verifyUtr) {
      setVerifyError("Enter a subcontractor UTR first.");
      return;
    }

    setLoadingVerify(true);
    try {
      const res = await fetch("/api/mtd/cis/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr: verifyUtr }),
      });
      const data = await res
        .json()
        .catch(() => null);

      if (!res.ok) {
        throw new Error(
          (data && data.error) || "Failed to verify subcontractor"
        );
      }

      setCisVerification(data || null);
    } catch (err) {
      console.error("Error verifying subcontractor:", err);
      setVerifyError(err.message);
    } finally {
      setLoadingVerify(false);
    }
  }

  if (!session?.user) return null;

  return (
    <ResponsiveLayout currentPageName="CIS Return">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">CIS Monthly Return</h1>

        {/* ✅ Period Controls */}
        <ResponsiveCard title="Select CIS Period (6th → 5th)">
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
                onClick={() => fetchCIS()}
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
                  {loading ? "Submitting…" : "Submit to HMRC"}
                </button>
              )}
            </div>
          </div>
        </ResponsiveCard>

        {/* ✅ CIS Summary */}
        {result && (
          <>
            <ResponsiveCard
              title={`CIS Totals ${result.locked ? "(Locked)" : ""}`}
            >
              <div className="space-y-2">
                <p>
                  <strong>CIS Deducted (you withheld):</strong>{" "}
                  <span className="text-red-600">
                    £{result.cisDeducted.toFixed(2)}
                  </span>
                </p>

                <p>
                  <strong>CIS Suffered (withheld from you):</strong>{" "}
                  <span className="text-blue-600">
                    £{result.cisSuffered.toFixed(2)}
                  </span>
                </p>

                <p className="font-bold">
                  Net CIS:{" "}
                  <span
                    className={
                      result.netCis > 0
                        ? "text-red-600"
                        : result.netCis < 0
                        ? "text-green-600"
                        : "text-gray-700"
                    }
                  >
                    £{result.netCis.toFixed(2)}
                  </span>
                </p>
              </div>
            </ResponsiveCard>

            {/* ✅ CIS Transactions */}
            <ResponsiveCard
              title={`Transactions Included ${result.locked ? "(Locked)" : ""}`}
            >
              <ResponsiveTable
                columns={[
                  { header: "Date", accessor: "date" },
                  { header: "Category", accessor: "category" },
                  { header: "CIS Amount (£)", accessor: "cis_amount" },
                ]}
                data={result.transactions}
              />
            </ResponsiveCard>

            {/* ✅ HMRC Submission Info */}
            {result.hmrcSubmission && (
              <ResponsiveCard title="HMRC Submission">
                <div className="space-y-2">
                  <p>
                    <strong>Processing Date:</strong>{" "}
                    {result.hmrcSubmission.processingDate}
                  </p>
                  <p>
                    <strong>Status:</strong>{" "}
                    {result.hmrcSubmission.status}
                  </p>
                  <pre className="bg-gray-100 p-2 rounded overflow-x-auto">
                    {JSON.stringify(result.hmrcSubmission, null, 2)}
                  </pre>
                </div>
              </ResponsiveCard>
            )}
          </>
        )}

        {/* NEW: CIS MTD Connection Status */}
        <ResponsiveCard title="CIS MTD Connection Status (HMRC)">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={loadCISStatus}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
              disabled={loadingStatus}
            >
              {loadingStatus ? "Checking status…" : "Refresh Status"}
            </button>
          </div>

          {!cisStatus ? (
            <p className="text-sm text-gray-600">
              No CIS MTD status loaded yet.
            </p>
          ) : (
            <div className="text-sm space-y-1">
              <p>
                <strong>Connected:</strong>{" "}
                {cisStatus.isConnected ? "Yes" : "No"}
              </p>
              <p>
                <strong>Token valid:</strong>{" "}
                {cisStatus.tokenValid ? "Yes" : "No"}
              </p>
              {cisStatus.utrLinked !== undefined && (
                <p>
                  <strong>UTR linked:</strong>{" "}
                  {cisStatus.utrLinked ? "Yes" : "No"}
                </p>
              )}
              <p>
                <strong>MTD enabled:</strong>{" "}
                {cisStatus.mtdEnabled ? "Yes" : "No"}
              </p>
              {cisStatus.expiresAt && (
                <p>
                  <strong>Token expires:</strong> {cisStatus.expiresAt}
                </p>
              )}
              {Array.isArray(cisStatus.scopes) &&
                cisStatus.scopes.length > 0 && (
                  <p>
                    <strong>Scopes:</strong>{" "}
                    {cisStatus.scopes.join(", ")}
                  </p>
                )}
              {cisStatus.needsReconnect && (
                <p className="text-red-600 font-semibold">
                  HMRC connection needs to be refreshed.
                </p>
              )}
            </div>
          )}
        </ResponsiveCard>

        {/* NEW: CIS Obligations (HMRC) */}
        <ResponsiveCard title="CIS Obligations (from HMRC)">
          <button
            onClick={loadCISObligations}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm mb-3"
            disabled={loadingObligations}
          >
            {loadingObligations ? "Loading obligations…" : "Load Obligations"}
          </button>

          {cisObligations.length === 0 ? (
            <p className="text-sm text-gray-600">
              No CIS obligations loaded yet.
            </p>
          ) : (
            <ResponsiveTable
              columns={[
                { header: "Period Start", accessor: "start" },
                { header: "Period End", accessor: "end" },
                { header: "Due", accessor: "due" },
                { header: "Status", accessor: "status" },
              ]}
              data={cisObligations}
            />
          )}
        </ResponsiveCard>

        {/* NEW: CIS Returns (HMRC) */}
        <ResponsiveCard title="CIS Returns (from HMRC)">
          <button
            onClick={loadCISReturns}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm mb-3"
            disabled={loadingReturns}
          >
            {loadingReturns ? "Loading returns…" : "Load Returns"}
          </button>

          {cisReturns.length === 0 ? (
            <p className="text-sm text-gray-600">
              No CIS returns loaded yet.
            </p>
          ) : (
            <ResponsiveTable
              columns={[
                { header: "Period Start", accessor: "start" },
                { header: "Period End", accessor: "end" },
                { header: "Received", accessor: "received" },
                { header: "Status", accessor: "status" },
              ]}
              data={cisReturns}
            />
          )}
        </ResponsiveCard>

        {/* NEW: CIS Deductions (HMRC view) */}
        <ResponsiveCard title="CIS Deductions (HMRC view)">
          <button
            onClick={loadCISDeductions}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm mb-3"
            disabled={loadingDeductions}
          >
            {loadingDeductions ? "Loading deductions…" : "Load Deductions"}
          </button>

          {cisDeductions.length === 0 ? (
            <p className="text-sm text-gray-600">
              No CIS deductions loaded yet.
            </p>
          ) : (
            <ResponsiveTable
              columns={[
                { header: "Type", accessor: "type" }, // e.g. "deducted" / "suffered"
                { header: "Period Start", accessor: "start" },
                { header: "Period End", accessor: "end" },
                { header: "Amount (£)", accessor: "amount" },
              ]}
              data={cisDeductions}
            />
          )}
        </ResponsiveCard>

        {/* NEW: CIS Receipt Lookup (MTD) */}
        <ResponsiveCard title="CIS Receipt Lookup (MTD)">
          <div className="space-y-3 text-sm">
            <p>
              Inspect the raw HMRC CIS receipt by <code>submissionId</code>.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={receiptSubmissionId}
                onChange={(e) => setReceiptSubmissionId(e.target.value)}
                placeholder="Enter HMRC CIS submissionId"
                className="border p-2 rounded flex-1"
              />
              <button
                onClick={loadCISReceipt}
                className="bg-blue-600 text-white px-4 py-2 rounded"
                disabled={loadingReceipt}
              >
                {loadingReceipt ? "Loading receipt…" : "Load Receipt"}
              </button>
            </div>

            {receiptError && (
              <p className="text-sm text-red-600">{receiptError}</p>
            )}

            {cisReceipt && (
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto mt-2">
                {JSON.stringify(cisReceipt, null, 2)}
              </pre>
            )}
          </div>
        </ResponsiveCard>

        {/* NEW: CIS Subcontractor Verification */}
        <ResponsiveCard title="CIS Subcontractor Verification (HMRC)">
          <div className="space-y-3 text-sm">
            <p>
              Verify a subcontractor with HMRC using their UTR. This can return
              a verification number and deduction status.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={verifyUtr}
                onChange={(e) => setVerifyUtr(e.target.value)}
                placeholder="Enter subcontractor UTR"
                className="border p-2 rounded flex-1"
              />
              <button
                onClick={verifySubcontractor}
                className="bg-blue-600 text-white px-4 py-2 rounded"
                disabled={loadingVerify}
              >
                {loadingVerify ? "Verifying…" : "Verify Subcontractor"}
              </button>
            </div>

            {verifyError && (
              <p className="text-sm text-red-600">{verifyError}</p>
            )}

            {cisVerification && (
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto mt-2">
                {JSON.stringify(cisVerification, null, 2)}
              </pre>
            )}
          </div>
        </ResponsiveCard>
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

