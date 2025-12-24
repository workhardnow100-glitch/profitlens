// pages/tax-hub.js
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";

export default function TaxHub() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [periods, setPeriods] = useState({
    vat: [],
    cis: [],
    corp: [],
    sa: [],

    vatPayments: [],
    totalVatOwed: 0,
    totalVatPaid: 0,
    vatBalance: 0,
    totalVatOutput: 0,
    totalVatInput: 0,
    overdueVatCount: 0,

    ctPayments: [],
    totalCorpTaxDue: 0,
    totalCtPaid: 0,
    ctBalance: 0,

    // SA summary fields
    totalSaIncome: 0,
    totalSaExpenses: 0,
    saProfit: 0,
    saTax: 0,
    saLocked: false,
    saLatestYear: null,
  });

  const [vatStagger, setVatStagger] = useState(1);
  const [showOlderVatPeriods, setShowOlderVatPeriods] = useState(false);
  const [showOlderCisPeriods, setShowOlderCisPeriods] = useState(false);

  // ✅ MTD VAT per-period state: submissionId + loading flags
  // key = `${periodStart}_${periodEnd}`
  const [mtdVatState, setMtdVatState] = useState({});

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) router.replace("/login");
    else fetchPeriods();
  }, [session, status]);

  useEffect(() => {
    if (router.query.authorized) {
      fetchPeriods();
      router.replace("/tax-hub", undefined, { shallow: true });
    }
  }, [router.query]);

  async function fetchPeriods() {
    setLoading(true);
    try {
      const res = await fetch("/api/tax-hub/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: session.user.clientId }),
      });

      const data = await res.json();

      setPeriods({
        vat: data.vat || [],
        cis: data.cis || [],
        corp: data.corp || [],
        sa: data.sa || [],

        vatPayments: data.vatPayments || [],
        totalVatOwed: data.totalVatOwed || 0,
        totalVatPaid: data.totalVatPaid || 0,
        vatBalance: data.vatBalance || 0,
        totalVatOutput: data.totalVatOutput || 0,
        totalVatInput: data.totalVatInput || 0,
        overdueVatCount: data.overdueVatCount || 0,

        ctPayments: data.ctPayments || [],
        totalCorpTaxDue: data.totalCorpTaxDue || 0,
        totalCtPaid: data.totalCtPaid || 0,
        ctBalance: data.ctBalance || 0,

        // SA summary fields
        totalSaIncome: data.totalSaIncome || 0,
        totalSaExpenses: data.totalSaExpenses || 0,
        saProfit: data.saProfit || 0,
        saTax: data.saTax || 0,
        saLocked: data.saLocked || false,
        saLatestYear: data.saLatestYear || null,
      });

      if (data.vatStagger) setVatStagger(data.vatStagger);
      // Reset MTD VAT state whenever periods are refreshed to avoid stale submissionIds
      setMtdVatState({});
    } catch (err) {
      console.error("Tax Hub periods error:", err);
      alert("Error fetching tax periods: " + err.message);
      setPeriods({
        vat: [],
        cis: [],
        corp: [],
        sa: [],
        vatPayments: [],
        totalVatOwed: 0,
        totalVatPaid: 0,
        vatBalance: 0,
        totalVatOutput: 0,
        totalVatInput: 0,
        overdueVatCount: 0,
        ctPayments: [],
        totalCorpTaxDue: 0,
        totalCtPaid: 0,
        ctBalance: 0,
        totalSaIncome: 0,
        totalSaExpenses: 0,
        saProfit: 0,
        saTax: 0,
        saLocked: false,
        saLatestYear: null,
      });
    } finally {
      setLoading(false);
    }
  }

  if (!session?.user) return null;

  // ORDER: VAT → CIS → CT → SA
  const taxTypes = [
    { key: "vat", name: "VAT", path: "/vat" },
    { key: "cis", name: "CIS", path: "/cis" },
    { key: "corp", name: "Corporation Tax", path: "/corp" },
    { key: "sa", name: "Self Assessment", path: "/sa" },
  ];

  const needsHMRCAuth = !(periods.vat || []).some((p) => p.hmrcAuthorized);

  // Derived VAT period lists for cockpit
  const vatPeriods = periods.vat || [];
  const activeVatPeriods = vatPeriods.slice(0, 4);
  const olderVatPeriods = vatPeriods.slice(4);

  // ✅ Derived CIS period lists + summary for cockpit
  const cisPeriods = periods.cis || [];
  const activeCisPeriods = cisPeriods.slice(0, 4);
  const olderCisPeriods = cisPeriods.slice(4);

  const totalCisDeducted = cisPeriods.reduce(
    (sum, p) => sum + (p.cisDeducted || 0),
    0
  );
  const totalCisSuffered = cisPeriods.reduce(
    (sum, p) => sum + (p.cisSuffered || 0),
    0
  );

  const totalNetCis = cisPeriods.reduce((sum, p) => {
    if (typeof p.netCis === "number") return sum + p.netCis;
    const deducted = p.cisDeducted || 0;
    const suffered = p.cisSuffered || 0;
    return sum + (deducted - suffered);
  }, 0);

  const overdueCisCount = cisPeriods.filter(
    (p) => p.status === "Overdue"
  ).length;

  // Helpers for MTD VAT state
  const getVatKey = (p) => `${p.periodStart}_${p.periodEnd}`;

  const updateMtdVatState = (key, patch) => {
    setMtdVatState((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        ...patch,
      },
    }));
  };

  return (
    <ResponsiveLayout currentPageName="Tax Hub">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Tax Hub</h1>

        {needsHMRCAuth && !loading && (
          <div className="mb-4">
            <p className="text-yellow-600 mb-2">
              HMRC account not connected. You must authorize to submit VAT/CIS
              periods.
            </p>
            <a
              href={`/api/hmrc/oauth/start?clientId=${encodeURIComponent(
                session.user.clientId
              )}`}
              className="bg-orange-600 text-white px-4 py-2 rounded"
            >
              Connect to HMRC
            </a>
          </div>
        )}

        {loading ? (
          <p>Loading periods…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {taxTypes.map((tax) => (
              <ResponsiveCard key={tax.key} title={tax.name}>
                {/* VAT STAGGER */}
                {tax.key === "vat" && (
                  <div className="mb-4 flex items-center gap-2">
                    <label className="text-sm font-medium">VAT Stagger:</label>
                    <select
                      value={vatStagger}
                      onChange={async (e) => {
                        const newStagger = Number(e.target.value);

                        await fetch("/api/vat/set-stagger", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            clientId: session.user.clientId,
                            stagger: newStagger,
                          }),
                        });

                        await fetchPeriods();
                      }}
                      className="border p-2 rounded"
                    >
                      <option value={1}>Stagger 1 (Jan, Apr, Jul, Oct)</option>
                      <option value={2}>Stagger 2 (Feb, May, Aug, Nov)</option>
                      <option value={3}>Stagger 3 (Mar, Jun, Sep, Dec)</option>
                    </select>
                  </div>
                )}

                {/* VAT cockpit summary + help + payments */}
                {tax.key === "vat" && (
                  <div className="mt-4 p-4 border rounded bg-gray-50 space-y-4">
                    {/* Overdue warning */}
                    {periods.overdueVatCount > 0 && (
                      <div className="p-3 rounded bg-yellow-100 border border-yellow-300 text-sm">
                        <p className="font-semibold text-yellow-800">
                          You have {periods.overdueVatCount} overdue VAT return
                          {periods.overdueVatCount > 1 ? "s" : ""} that must be
                          filed in order.
                        </p>
                      </div>
                    )}

                    {/* VAT activity summary */}
                    <div className="p-3 rounded bg-white border text-sm">
                      <h4 className="font-semibold mb-1">
                        VAT Summary (Last 5 Years)
                      </h4>
                      <p>
                        Output VAT:{" "}
                        <span className="font-semibold text-blue-700">
                          £{periods.totalVatOutput.toFixed(2)}
                        </span>
                      </p>
                      <p>
                        Input VAT:{" "}
                        <span className="font-semibold text-green-700">
                          £{periods.totalVatInput.toFixed(2)}
                        </span>
                      </p>
                      <p>
                        Net VAT:{" "}
                        <span
                          className={
                            periods.totalVatOwed > 0
                              ? "font-semibold text-red-700"
                              : periods.totalVatOwed < 0
                              ? "font-semibold text-blue-700"
                              : "font-semibold text-gray-700"
                          }
                        >
                          £{periods.totalVatOwed.toFixed(2)}
                        </span>
                      </p>
                    </div>

                    {/* How to file late returns */}
                    <details className="p-3 rounded bg-white border text-sm">
                      <summary className="font-semibold cursor-pointer">
                        How to file late VAT returns
                      </summary>
                      <div className="mt-2 space-y-1">
                        <p>
                          1. Start with the oldest overdue VAT period in the
                          list.
                        </p>
                        <p>
                          2. Click “View” to review the VAT return for that
                          period.
                        </p>
                        <p>
                          3. When you are happy, click “Validate VAT (MTD)” and
                          then “Submit to HMRC (MTD)”.
                        </p>
                        <p>4. Repeat for the next oldest overdue period.</p>
                        <p className="mt-1 text-xs text-gray-600">
                          HMRC requires VAT returns to be filed in
                          chronological order. Newer periods may be blocked
                          until older ones are submitted.
                        </p>
                      </div>
                    </details>

                    {/* VAT Payments */}
                    <div>
                      <h3 className="text-lg font-semibold mb-2">
                        VAT Payments
                      </h3>

                      <div className="mb-4">
                        <p className="font-medium">
                          Total VAT Owed:{" "}
                          <span className="text-red-600">
                            £{periods.totalVatOwed.toFixed(2)}
                          </span>
                        </p>
                        <p className="font-medium">
                          Total VAT Paid:{" "}
                          <span className="text-green-600">
                            £{periods.totalVatPaid.toFixed(2)}
                          </span>
                        </p>
                        <p className="font-bold mt-2">
                          VAT Balance:{" "}
                          <span
                            className={
                              periods.vatBalance > 0
                                ? "text-red-600"
                                : periods.vatBalance < 0
                                ? "text-blue-600"
                                : "text-green-600"
                            }
                          >
                            £{periods.vatBalance.toFixed(2)}
                          </span>
                        </p>
                      </div>

                      {/* Add VAT Payment */}
                      <div className="mb-4 p-3 border rounded bg-white">
                        <h4 className="font-semibold mb-2">
                          Add VAT Payment / Refund
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            type="date"
                            className="border p-2 rounded"
                            id="vatPaymentDate"
                          />
                          <input
                            type="number"
                            step="0.01"
                            className="border p-2 rounded"
                            placeholder="Amount (£)"
                            id="vatPaymentAmount"
                          />
                          <select
                            className="border p-2 rounded"
                            id="vatPaymentDirection"
                          >
                            <option value="payment">Payment to HMRC</option>
                            <option value="refund">Refund from HMRC</option>
                          </select>
                          <input
                            type="text"
                            className="border p-2 rounded"
                            placeholder="Reference (optional)"
                            id="vatPaymentReference"
                          />
                        </div>

                        <button
                          className="mt-3 bg-blue-600 text-white px-4 py-2 rounded"
                          onClick={async () => {
                            const paymentDate =
                              document.getElementById("vatPaymentDate").value;
                            const amount =
                              document.getElementById("vatPaymentAmount").value;
                            const direction =
                              document.getElementById(
                                "vatPaymentDirection"
                              ).value;
                            const reference =
                              document.getElementById(
                                "vatPaymentReference"
                              ).value;

                            if (!paymentDate || !amount) {
                              alert("Please enter a date and amount.");
                              return;
                            }

                            const res = await fetch("/api/vat/add-payment", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                clientId: session.user.clientId,
                                paymentDate,
                                amount,
                                direction,
                                reference,
                              }),
                            });

                            const data = await res.json();
                            if (data.success) {
                              alert("VAT payment recorded.");
                              fetchPeriods();
                            } else {
                              alert("Error: " + data.error);
                            }
                          }}
                        >
                          Add Payment
                        </button>
                      </div>

                      {/* VAT Payment History */}
                      <h4 className="font-semibold mb-2">Payment History</h4>

                      {periods.vatPayments.length > 0 ? (
                        <ul className="space-y-2">
                          {periods.vatPayments.map((p) => (
                            <li
                              key={p.id}
                              className="flex justify-between items-center border p-2 rounded bg-white"
                            >
                              <span>{p.payment_date}</span>
                              <span
                                className={
                                  p.direction === "payment"
                                    ? "text-red-600"
                                    : "text-blue-600"
                                }
                              >
                                {p.direction === "payment"
                                  ? "Paid to HMRC"
                                  : "Refund from HMRC"}
                              </span>
                              <span className="font-semibold">
                                £{p.amount.toFixed(2)}
                              </span>
                              <span className="text-gray-500">
                                {p.reference || ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No VAT payments recorded yet.</p>
                      )}
                    </div>
                  </div>
                )}

                {/* CORPORATION TAX SUMMARY */}
                {tax.key === "corp" && (
                  <div className="mt-4 p-4 border rounded bg-gray-50">
                    <h3 className="text-lg font-semibold mb-2">
                      Corporation Tax Summary
                    </h3>

                    <p className="font-medium">
                      Latest Period: {periods.corp[0]?.periodLabel || "—"}
                    </p>

                    <p className="font-medium">
                      CT Due:{" "}
                      <span className="text-red-600">
                        £{periods.totalCorpTaxDue.toFixed(2)}
                      </span>
                    </p>

                    <p className="font-medium">
                      CT Paid:{" "}
                      <span className="text-blue-600">
                        £{periods.totalCtPaid.toFixed(2)}
                      </span>
                    </p>

                    <p className="font-bold mt-2">
                      CT Balance:{" "}
                      <span
                        className={
                          periods.ctBalance > 0
                            ? "text-red-600"
                            : periods.ctBalance < 0
                            ? "text-green-600"
                            : "text-gray-700"
                        }
                      >
                        £{periods.ctBalance.toFixed(2)}
                      </span>
                    </p>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => router.push("/corp")}
                        className="bg-blue-600 text-white px-4 py-2 rounded"
                      >
                        View Corporation Tax
                      </button>

                      <button
                        onClick={() => router.push("/corp/history")}
                        className="bg-gray-700 text-white px-4 py-2 rounded"
                      >
                        History
                      </button>
                    </div>
                  </div>
                )}

                {/* SELF ASSESSMENT CARD */}
                {tax.key === "sa" && (
                  <div className="mt-4 p-4 border rounded bg-gray-50">
                    <h3 className="text-lg font-semibold mb-2">
                      Self Assessment Summary
                    </h3>

                    <p className="font-medium">
                      Latest Tax Year: {periods.saLatestYear || "—"}
                    </p>

                    <p className="font-medium">
                      Total Income:{" "}
                      <span className="text-green-700">
                        £{periods.totalSaIncome.toFixed(2)}
                      </span>
                    </p>

                    <p className="font-medium">
                      Total Expenses:{" "}
                      <span className="text-red-600">
                        £{periods.totalSaExpenses.toFixed(2)}
                      </span>
                    </p>

                    <p className="font-medium">
                      Profit:{" "}
                      <span className="text-blue-700">
                        £{periods.saProfit.toFixed(2)}
                      </span>
                    </p>

                    <p className="font-bold mt-2">
                      Estimated Tax:{" "}
                      <span className="text-purple-700">
                        £{periods.saTax.toFixed(2)}
                      </span>
                    </p>

                    <p className="mt-2 font-semibold">
                      Status:{" "}
                      <span
                        className={
                          periods.saLocked ? "text-red-600" : "text-green-600"
                        }
                      >
                        {periods.saLocked ? "Locked" : "Open"}
                      </span>
                    </p>

                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => router.push("/sa")}
                        className="bg-blue-600 text-white px-4 py-2 rounded"
                      >
                        View SA
                      </button>

                      <button
                        onClick={() => router.push("/sa/history")}
                        className="bg-gray-700 text-white px-4 py-2 rounded"
                      >
                        History
                      </button>
                    </div>
                  </div>
                )}

                {/* VAT cockpit, CIS cockpit, generic list for Corp / SA */}
                {tax.key === "vat" ? (
                  <>
                    {/* View latest VAT return */}
                    {vatPeriods.length > 0 && (
                      <button
                        className="mt-4 mb-2 bg-blue-700 text-white px-3 py-1 rounded text-sm"
                        onClick={() =>
                          router.push(
                            `/vat?from=${vatPeriods[0].periodStart}&to=${vatPeriods[0].periodEnd}`
                          )
                        }
                      >
                        View Latest VAT Return
                      </button>
                    )}

                    {vatPeriods.length > 0 ? (
                      <div className="mt-2 space-y-4">
                       {/* Active / recent VAT periods */}
<div>
  <h4 className="font-semibold mb-2">Active VAT Periods</h4>
  <ul className="space-y-2">
    {activeVatPeriods.map((p) => {
      const periodKey = getVatKey(p);
      const mtd = mtdVatState[periodKey] || {};

      const isValidating = !!mtd.validating;
      const isSubmitting = !!mtd.submitting;
      const hasSubmissionId = !!mtd.submissionId;

      // ⭐ VAT PAGE LOGIC (simple + reliable)
      const canValidate = !isValidating && !isSubmitting;
      const canSubmit = hasSubmissionId && !isSubmitting;

      return (
        <li
          key={periodKey}
          className="border p-3 rounded bg-white space-y-2"
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold">{p.periodLabel}</p>
              <p className="text-sm text-gray-600">
                Status: {p.status}
              </p>
            </div>

            <button
              className="bg-blue-600 text-white px-3 py-1 rounded"
              onClick={() =>
                router.push(
                  `/vat?from=${p.periodStart}&to=${p.periodEnd}`
                )
              }
            >
              View
            </button>
          </div>

          {/* ⭐ PDF Download Button */}
<button
  className="bg-purple-600 text-white px-3 py-1 rounded text-sm"
  onClick={async () => {
    try {
      //
      // 1. Fetch VAT summary (REAL box values, transactions, adjustments)
      //
      const summaryRes = await fetch("/api/vat/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.clientId,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
        }),
      });

      const summary = await summaryRes.json();
      if (!summaryRes.ok) throw new Error(summary.error);

      //
      // 2. Fetch client profile (name, email, phone, address, VAT number, etc.)
      //
      const profileRes = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: session.user.clientId,
        }),
      });

      const profile = await profileRes.json();
      if (!profileRes.ok) throw new Error(profile.error);

      //
      // 3. Generate VAT PDF using the summary + profile data
      //
      const pdfRes = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "vat",
          clientId: session.user.clientId,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,

          // VAT data
          vatBoxes: summary.boxes,
          transactions: summary.transactions,
          adjustments: summary.adjustments,

          // Full client identity block
          companyDetails: profile.client || {},
        }),
      });

      const pdf = await pdfRes.json();
      if (!pdfRes.ok) throw new Error(pdf.error);

      //
      // 4. Open the generated PDF
      //
      window.open(pdf.pdf.url, "_blank");
    } catch (err) {
      alert("PDF error: " + err.message);
    }
  }}
>
  Download VAT PDF
</button>








          {/* MTD Buttons */}
          <div className="flex gap-2">
            {/* Validate VAT (MTD) */}
            <button
              className={`px-2 py-1 rounded text-white ${
                canValidate
                  ? "bg-yellow-500"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
              disabled={!canValidate}
              onClick={async () => {
                if (!canValidate) return;
                if (
                  !confirm(
                    `Validate VAT period ${p.periodLabel} for MTD?`
                  )
                )
                  return;

                updateMtdVatState(periodKey, {
                  validating: true,
                });

                try {
                  const res = await fetch(
                    `/api/mtd/vat/validate`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        clientId: session.user.clientId,
                        periodStart: p.periodStart,
                        periodEnd: p.periodEnd,
                      }),
                    }
                  );

                  const data = await res.json();

                  if (!res.ok || !data.submissionId) {
                    throw new Error(
                      data.error ||
                        "Failed to validate VAT return"
                    );
                  }

                  updateMtdVatState(periodKey, {
                    submissionId: data.submissionId,
                  });

                  alert(
                    `VAT period ${p.periodLabel} validated for MTD. You can now submit to HMRC.`
                  );
                } catch (err) {
                  alert("Validation error: " + err.message);
                } finally {
                  updateMtdVatState(periodKey, {
                    validating: false,
                  });
                }
              }}
            >
              {isValidating ? "Validating…" : "Validate VAT (MTD)"}
            </button>

            {/* Submit to HMRC (MTD) */}
            <button
              className={`px-2 py-1 rounded text-white ${
                canSubmit
                  ? "bg-green-600"
                  : "bg-gray-400 cursor-not-allowed"
              }`}
              disabled={!canSubmit}
              onClick={async () => {
                if (!canSubmit) return;
                if (
                  !confirm(
                    `Submit VAT period ${p.periodLabel} to HMRC (MTD)?`
                  )
                )
                  return;

                updateMtdVatState(periodKey, {
                  submitting: true,
                });

                try {
                  const res = await fetch(
                    `/api/mtd/vat/submit`,
                    {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        submissionId: mtd.submissionId,
                      }),
                    }
                  );

                  const data = await res.json();

                  if (!res.ok || !data.success) {
                    throw new Error(
                      data.error ||
                        "HMRC submission failed"
                    );
                  }

                  alert(
                    `VAT period ${p.periodLabel} submitted to HMRC and locked successfully.`
                  );

                  await fetchPeriods();
                } catch (err) {
                  alert(
                    "Submission error: " + err.message
                  );
                } finally {
                  updateMtdVatState(periodKey, {
                    submitting: false,
                  });
                }
              }}
            >
              {isSubmitting ? "Submitting…" : "Submit to HMRC (MTD)"}
            </button>
          </div>
        </li>
      );
    })}
  </ul>
</div>


                        {/* Older VAT periods (collapsible) */}
                        {olderVatPeriods.length > 0 && (
                          <div>
                            <button
                              className="text-sm text-blue-700 underline"
                              onClick={() =>
                                setShowOlderVatPeriods((prev) => !prev)
                              }
                            >
                              {showOlderVatPeriods
                                ? "Hide older VAT periods"
                                : `Show older VAT periods (${olderVatPeriods.length})`}
                            </button>

                            {showOlderVatPeriods && (
                              <ul className="space-y-2 mt-2 text-sm">
                                {olderVatPeriods.map((p) => (
                                  <li
                                    key={p.periodStart}
                                    className="flex justify-between items-center border p-2 rounded"
                                  >
                                    <div>
                                      <div>{p.periodLabel}</div>
                                      <div className="text-xs text-gray-600">
                                        Net VAT:{" "}
                                        <span
                                          className={
                                            p.netVat > 0
                                              ? "text-red-600 font-semibold"
                                              : p.netVat < 0
                                              ? "text-blue-600 font-semibold"
                                              : "text-gray-700 font-semibold"
                                          }
                                        >
                                          £{p.netVat.toFixed(2)}
                                        </span>
                                        {" • "}
                                        <span
                                          className={
                                            p.status === "Overdue"
                                              ? "text-red-600 font-semibold"
                                              : p.status === "Submitted"
                                              ? "text-green-700 font-semibold"
                                              : "text-gray-800 font-semibold"
                                          }
                                        >
                                          {p.status}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex gap-2 items-center">
                                      <button
                                        className="bg-blue-600 text-white px-2 py-1 rounded"
                                        onClick={() =>
                                          router.push(
                                            `/vat?from=${p.periodStart}&to=${p.periodEnd}`
                                          )
                                        }
                                      >
                                        View
                                      </button>
                                      {/* Older VAT periods kept as view-only for now; filing done via active list respecting chronological rules */}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-4">No VAT periods available.</p>
                    )}
                  </>
                ) : tax.key === "cis" ? (
                  <>
                    {/* ✅ CIS cockpit summary + help + periods */}

                    {/* Overdue CIS warning */}
                    {overdueCisCount > 0 && (
                      <div className="mt-4 p-3 rounded bg-yellow-100 border border-yellow-300 text-sm">
                        <p className="font-semibold text-yellow-800">
                          You have {overdueCisCount} overdue CIS return
                          {overdueCisCount > 1 ? "s" : ""} that should be filed
                          in order.
                        </p>
                      </div>
                    )}

                    {/* CIS activity summary */}
                    <div className="mt-4 p-3 rounded bg-white border text-sm space-y-1">
                      <h4 className="font-semibold mb-1">
                        CIS Summary (Last 5 Years)
                      </h4>
                      <p>
                        CIS Deducted:{" "}
                        <span className="font-semibold text-blue-700">
                          £{totalCisDeducted.toFixed(2)}
                        </span>
                      </p>
                      <p>
                        CIS Suffered:{" "}
                        <span className="font-semibold text-green-700">
                          £{totalCisSuffered.toFixed(2)}
                        </span>
                      </p>
                      <p>
                        Net CIS:{" "}
                        <span
                          className={
                            totalNetCis > 0
                              ? "font-semibold text-red-700"
                              : totalNetCis < 0
                              ? "font-semibold text-blue-700"
                              : "font-semibold text-gray-700"
                          }
                        >
                          £{totalNetCis.toFixed(2)}
                        </span>
                      </p>
                    </div>

                    {/* How to manage CIS returns */}
                    <details className="mt-3 p-3 rounded bg-white border text-sm">
                      <summary className="font-semibold cursor-pointer">
                        How to manage CIS returns
                      </summary>
                      <div className="mt-2 space-y-1">
                        <p>
                          1. Start with the oldest overdue CIS period in the
                          list.
                        </p>
                        <p>2. Click “View” to review that CIS return.</p>
                        <p>
                          3. When you are happy, click “Submit” to send it to
                          HMRC.
                        </p>
                        <p>4. Repeat for the next oldest overdue period.</p>
                        <p className="mt-1 text-xs text-gray-600">
                          HMRC expects returns to be kept up to date. If
                          multiple CIS periods are overdue, file them in
                          chronological order so the ledger stays clean.
                        </p>
                      </div>
                    </details>

                    {/* View latest CIS return */}
                    {cisPeriods.length > 0 && (
                      <button
                        className="mt-4 mb-2 bg-blue-700 text-white px-3 py-1 rounded text-sm"
                        onClick={() =>
                          router.push(
                            `/cis?from=${cisPeriods[0].periodStart}&to=${cisPeriods[0].periodEnd}`
                          )
                        }
                      >
                        View Latest CIS Return
                      </button>
                    )}

                    {cisPeriods.length > 0 ? (
                      <div className="mt-2 space-y-4">
                        {/* Active / recent CIS periods */}
                        <div>
                          <h4 className="font-semibold mb-2">
                            Active CIS Periods
                          </h4>
                          <ul className="space-y-2 text-sm">
                            {activeCisPeriods.map((p) => {
                              const hasUnsubmittedOlder = cisPeriods.some(
                                (other) =>
                                  new Date(other.periodEnd) <
                                    new Date(p.periodEnd) && !other.submitted
                              );

                              const canSubmit =
                                !p.locked &&
                                p.hmrcAuthorized &&
                                !hasUnsubmittedOlder;

                              const netCis =
                                typeof p.netCis === "number"
                                  ? p.netCis
                                  : (p.cisDeducted || 0) -
                                    (p.cisSuffered || 0);

                              return (
                                <li
                                  key={p.periodStart}
                                  className="flex justify-between items-center border p-2 rounded"
                                >
                                  <div>
                                    <div>{p.periodLabel}</div>
                                    <div className="text-xs text-gray-600">
                                      Net CIS:{" "}
                                      <span
                                        className={
                                          netCis > 0
                                            ? "text-red-600 font-semibold"
                                            : netCis < 0
                                            ? "text-blue-600 font-semibold"
                                            : "text-gray-700 font-semibold"
                                        }
                                      >
                                        £{netCis.toFixed(2)}
                                      </span>
                                      {" • "}
                                      <span
                                        className={
                                          p.status === "Overdue"
                                            ? "text-red-600 font-semibold"
                                            : p.status === "Submitted"
                                            ? "text-green-700 font-semibold"
                                            : "text-gray-800 font-semibold"
                                        }
                                      >
                                        {p.status}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex gap-2 items-center">
                                    <button
                                      className="bg-blue-600 text-white px-2 py-1 rounded"
                                      onClick={() =>
                                        router.push(
                                          `/cis?from=${p.periodStart}&to=${p.periodEnd}`
                                        )
                                      }
                                    >
                                      View
                                    </button>

                                    <button
                                      className={`px-2 py-1 rounded text-white ${
                                        canSubmit
                                          ? "bg-green-600"
                                          : "bg-gray-400 cursor-not-allowed"
                                      }`}
                                      disabled={!canSubmit}
                                      onClick={async () => {
                                        if (!canSubmit) return;
                                        if (
                                          !confirm(
                                            `Submit CIS period ${p.periodLabel} to HMRC?`
                                          )
                                        )
                                          return;

                                        try {
                                          const res = await fetch(
                                            `/api/cis/submit`,
                                            {
                                              method: "POST",
                                              headers: {
                                                "Content-Type":
                                                  "application/json",
                                              },
                                              body: JSON.stringify({
                                                clientId:
                                                  session.user.clientId,
                                                periodStart: p.periodStart,
                                                periodEnd: p.periodEnd,
                                              }),
                                            }
                                          );

                                          const data = await res.json();

                                          if (data.success) {
                                            alert(
                                              `CIS period submitted and locked successfully.`
                                            );
                                            fetchPeriods();
                                          } else {
                                            alert(
                                              "Submission failed: " +
                                                data.error
                                            );
                                          }
                                        } catch (err) {
                                          console.error(err);
                                          alert(
                                            "Submission error: " +
                                              err.message
                                          );
                                        }
                                      }}
                                    >
                                      Submit
                                    </button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>

                        {/* Older CIS periods (collapsible) */}
                        {olderCisPeriods.length > 0 && (
                          <div>
                            <button
                              className="text-sm text-blue-700 underline"
                              onClick={() =>
                                setShowOlderCisPeriods((prev) => !prev)
                              }
                            >
                              {showOlderCisPeriods
                                ? "Hide older CIS periods"
                                : `Show older CIS periods (${olderCisPeriods.length})`}
                            </button>

                            {showOlderCisPeriods && (
                              <ul className="space-y-2 mt-2 text-sm">
                                {olderCisPeriods.map((p) => {
                                  const netCis =
                                    typeof p.netCis === "number"
                                      ? p.netCis
                                      : (p.cisDeducted || 0) -
                                        (p.cisSuffered || 0);

                                  return (
                                    <li
                                      key={p.periodStart}
                                      className="flex justify-between items-center border p-2 rounded"
                                    >
                                      <div>
                                        <div>{p.periodLabel}</div>
                                        <div className="text-xs text-gray-600">
                                          Net CIS:{" "}
                                          <span
                                            className={
                                              netCis > 0
                                                ? "text-red-600 font-semibold"
                                                : netCis < 0
                                                ? "text-blue-600 font-semibold"
                                                : "text-gray-700 font-semibold"
                                            }
                                          >
                                            £{netCis.toFixed(2)}
                                          </span>
                                          {" • "}
                                          <span
                                            className={
                                              p.status === "Overdue"
                                                ? "text-red-600 font-semibold"
                                                : p.status === "Submitted"
                                                ? "text-green-700 font-semibold"
                                                : "text-gray-800 font-semibold"
                                            }
                                          >
                                            {p.status}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="flex gap-2 items-center">
                                        <button
                                          className="bg-blue-600 text-white px-2 py-1 rounded"
                                          onClick={() =>
                                            router.push(
                                              `/cis?from=${p.periodStart}&to=${p.periodEnd}`
                                            )
                                          }
                                        >
                                          View
                                        </button>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-4">No CIS periods available.</p>
                    )}
                  </>
                ) : (
                  // Generic period list for Corporation Tax / SA
                  (periods[tax.key] || []).length > 0 ? (
                    <ul className="space-y-2 mt-4">
                      {(periods[tax.key] || []).map((p) => (
                        <li
                          key={p.periodStart}
                          className="flex justify-between items-center border p-2 rounded"
                        >
                          <span>{p.periodLabel}</span>
                          <span
                            className={
                              p.locked
                                ? "text-red-600 font-semibold"
                                : "text-green-600 font-semibold"
                            }
                          >
                            {p.locked ? "Locked" : "Open"}
                          </span>

                          <div className="flex gap-2">
                            <button
                              className="bg-blue-600 text-white px-2 py-1 rounded"
                              onClick={() =>
                                router.push(
                                  `${tax.path}?from=${p.periodStart}&to=${p.periodEnd}`
                                )
                              }
                            >
                              View
                            </button>
                            {/* Generic submit left only for future extension if you ever wire CT/SA to HMRC */}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No periods available.</p>
                  )
                )}
              </ResponsiveCard>
            ))}
          </div>
        )}
      </div>

      {/* ✅ Filing Disclaimer (Updated Strong Version) */}
      <p className="text-xs text-slate-500 mt-8 text-center max-w-2xl mx-auto">
        ProfitLens does not provide tax advice. All calculations are estimates
        only. Users are solely responsible for verifying all figures and
        ensuring accuracy before submitting any tax filings to HMRC.
      </p>
    </ResponsiveLayout>
  );
}
