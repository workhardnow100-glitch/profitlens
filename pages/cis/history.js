// pages/cis/history.js
import { useEffect, useState } from "react";
import Head from "next/head";

export default function CisHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchHistory() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/cis/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}), // clientId inferred from session
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed with ${res.status}`);
        }

        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load CIS history");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHistory();
    return () => {
      cancelled = true;
    };
  }, []);

  const openPeriod = (period) => {
    setSelectedPeriod(period);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPeriod(null);
  };

  const renderStatusBadge = (p) => {
    let bg = "bg-gray-200 text-gray-800";
    if (p.status === "Submitted") bg = "bg-green-100 text-green-800";
    else if (p.status === "Overdue") bg = "bg-red-100 text-red-800";
    else if (p.status === "Ready to Submit") bg = "bg-amber-100 text-amber-800";

    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${bg}`}>
        {p.status}
      </span>
    );
  };

  const renderPeriodRow = (p) => {
    const muted = !p.hasActivity;
    const rowClass = muted ? "opacity-50" : "";
    return (
      <tr
        key={`${p.periodStart}_${p.periodEnd}`}
        className={`border-b hover:bg-gray-50 cursor-pointer ${rowClass}`}
        onClick={() => openPeriod(p)}
      >
        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
          {p.periodLabel}
        </td>
        <td className="px-3 py-2 text-sm text-right">
          £{Number(p.cisDeducted || 0).toFixed(2)}
        </td>
        <td className="px-3 py-2 text-sm text-right">
          £{Number(p.cisSuffered || 0).toFixed(2)}
        </td>
        <td className="px-3 py-2 text-sm text-right">
          £{Number(p.netCis || 0).toFixed(2)}
        </td>
        <td className="px-3 py-2 text-sm text-center">{renderStatusBadge(p)}</td>
        <td className="px-3 py-2 text-sm text-center">
          {p.locked ? (
            <span className="text-xs font-semibold text-blue-700">Locked</span>
          ) : (
            <span className="text-xs text-gray-500">Open</span>
          )}
        </td>
        <td className="px-3 py-2 text-sm text-right">
          <button
            className="inline-flex items-center px-2 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100"
            onClick={(e) => {
              e.stopPropagation();
              openPeriod(p);
            }}
          >
            View
          </button>
        </td>
      </tr>
    );
  };

  const renderPeriodModal = () => {
    if (!showModal || !selectedPeriod || !data) return null;

    const { cisSubmissions, cisPayments, cisAdjustments } = data;
    const { periodStart, periodEnd } = selectedPeriod;

    const submissionsForPeriod = (cisSubmissions || []).filter(
      (s) => s.period_start === periodStart && s.period_end === periodEnd
    );

    const primarySubmission = submissionsForPeriod[0];

    const adjustmentsForSubmission = primarySubmission
      ? (cisAdjustments || []).filter(
          (a) => a.cis_submission_id === primarySubmission.id
        )
      : [];

    const paymentsForPeriod = (cisPayments || []).filter((p) => {
      const d = new Date(p.payment_date);
      const start = new Date(periodStart);
      const end = new Date(periodEnd);
      const windowEnd = new Date(end);
      windowEnd.setDate(windowEnd.getDate() + 60);
      return d >= start && d <= windowEnd;
    });

    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
        <div className="relative max-h-[90vh] w-[80vw] max-w-5xl overflow-y-auto rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                CIS Period: {selectedPeriod.periodLabel}
              </h2>
              <p className="text-xs text-gray-500">
                Status: {selectedPeriod.status}{" "}
                {selectedPeriod.overdue && (
                  <span className="text-red-600 font-semibold"> · Overdue</span>
                )}
                {selectedPeriod.locked && (
                  <span className="text-blue-700 font-semibold"> · Locked</span>
                )}
              </p>
            </div>
            <button
              className="text-gray-500 hover:text-gray-700"
              onClick={closeModal}
            >
              ✕
            </button>
          </div>

          <div className="grid gap-4 border-b px-6 py-4 md:grid-cols-4">
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500">CIS Deducted</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                £{Number(selectedPeriod.cisDeducted || 0).toFixed(2)}
              </p>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500">CIS Suffered</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                £{Number(selectedPeriod.cisSuffered || 0).toFixed(2)}
              </p>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500">Net CIS</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                £{Number(selectedPeriod.netCis || 0).toFixed(2)}
              </p>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500">Submission</p>
              <p className="mt-1 text-sm text-gray-900">
                {primarySubmission ? (
                  <>
                    Submitted{" "}
                    {new Date(primarySubmission.created_at).toLocaleString(
                      "en-GB",
                      {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </>
                ) : (
                  <span className="text-xs text-gray-500">No submission recorded</span>
                )}
              </p>
            </div>
          </div>

          <div className="space-y-6 px-6 py-4">
            {/* Submission details */}
            {primarySubmission && (
              <section>
                <h3 className="mb-2 text-sm font-semibold text-gray-900">
                  CIS Submission
                </h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded border px-3 py-2 text-xs">
                    <p className="font-semibold text-gray-700">CIS Deducted</p>
                    <p className="mt-1 text-gray-900">
                      £{Number(primarySubmission.cis_deducted || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded border px-3 py-2 text-xs">
                    <p className="font-semibold text-gray-700">CIS Suffered</p>
                    <p className="mt-1 text-gray-900">
                      £{Number(primarySubmission.cis_suffered || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded border px-3 py-2 text-xs">
                    <p className="font-semibold text-gray-700">Net CIS</p>
                    <p className="mt-1 text-gray-900">
                      £{Number(primarySubmission.net_cis || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
                {primarySubmission.hmrc_response && (
                  <div className="mt-3 rounded border bg-gray-50 px-3 py-2 text-xs">
                    <p className="font-semibold text-gray-700">HMRC Response</p>
                    <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[10px] text-gray-800">
                      {JSON.stringify(primarySubmission.hmrc_response, null, 2)}
                    </pre>
                  </div>
                )}
              </section>
            )}

            {/* Adjustments */}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">
                Adjustments
              </h3>
              {adjustmentsForSubmission.length === 0 ? (
                <p className="text-xs text-gray-500">No adjustments recorded.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {adjustmentsForSubmission.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start justify-between rounded border px-3 py-2"
                    >
                      <div>
                        <p className="font-semibold text-gray-800">
                          Adjustment · £{Number(a.amount).toFixed(2)}
                        </p>
                        {a.reason && (
                          <p className="text-gray-600">
                            Reason: <span className="font-normal">{a.reason}</span>
                          </p>
                        )}
                        <p className="text-gray-500">
                          {new Date(a.created_at).toLocaleString("en-GB")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Payments */}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-gray-900">
                Payments & Refunds (Approximate)
              </h3>
              {paymentsForPeriod.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No CIS payments or refunds matched to this period yet.
                </p>
              ) : (
                <table className="min-w-full border text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-1 text-left font-semibold text-gray-600">
                        Date
                      </th>
                      <th className="px-2 py-1 text-left font-semibold text-gray-600">
                        Type
                      </th>
                      <th className="px-2 py-1 text-right font-semibold text-gray-600">
                        Amount
                      </th>
                      <th className="px-2 py-1 text-left font-semibold text-gray-600">
                        Reference
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentsForPeriod.map((p) => (
                      <tr key={p.id} className="border-t">
                        <td className="px-2 py-1">
                          {new Date(p.payment_date).toLocaleDateString("en-GB")}
                        </td>
                        <td className="px-2 py-1">
                          {p.direction === "payment"
                            ? "Payment to HMRC"
                            : "Refund from HMRC"}
                        </td>
                        <td className="px-2 py-1 text-right">
                          £{Number(p.amount).toFixed(2)}
                        </td>
                        <td className="px-2 py-1">{p.reference || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <div className="border-t px-6 py-3 text-xs text-gray-500">
            ProfitLens does not provide tax advice. All calculations are estimates only.
            Users are solely responsible for verifying all figures and ensuring accuracy
            before submitting any tax filings to HMRC.
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>CIS History | ProfitLens</title>
      </Head>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-2 text-xl font-semibold text-gray-900">CIS History</h1>
        <p className="mb-4 text-sm text-gray-600">
          View historic CIS periods, submissions, payments, and adjustments.
        </p>

        {loading && <p className="text-sm text-gray-500">Loading CIS history…</p>}
        {error && (
          <p className="text-sm text-red-600">
            Error loading CIS history: {error}
          </p>
        )}

        {data && (
          <>
            {/* Summary cards */}
            <div className="mb-4 grid gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500">Total Net CIS</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  £{Number(data.totalCisNet || 0).toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500">Total CIS Paid</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  £{Number(data.totalCisPaid || 0).toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500">CIS Balance</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  £{Number(data.cisBalance || 0).toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500">Overdue CIS</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {data.overdueCisCount || 0}
                </p>
              </div>
            </div>

            {/* Period table */}
            <div className="overflow-hidden rounded-lg border bg-white">
              <div className="border-b px-4 py-2">
                <h2 className="text-sm font-semibold text-gray-900">
                  CIS Periods (last 5 years)
                </h2>
                <p className="text-xs text-gray-500">
                  All periods are shown. Periods with no CIS activity are greyed out.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">
                        Period
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                        CIS Deducted
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                        CIS Suffered
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                        Net CIS
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">
                        Status
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600">
                        Lock
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.periods.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-4 text-center text-xs text-gray-500"
                        >
                          No CIS periods found.
                        </td>
                      </tr>
                    ) : (
                      data.periods.map(renderPeriodRow)
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Global timeline */}
            {data.timeline && data.timeline.length > 0 && (
              <div className="mt-6 rounded-lg border bg-white">
                <div className="border-b px-4 py-2">
                  <h2 className="text-sm font-semibold text-gray-900">
                    CIS Activity Timeline
                  </h2>
                  <p className="text-xs text-gray-500">
                    Submissions, payments, and adjustments.
                  </p>
                </div>
                <div className="max-h-80 overflow-y-auto px-4 py-3 text-xs">
                  <ul className="space-y-2">
                    {data.timeline.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <span className="mt-0.5 w-28 text-gray-500">
                          {item.date
                            ? new Date(item.date).toLocaleString("en-GB")
                            : "-"}
                        </span>
                        <span className="w-24 font-semibold text-gray-700">
                          {item.type === "submission"
                            ? "Submission"
                            : item.type === "payment"
                            ? "Payment"
                            : "Adjustment"}
                        </span>
                        <span className="flex-1 text-gray-800">
                          {item.type === "submission" && (
                            <>
                              CIS return submitted · Net CIS: £
                              {Number(item.netCis || 0).toFixed(2)}
                            </>
                          )}
                          {item.type === "payment" && (
                            <>
                              {item.direction === "payment"
                                ? "Payment to HMRC"
                                : "Refund from HMRC"}{" "}
                              · £{Number(item.amount || 0).toFixed(2)}{" "}
                              {item.reference && <>· Ref: {item.reference}</>}
                            </>
                          )}
                          {item.type === "adjustment" && (
                            <>
                              Adjustment · £
                              {Number(item.amount || 0).toFixed(2)}{" "}
                              {item.reason && <>· {item.reason}</>}
                            </>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {renderPeriodModal()}
    </>
  );
}
