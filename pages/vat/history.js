// pages/vat/history.js
import { useEffect, useState } from "react";
import Head from "next/head";

export default function VatHistoryPage() {
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

        const res = await fetch("/api/vat/history", {
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
        if (!cancelled) setError(err.message || "Failed to load VAT history");
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
          £{Number(p.outputVat || 0).toFixed(2)}
        </td>
        <td className="px-3 py-2 text-sm text-right">
          £{Number(p.inputVat || 0).toFixed(2)}
        </td>
        <td className="px-3 py-2 text-sm text-right">
          £{Number(p.netVat || 0).toFixed(2)}
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

    const { vatSubmissions, vatPayments, vatAdjustments, mtdSubmissions } = data;
    const { periodStart, periodEnd } = selectedPeriod;

    const submissionsForPeriod = (vatSubmissions || []).filter(
      (s) => s.period_start === periodStart && s.period_end === periodEnd
    );

    const adjustmentsForPeriod = (vatAdjustments || []).filter(
      (a) => a.vat_period_id === null || // adjustments may or may not link to vat_periods
        (a.period_start === periodStart && a.period_end === periodEnd)
    );

    const paymentsForPeriod = (vatPayments || []).filter((p) => {
      // Approximate: payments close to the period end; you can refine by adding period linkage later
      const d = new Date(p.payment_date);
      const start = new Date(periodStart);
      const end = new Date(periodEnd);
      // +/- 60 days window around period end
      const windowEnd = new Date(end);
      windowEnd.setDate(windowEnd.getDate() + 60);
      return d >= start && d <= windowEnd;
    });

    const mtdForPeriod = (mtdSubmissions || []).filter(
      (m) =>
        m.period_start === periodStart ||
        m.period_end === periodEnd ||
        m.period === `${periodStart}_${periodEnd}`
    );

    const primarySubmission = submissionsForPeriod[0];

    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
        <div className="relative max-h-[90vh] w-[80vw] max-w-5xl overflow-y-auto rounded-lg bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                VAT Period: {selectedPeriod.periodLabel}
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
              <p className="text-xs font-semibold text-gray-500">Output VAT</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                £{Number(selectedPeriod.outputVat || 0).toFixed(2)}
              </p>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500">Input VAT</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                £{Number(selectedPeriod.inputVat || 0).toFixed(2)}
              </p>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500">Net VAT</p>
              <p className="mt-1 text-lg font-semibold text-gray-900">
                £{Number(selectedPeriod.netVat || 0).toFixed(2)}
              </p>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-500">Submission</p>
              <p className="mt-1 text-sm text-gray-900">
                {primarySubmission ? (
                  <>
                    Submitted{" "}
                    {new Date(
                      primarySubmission.submitted_at || primarySubmission.created_at
                    ).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {primarySubmission.hmrc_status && (
                      <>
                        <br />
                        <span className="text-xs text-gray-500">
                          HMRC status: {primarySubmission.hmrc_status}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-gray-500">No submission recorded</span>
                )}
              </p>
            </div>
          </div>

          <div className="space-y-6 px-6 py-4">
            {/* Boxes */}
            {primarySubmission && (
              <section>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  HMRC VAT Return Boxes
                </h3>
                <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 9 }, (_, i) => {
                    const boxKey = `box${i + 1}`;
                    const val = primarySubmission[boxKey];
                    return (
                      <div key={boxKey} className="rounded border px-3 py-2 text-xs">
                        <p className="font-semibold text-gray-700">Box {i + 1}</p>
                        <p className="mt-1 text-gray-900">
                          {val != null ? Number(val).toFixed(2) : "0.00"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Adjustments */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Adjustments
              </h3>
              {adjustmentsForPeriod.length === 0 ? (
                <p className="text-xs text-gray-500">No adjustments recorded.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {adjustmentsForPeriod.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start justify-between rounded border px-3 py-2"
                    >
                      <div>
                        <p className="font-semibold text-gray-800">
                          Box {a.box} · £{Number(a.amount).toFixed(2)}
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
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                Payments & Refunds (Approximate)
              </h3>
              {paymentsForPeriod.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No payments or refunds matched to this period yet.
                </p>
              ) : (
                <table className="min-w-full text-xs border">
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
                          {p.direction === "payment" ? "Payment to HMRC" : "Refund from HMRC"}
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

            {/* MTD submissions */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                MTD Submissions
              </h3>
              {mtdForPeriod.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No MTD submissions linked to this period yet.
                </p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {mtdForPeriod.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-start justify-between rounded border px-3 py-2"
                    >
                      <div>
                        <p className="font-semibold text-gray-800">
                          {m.hmrc_reference || "MTD Submission"}
                        </p>
                        <p className="text-gray-600">
                          Status:{" "}
                          <span className="font-normal">
                            {m.status || "Unknown"}
                          </span>
                        </p>
                        {m.receipt_url && (
                          <a
                            href={m.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline"
                          >
                            View HMRC receipt
                          </a>
                        )}
                        <p className="text-gray-500 mt-1">
                          {m.submitted_at &&
                            new Date(m.submitted_at).toLocaleString("en-GB")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
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
        <title>VAT History | ProfitLens</title>
      </Head>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-xl font-semibold text-gray-900 mb-2">VAT History</h1>
        <p className="text-sm text-gray-600 mb-4">
          View historic VAT periods, submissions, payments, and MTD activity.
        </p>

        {loading && <p className="text-sm text-gray-500">Loading VAT history…</p>}
        {error && (
          <p className="text-sm text-red-600">
            Error loading VAT history: {error}
          </p>
        )}

        {data && (
          <>
            {/* Summary cards */}
            <div className="mb-4 grid gap-4 md:grid-cols-4">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500">Total VAT Owed</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  £{Number(data.totalVatOwed || 0).toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500">Total VAT Paid</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  £{Number(data.totalVatPaid || 0).toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500">Outstanding Balance</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  £{Number(data.vatBalance || 0).toFixed(2)}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-semibold text-gray-500">Overdue Returns</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {data.overdueVatCount || 0}
                </p>
              </div>
            </div>

            {/* Period table */}
            <div className="overflow-hidden rounded-lg border bg-white">
              <div className="border-b px-4 py-2">
                <h2 className="text-sm font-semibold text-gray-900">
                  VAT Periods (last 5 years)
                </h2>
                <p className="text-xs text-gray-500">
                  All periods are shown. Periods with no activity are greyed out.
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
                        Output VAT
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                        Input VAT
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                        Net VAT
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
                          No VAT periods found.
                        </td>
                      </tr>
                    ) : (
                      data.periods.map(renderPeriodRow)
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Global timeline (optional visual) */}
            {data.timeline && data.timeline.length > 0 && (
              <div className="mt-6 rounded-lg border bg-white">
                <div className="border-b px-4 py-2">
                  <h2 className="text-sm font-semibold text-gray-900">
                    VAT Activity Timeline
                  </h2>
                  <p className="text-xs text-gray-500">
                    Submissions, payments, adjustments, and MTD events.
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
                            : item.type === "adjustment"
                            ? "Adjustment"
                            : "MTD"}
                        </span>
                        <span className="flex-1 text-gray-800">
                          {item.type === "submission" && (
                            <>
                              VAT return submitted · Net VAT: £
                              {Number(item.netVat || 0).toFixed(2)}
                              {item.hmrcStatus && (
                                <> · HMRC status: {item.hmrcStatus}</>
                              )}
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
                              Box {item.box} adjustment · £
                              {Number(item.amount || 0).toFixed(2)}{" "}
                              {item.reason && <>· {item.reason}</>}
                            </>
                          )}
                          {item.type === "mtd" && (
                            <>
                              MTD submission ·{" "}
                              {item.hmrcReference || "No HMRC reference"}{" "}
                              {item.status && <>· Status: {item.status}</>}
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
