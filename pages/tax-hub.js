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

    ctPayments: [],
    totalCorpTaxDue: 0,
    totalCtPaid: 0,
    ctBalance: 0,

    // ✅ SA summary fields
    totalSaIncome: 0,
    totalSaExpenses: 0,
    saProfit: 0,
    saTax: 0,
    saLocked: false,
    saLatestYear: null,
  });

  const [vatStagger, setVatStagger] = useState(1);

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

        ctPayments: data.ctPayments || [],
        totalCorpTaxDue: data.totalCorpTaxDue || 0,
        totalCtPaid: data.totalCtPaid || 0,
        ctBalance: data.ctBalance || 0,

        // ✅ SA summary fields
        totalSaIncome: data.totalSaIncome || 0,
        totalSaExpenses: data.totalSaExpenses || 0,
        saProfit: data.saProfit || 0,
        saTax: data.saTax || 0,
        saLocked: data.saLocked || false,
        saLatestYear: data.saLatestYear || null,
      });

      if (data.vatStagger) setVatStagger(data.vatStagger);

    } catch (err) {
      console.error("Tax Hub periods error:", err);
      alert("Error fetching tax periods: " + err.message);
      setPeriods({ vat: [], cis: [], corp: [], sa: [] });
    } finally {
      setLoading(false);
    }
  }

  if (!session?.user) return null;

  // ✅ ORDER: VAT → CIS → CT → SA
  const taxTypes = [
    { key: "vat", name: "VAT", path: "/vat" },
    { key: "cis", name: "CIS", path: "/cis" },
    { key: "corp", name: "Corporation Tax", path: "/corp" },
    { key: "sa", name: "Self Assessment", path: "/sa" },
  ];

  const needsHMRCAuth = !((periods.vat || []).some((p) => p.hmrcAuthorized));

  return (
    <ResponsiveLayout currentPageName="Tax Hub">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Tax Hub</h1>

        {needsHMRCAuth && !loading && (
          <div className="mb-4">
            <p className="text-yellow-600 mb-2">
              HMRC account not connected. You must authorize to submit VAT/CIS periods.
            </p>
            <a
              href="/api/hmrc/auth"
              className="bg-orange-600 text-white px-4 py-2 rounded"
            >
              Authorize HMRC
            </a>
          </div>
        )}

        {loading ? (
          <p>Loading periods…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {taxTypes.map((tax) => (
              <ResponsiveCard key={tax.key} title={tax.name}>

                {/* ✅ VAT STAGGER */}
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

                {/* ✅ VAT PAYMENTS */}
                {tax.key === "vat" && (
                  <div className="mt-4 p-4 border rounded bg-gray-50">
                    <h3 className="text-lg font-semibold mb-2">VAT Payments</h3>

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
                        <input type="date" className="border p-2 rounded" id="vatPaymentDate" />
                        <input type="number" step="0.01" className="border p-2 rounded" placeholder="Amount (£)" id="vatPaymentAmount" />
                        <select className="border p-2 rounded" id="vatPaymentDirection">
                          <option value="payment">Payment to HMRC</option>
                          <option value="refund">Refund from HMRC</option>
                        </select>
                        <input type="text" className="border p-2 rounded" placeholder="Reference (optional)" id="vatPaymentReference" />
                      </div>

                      <button
                        className="mt-3 bg-blue-600 text-white px-4 py-2 rounded"
                        onClick={async () => {
                          const paymentDate = document.getElementById("vatPaymentDate").value;
                          const amount = document.getElementById("vatPaymentAmount").value;
                          const direction = document.getElementById("vatPaymentDirection").value;
                          const reference = document.getElementById("vatPaymentReference").value;

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
                            <span className={p.direction === "payment" ? "text-red-600" : "text-blue-600"}>
                              {p.direction === "payment" ? "Paid to HMRC" : "Refund from HMRC"}
                            </span>
                            <span className="font-semibold">£{p.amount.toFixed(2)}</span>
                            <span className="text-gray-500">{p.reference || ""}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No VAT payments recorded yet.</p>
                    )}
                  </div>
                )}

                {/* ✅ CORPORATION TAX SUMMARY */}
                {tax.key === "corp" && (
                  <div className="mt-4 p-4 border rounded bg-gray-50">
                    <h3 className="text-lg font-semibold mb-2">Corporation Tax Summary</h3>

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

                {/* ✅ ✅ ✅ SELF ASSESSMENT CARD (NEW) */}
                {tax.key === "sa" && (
                  <div className="mt-4 p-4 border rounded bg-gray-50">
                    <h3 className="text-lg font-semibold mb-2">Self Assessment Summary</h3>

                    <p className="font-medium">
                      Latest Tax Year:{" "}
                      {periods.saLatestYear || "—"}
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
                      <span className={periods.saLocked ? "text-red-600" : "text-green-600"}>
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

                {/* ✅ PERIOD LIST */}
                {(periods[tax.key] || []).length > 0 ? (
                  <ul className="space-y-2 mt-4">
                    {(periods[tax.key] || []).map((p) => (
                      <li
                        key={p.periodStart}
                        className="flex justify-between items-center border p-2 rounded"
                      >
                        <span>{p.periodLabel}</span>
                        <span className={p.locked ? "text-red-600 font-semibold" : "text-green-600 font-semibold"}>
                          {p.locked ? "Locked" : "Open"}
                        </span>

                        <div className="flex gap-2">
                          <button
                            className="bg-blue-600 text-white px-2 py-1 rounded"
                            onClick={() =>
                              router.push(`${tax.path}?from=${p.periodStart}&to=${p.periodEnd}`)
                            }
                          >
                            View
                          </button>

                          {!p.locked && (tax.key === "vat" || tax.key === "cis") && (
                            <button
                              className={`px-2 py-1 rounded text-white ${
                                p.hmrcAuthorized ? "bg-green-600" : "bg-gray-400 cursor-not-allowed"
                              }`}
                              disabled={!p.hmrcAuthorized}
                              onClick={async () => {
                                if (!p.hmrcAuthorized) return;
                                if (!confirm(`Submit ${tax.name} period ${p.periodLabel} to HMRC?`)) return;

                                try {
                                  const res = await fetch(`/api/${tax.key}/submit`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      clientId: session.user.clientId,
                                      periodStart: p.periodStart,
                                      periodEnd: p.periodEnd,
                                    }),
                                  });

                                  const data = await res.json();

                                  if (data.success) {
                                    alert(`${tax.name} period submitted and locked successfully.`);
                                    fetchPeriods();
                                  } else {
                                    alert("Submission failed: " + data.error);
                                  }
                                } catch (err) {
                                  console.error(err);
                                  alert("Submission error: " + err.message);
                                }
                              }}
                            >
                              Submit
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No periods available.</p>
                )}
              </ResponsiveCard>
            ))}
          </div>
        )}
      </div>
    </ResponsiveLayout>
  );
}
