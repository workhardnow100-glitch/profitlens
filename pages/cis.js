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

    // ✅ Auto-fill period from Tax Hub link
    if (router.query.from && router.query.to) {
      setFrom(router.query.from);
      setTo(router.query.to);
      fetchCIS(router.query.from, router.query.to);
    }
  }, [session, status, router.query]);

  // ✅ Fetch CIS summary
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
          clientId: session.user.clientId,
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

  // ✅ Submit CIS return
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
          clientId: session.user.clientId,
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
            <ResponsiveCard title={`CIS Totals ${result.locked ? "(Locked)" : ""}`}>
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
            <ResponsiveCard title={`Transactions Included ${result.locked ? "(Locked)" : ""}`}>
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
      </div>
    </ResponsiveLayout>
  );
}
