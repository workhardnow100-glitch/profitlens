// pages/forms.jsx
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import ResponsiveLayout from "../components/ResponsiveLayout";

export default function FormsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // 🔐 Subscription + login guard (same as Dashboard)
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

  // ⭐ Auto-detect client (accountants + business owners)
  const [clientId, setClientId] = useState(null);
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    async function loadClient() {
      const res = await fetch("/api/accountant/get-accessible-clients");
      const data = await res.json();

      if (data.success) {
        // Accountant acting as a client
        if (data.currentClient) {
          setClientId(data.currentClient.id);
          setClientName(data.currentClient.name);
          return;
        }

        // Business owner (single client)
        if (data.clients?.length === 1) {
          setClientId(data.clients[0].id);
          setClientName(data.clients[0].name);
        }
      }
    }

    loadClient();
  }, []);

  // Form state
  const [selectedCTForm, setSelectedCTForm] = useState("");
  const [selectedSAForm, setSelectedSAForm] = useState("");
  const [selectedCISForm, setSelectedCISForm] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

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

  const handleGenerate = async (category) => {
    setResultMessage(null);
    setErrorMessage(null);

    const formCode =
      category === "CT"
        ? selectedCTForm
        : category === "SA"
        ? selectedSAForm
        : selectedCISForm;

    if (!clientId) {
      setErrorMessage("No client selected. Please switch or select a client.");
      return;
    }

    if (!formCode) {
      setErrorMessage("Please select a form in the chosen category.");
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
      setErrorMessage(err.message || "Something went wrong while generating the form.");
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
            Generate Corporation Tax (CT600), Self Assessment, and CIS forms automatically from your
            transaction data.
          </p>

          {/* ⭐ Auto-detected client badge */}
          <p className="text-sm text-blue-700 font-medium">
            Generating forms for: <span className="font-semibold">{clientName}</span>
          </p>
        </header>

        {/* Compliance / Requirements */}
        <section className="border border-amber-300 bg-amber-50 text-amber-900 rounded-md p-4 text-sm space-y-2">
          <h2 className="font-semibold">Important before you generate any form</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>
              All relevant <strong>transactions must already be imported and categorised</strong> on
              the Transactions page.
            </li>
            <li>
              ProfitLens auto-fills forms from your <strong>transactions</strong> and related tables
              (CT, SA, CIS). If data is missing or miscategorised, the form will be wrong.
            </li>
            <li>
              <strong>You must seek an accountant audit before submitting any form to HMRC.</strong>
            </li>
            <li>
              You remain <strong>responsible for the accuracy</strong> of all submissions to HMRC.
            </li>
          </ul>
        </section>

        {/* Period selection */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium">Period start</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
              />
            </div>
            <div className="space-y-1">
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
