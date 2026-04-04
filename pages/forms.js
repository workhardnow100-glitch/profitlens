// pages/forms.jsx
export const dynamic = "force-dynamic";

export async function getServerSideProps() {
  return { props: {} };
}

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import ResponsiveLayout from "../components/ResponsiveLayout";

export default function FormsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // 🔐 Subscription + login guard
  useEffect(() => {
    if (status === "loading") return;

    if (session?.user) {
      const isAdmin = session.user.role === "admin";
      const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
        session.user.subscriptionStatus
      );

      if (!(isAdmin || isSubscribedOrTrial)) {
        router.replace("/upgrade");
      }
    } else {
      router.replace("/login");
    }
  }, [session, status, router]);

  // ⭐ Client detection
  const [clientId, setClientId] = useState(null);
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    if (!session?.user) return;

    const id = session.user.actingAsClientId || session.user.clientId;

    setClientId(id);
    setClientName("Your business");
  }, [session]);

  // Form state
  const [selectedCTForm, setSelectedCTForm] = useState("");
  const [selectedSAForm, setSelectedSAForm] = useState("");
  const [selectedCISForm, setSelectedCISForm] = useState("");

  // ⭐ NEW — Accounts form state
  const [selectedAccountsForm, setSelectedAccountsForm] = useState("");

  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // ⭐ CT Adjustments State
  const [lossCarryback, setLossCarryback] = useState("");
  const [groupRelief, setGroupRelief] = useState("");
  const [aiaClaimed, setAiaClaimed] = useState("");
  const [rAndDMultiplier, setRAndDMultiplier] = useState("");
  const [mainPoolBF, setMainPoolBF] = useState("");
  const [specialPoolBF, setSpecialPoolBF] = useState("");
  const [carsPoolBF, setCarsPoolBF] = useState("");

  const [ctAdjustmentsLoaded, setCtAdjustmentsLoaded] = useState(false);
  const [ctValidationError, setCtValidationError] = useState("");

  // ⭐ CT600 Supplement Detection
  const [supplements, setSupplements] = useState(null);
  const [supplementsLoading, setSupplementsLoading] = useState(false);

  const CT_FORMS = [
    { code: "CT600", label: "CT600 — Main Corporation Tax return" },
    { code: "CT600A", label: "CT600A — Loans to participators" },
    { code: "CT600J", label: "CT600J — Disclosure of tax avoidance schemes" },
    { code: "CT600L", label: "CT600L — R&D tax relief" },
    { code: "CT600F", label: "CT600F — Charity exemptions" },
    { code: "CT600M", label: "CT600M — Cross-border royalties" },
    { code: "CT600N", label: "CT600N — Northern Ireland rate" },
  ];

  const SA_FORMS = [
    { code: "SA100", label: "SA100 — Main individual return" },
    { code: "SA103", label: "SA103 — Self-employment pages" },
    { code: "SA105", label: "SA105 — UK property" },
    { code: "SA110", label: "SA110 — Tax calculation summary" },
  ];

  const CIS_FORMS = [
    { code: "CIS300", label: "CIS300 — Monthly contractor return" },
    { code: "CIS_STATEMENT", label: "CIS Subcontractor Statement" },
  ];

  // ⭐ NEW — Accounts frameworks
  const ACCOUNTS_FORMS = [
    { code: "FRS105", label: "FRS 105 — Micro‑entity Accounts" },
    { code: "FRS102_1A", label: "FRS 102 1A — Small Company Accounts" },
  ];

  // ⭐ Helper: non‑negative numeric input
  const handleNonNegativeChange = (setter) => (e) => {
    const raw = e.target.value;
    if (raw === "") {
      setter("");
      setCtValidationError("");
      return;
    }
    const num = Number(raw);
    if (Number.isNaN(num)) {
      setter("");
      setCtValidationError("Values must be numeric.");
      return;
    }
    if (num < 0) {
      setter("0");
      setCtValidationError("Values cannot be negative.");
      return;
    }
    setter(raw);
    setCtValidationError("");
  };

  // ⭐ AUTO‑LOAD CT ADJUSTMENTS
  useEffect(() => {
    if (!selectedCTForm || !clientId || !periodStart || !periodEnd) {
      setCtAdjustmentsLoaded(false);
      return;
    }

    const loadAdjustments = async () => {
      try {
        const res = await fetch(
          `/api/forms/ct600/load?clientId=${clientId}&periodStart=${periodStart}&periodEnd=${periodEnd}`
        );

        const data = await res.json();
        if (!data.success || !data.adjustments) {
          setCtAdjustmentsLoaded(false);
          return;
        }

        const a = data.adjustments;

        setLossCarryback(a.loss_carryback ?? "");
        setGroupRelief(a.group_relief ?? "");
        setAiaClaimed(a.ca_aia_claimed ?? "");
        setRAndDMultiplier(a.r_and_d_multiplier ?? "");
        setMainPoolBF(a.ca_main_pool_bf ?? "");
        setSpecialPoolBF(a.ca_special_pool_bf ?? "");
        setCarsPoolBF(a.ca_cars_pool_bf ?? "");

        const anyLoaded =
          a.loss_carryback ||
          a.group_relief ||
          a.ca_aia_claimed ||
          a.r_and_d_multiplier ||
          a.ca_main_pool_bf ||
          a.ca_special_pool_bf ||
          a.ca_cars_pool_bf;

        setCtAdjustmentsLoaded(Boolean(anyLoaded));
      } catch (err) {
        console.error("Failed to load CT adjustments", err);
        setCtAdjustmentsLoaded(false);
      }
    };

    loadAdjustments();
  }, [selectedCTForm, clientId, periodStart, periodEnd]);

  // ⭐ AUTO‑LOAD CT600 SUPPLEMENTS
  useEffect(() => {
    if (!clientId || !periodStart || !periodEnd) {
      setSupplements(null);
      return;
    }

    const loadSupplements = async () => {
      try {
        setSupplementsLoading(true);

        const res = await fetch(
          `/api/forms/ct600/supplements?clientId=${clientId}&periodStart=${periodStart}&periodEnd=${periodEnd}`
        );

        const data = await res.json();
        if (data.success) {
          setSupplements(data.supplements);
        } else {
          setSupplements(null);
        }
      } catch (err) {
        console.error("Failed to load supplements", err);
        setSupplements(null);
      } finally {
        setSupplementsLoading(false);
      }
    };

    loadSupplements();
  }, [clientId, periodStart, periodEnd]);

  // ⭐ Save CT Adjustments
  const handleSaveCTAdjustments = async () => {
    setErrorMessage(null);
    setResultMessage(null);

    if (ctValidationError) {
      setErrorMessage("Please fix CT adjustment validation errors before saving.");
      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch("/api/forms/ct600/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          periodStart,
          periodEnd,
          lossCarryback,
          groupRelief,
          aiaClaimed,
          rAndDMultiplier,
          mainPoolBF,
          specialPoolBF,
          carsPoolBF,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to save CT adjustments.");
      }

      setResultMessage("CT adjustments saved successfully.");
      setCtAdjustmentsLoaded(true);
    } catch (err) {
      setErrorMessage(err.message || "Failed to save CT adjustments.");
    } finally {
      setIsLoading(false);
    }
  };
  // ⭐ Generate single form (CT, SA, CIS, ACCOUNTS)
  const handleGenerate = async (category) => {
    setResultMessage(null);
    setErrorMessage(null);

    const formCode =
      category === "CT"
        ? selectedCTForm
        : category === "SA"
        ? selectedSAForm
        : category === "CIS"
        ? selectedCISForm
        : selectedAccountsForm;

    if (!clientId) {
      setErrorMessage("No client selected.");
      return;
    }

    if (!formCode) {
      setErrorMessage("Please select a form.");
      return;
    }

    if (!periodStart || !periodEnd) {
      setErrorMessage("Please select a period start and end date.");
      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch("/api/forms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          formCode,
          periodStart,
          periodEnd,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to generate form.");
      }

      setResultMessage(
        `Form ${formCode} generated successfully. PDF saved and available for download.`
      );
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  // ⭐ Generate full CT pack
  const handleGeneratePack = async () => {
    setResultMessage(null);
    setErrorMessage(null);

    if (!clientId || !periodStart || !periodEnd) {
      setErrorMessage("Client and period must be selected.");
      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch("/api/forms/generate-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          periodStart,
          periodEnd,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to generate CT pack.");
      }

      setResultMessage(`CT pack generated: ${data.generated.join(", ")}`);
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ResponsiveLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Forms &amp; Returns</h1>
          <p className="text-sm text-gray-600">
            Generate Corporation Tax (CT600), Self Assessment, CIS, and Statutory Accounts automatically from your
            transaction data.
          </p>

          <p className="text-sm text-blue-700 font-medium">
            Generating forms for:{" "}
            <span className="font-semibold">{clientName}</span>
          </p>
        </header>

        {/* Compliance */}
        <section className="border border-amber-300 bg-amber-50 text-amber-900 rounded-md p-4 text-sm space-y-2">
          <h2 className="font-semibold">Important before you generate any form</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>All relevant transactions must already be imported and categorised.</li>
            <li>ProfitLens auto-fills forms from your transactions and related tables.</li>
            <li>You must seek an accountant audit before submitting anything to HMRC.</li>
            <li>You remain responsible for the accuracy of all submissions.</li>
          </ul>
        </section>

        {/* Period selection */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Period start</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Period end</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
              />
            </div>
          </div>
        </section>

        {/* Forms */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CT */}
          <div className="border rounded-md p-4 space-y-3">
            <h2 className="font-semibold text-sm">Corporation Tax (CT)</h2>
            <select
              value={selectedCTForm}
              onChange={(e) => setSelectedCTForm(e.target.value)}
              className="border rounded px-2 py-2 text-sm w-full"
            >
              <option value="">Select CT form…</option>
              {CT_FORMS.map((form) => (
                <option key={form.code} value={form.code}>
                  {form.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleGenerate("CT")}
              disabled={isLoading}
              className="w-full bg-blue-600 text-white text-sm font-medium py-2 rounded disabled:opacity-50"
            >
              {isLoading ? "Generating…" : "Generate CT form"}
            </button>
          </div>

          {/* ⭐ CT Adjustments Panel */}
          {selectedCTForm && (
            <div className="border rounded-md p-4 space-y-3 bg-gray-50 md:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">CT Adjustments (Optional)</h3>
                {ctAdjustmentsLoaded && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    Loaded from previous period
                  </span>
                )}
              </div>

              {ctValidationError && (
                <p className="text-xs text-red-600">{ctValidationError}</p>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Loss Carryback ⓘ
                  </label>
                  <input
                    type="number"
                    value={lossCarryback}
                    onChange={handleNonNegativeChange(setLossCarryback)}
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Group Relief ⓘ
                  </label>
                  <input
                    type="number"
                    value={groupRelief}
                    onChange={handleNonNegativeChange(setGroupRelief)}
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    AIA Claimed ⓘ
                  </label>
                  <input
                    type="number"
                    value={aiaClaimed}
                    onChange={handleNonNegativeChange(setAiaClaimed)}
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    R&D Multiplier ⓘ
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rAndDMultiplier}
                    onChange={handleNonNegativeChange(setRAndDMultiplier)}
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Main Pool B/F ⓘ
                  </label>
                  <input
                    type="number"
                    value={mainPoolBF}
                    onChange={handleNonNegativeChange(setMainPoolBF)}
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Special Pool B/F ⓘ
                  </label>
                  <input
                    type="number"
                    value={specialPoolBF}
                    onChange={handleNonNegativeChange(setSpecialPoolBF)}
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Cars Pool B/F ⓘ
                  </label>
                  <input
                    type="number"
                    value={carsPoolBF}
                    onChange={handleNonNegativeChange(setCarsPoolBF)}
                    className="border rounded px-2 py-1 w-full"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveCTAdjustments}
                disabled={isLoading}
                className="w-full bg-gray-700 text-white text-sm font-medium py-2 rounded disabled:opacity-50"
              >
                {isLoading ? "Saving…" : "Save CT Adjustments"}
              </button>
            </div>
          )}

          {/* ⭐ CT600 Supplement Detection + Full Pack */}
          {supplements && (
            <section className="border border-blue-200 bg-blue-50 rounded-md p-4 space-y-2 text-sm md:col-span-3">
              <h3 className="font-semibold">Detected CT600 Supplements</h3>

              {supplementsLoading ? (
                <p className="text-xs text-gray-600">Checking supplements…</p>
              ) : (
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    CT600A — Loans to Participators:{" "}
                    <strong>{supplements.ct600ARequired ? "Yes" : "No"}</strong>
                  </li>
                  <li>
                    CT600J — DOTAS Disclosure:{" "}
                    <strong>{supplements.ct600JRequired ? "Yes" : "No"}</strong>
                  </li>
                  <li>
                    CT600L — R&D Supplement:{" "}
                    <strong>{supplements.ct600LRequired ? "Yes" : "No"}</strong>
                  </li>
                  <li>
                    CT600F — Charity Exemptions:{" "}
                    <strong>{supplements.ct600FRequired ? "Yes" : "No"}</strong>
                  </li>
                  <li>
                    CT600M — Cross-Border Royalties:{" "}
                    <strong>{supplements.ct600MRequired ? "Yes" : "No"}</strong>
                  </li>
                  <li>
                    CT600N — Northern Ireland Rate:{" "}
                    <strong>{supplements.ct600NRequired ? "Yes" : "No"}</strong>
                  </li>
                </ul>
              )}

              <button
                type="button"
                onClick={handleGeneratePack}
                disabled={isLoading}
                className="mt-3 w-full bg-indigo-600 text-white text-sm font-medium py-2 rounded disabled:opacity-50"
              >
                {isLoading ? "Generating CT Pack…" : "Generate Full CT Pack"}
              </button>
            </section>
          )}

          {/* ⭐ ACCOUNTS SECTION */}
          <div className="border rounded-md p-4 space-y-3">
            <h2 className="font-semibold text-sm">Statutory Accounts</h2>
            <select
              value={selectedAccountsForm}
              onChange={(e) => setSelectedAccountsForm(e.target.value)}
              className="border rounded px-2 py-2 text-sm w-full"
            >
              <option value="">Select accounts framework…</option>
              {ACCOUNTS_FORMS.map((form) => (
                <option key={form.code} value={form.code}>
                  {form.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleGenerate("ACCOUNTS")}
              disabled={isLoading}
              className="w-full bg-purple-600 text-white text-sm font-medium py-2 rounded disabled:opacity-50"
            >
              {isLoading ? "Generating…" : "Generate Accounts PDF"}
            </button>
          </div>

          {/* SA */}
          <div className="border rounded-md p-4 space-y-3">
            <h2 className="font-semibold text-sm">Self Assessment (SA)</h2>
            <select
              value={selectedSAForm}
              onChange={(e) => setSelectedSAForm(e.target.value)}
              className="border rounded px-2 py-2 text-sm w-full"
            >
              <option value="">Select SA form…</option>
              {SA_FORMS.map((form) => (
                <option key={form.code} value={form.code}>
                  {form.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleGenerate("SA")}
              disabled={isLoading}
              className="w-full bg-green-600 text-white text-sm font-medium py-2 rounded disabled:opacity-50"
            >
              {isLoading ? "Generating…" : "Generate SA form"}
            </button>
          </div>

          {/* CIS */}
          <div className="border rounded-md p-4 space-y-3">
            <h2 className="font-semibold text-sm">Construction Industry Scheme (CIS)</h2>
            <select
              value={selectedCISForm}
              onChange={(e) => setSelectedCISForm(e.target.value)}
              className="border rounded px-2 py-2 text-sm w-full"
            >
              <option value="">Select CIS form…</option>
              {CIS_FORMS.map((form) => (
                <option key={form.code} value={form.code}>
                  {form.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleGenerate("CIS")}
              disabled={isLoading}
              className="w-full bg-amber-600 text-white text-sm font-medium py-2 rounded disabled:opacity-50"
            >
              {isLoading ? "Generating…" : "Generate CIS form"}
            </button>
          </div>
        </section>

        {/* Messages */}
        {resultMessage && (
          <div className="border border-emerald-300 bg-emerald-50 text-emerald-900 rounded-md p-3 text-sm">
            {resultMessage}
          </div>
        )}
        {errorMessage && (
          <div className="border border-red-300 bg-red-50 text-red-900 rounded-md p-3 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Disclaimer */}
        <section className="border border-gray-200 bg-gray-50 rounded-md p-4 text-xs text-gray-600 space-y-1">
          <p>
            ProfitLens generates draft forms and working papers using your transaction data. These
            are <strong>not</strong> a substitute for professional advice.
          </p>
          <p>
            You must review each form carefully and seek an <strong>accountant audit</strong> before
            submitting anything to HMRC.
          </p>
        </section>
      </div>
    </ResponsiveLayout>
  );
}
