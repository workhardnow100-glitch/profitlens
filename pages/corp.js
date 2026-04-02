// pages/corp.js
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";
import { useUser } from "../hooks/useUser";

// ⭐ REQUIRED FOR DRILLDOWN CLASSIFICATION
import { CT_MAP } from "../lib/constants/ctMap";

export default function CorpPage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useUser();

  // 🔹 ALL HOOKS MUST COME BEFORE ANY CONDITIONAL RETURN
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // CT payments (front-end view only)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDirection, setPaymentDirection] = useState("payment");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentTotals, setPaymentTotals] = useState(null);

  // CT MTD (HMRC) cockpit state
  const [ctStatus, setCtStatus] = useState(null);
  const [ctObligations, setCtObligations] = useState([]);
  const [ctReturns, setCtReturns] = useState([]);
  const [ctLiabilities, setCtLiabilities] = useState([]);
  const [ctPayments, setCtPayments] = useState([]);
  const [ctLoading, setCtLoading] = useState(false);
  const [ctError, setCtError] = useState(null);

  // CT600 filing engine state
  const [filingLoading, setFilingLoading] = useState(false);
  const [filingError, setFilingError] = useState(null);
  const [filingPack, setFilingPack] = useState(null);
  const [submissionEnvelope, setSubmissionEnvelope] = useState(null);
  const [hmrcSubmission, setHmrcSubmission] = useState(null);

  // Statutory accounts metadata state (drives accountsBuilder.ts)
  const [accountsMetaLoading, setAccountsMetaLoading] = useState(false);
  const [accountsMetaError, setAccountsMetaError] = useState(null);
  const [accountsMetaSavedAt, setAccountsMetaSavedAt] = useState(null);

  const [directorNameInput, setDirectorNameInput] = useState("");
  const [approvalDateInput, setApprovalDateInput] = useState("");

  const [employeesCurrentInput, setEmployeesCurrentInput] = useState("");
  const [employeesPreviousInput, setEmployeesPreviousInput] = useState("");

  const [directorsRemCurrentInput, setDirectorsRemCurrentInput] = useState("");
  const [directorsRemPreviousInput, setDirectorsRemPreviousInput] = useState("");

  const [relatedPartyNotesInput, setRelatedPartyNotesInput] = useState("");
  const [contingentLiabilitiesNotesInput, setContingentLiabilitiesNotesInput] = useState("");
  const [postBalanceSheetEventsNotesInput, setPostBalanceSheetEventsNotesInput] = useState("");

  const [accountingPoliciesOverrideInput, setAccountingPoliciesOverrideInput] = useState("");
  const [smallCompaniesRegimeOverrideInput, setSmallCompaniesRegimeOverrideInput] = useState("");

  // Unified client resolution
  const clientId = user?.actingAsClientId ?? user?.clientId;

  // AUTH GUARD
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace("/login");
  }, [isLoading, isAuthenticated, router]);

  // ⭐ FIXED DRILLDOWN GROUPS — SAFE + CORRECT + ABOVE RETURNS
  const { incomeRows, allowableRows, disallowableRows, reviewRows } = useMemo(() => {
    if (
      !result ||
      !Array.isArray(result.transactions) ||
      typeof result.coaMap !== "object" ||
      result.coaMap === null
    ) {
      return {
        incomeRows: [],
        allowableRows: [],
        disallowableRows: [],
        reviewRows: [],
      };
    }

    const incomeRows = [];
    const allowableRows = [];
    const disallowableRows = [];
    const reviewRows = [];

    for (const tx of result.transactions) {
      if (!tx || tx.includedinct === false) continue;

      const category =
        (typeof tx.business_category === "string" && tx.business_category.trim()) ||
        "Uncategorised";

      const amount = Number(tx.amount || 0);

      // SAFE ACCESS
      const coa = result.coaMap?.[tx.coa_id];

      if (!coa) {
        reviewRows.push({ ...tx, ctType: "review" });
        continue;
      }

      const accType = coa.account_type;

      if (CT_MAP?.income?.includes(category) && accType === "INCOME" && amount > 0) {
        incomeRows.push({ ...tx, ctType: "income" });
        continue;
      }

      if (CT_MAP?.allowable?.includes(category) && accType === "EXPENSE" && amount < 0) {
        allowableRows.push({ ...tx, ctType: "allowable" });
        continue;
      }

      if (CT_MAP?.disallowable?.includes(category) && accType === "EXPENSE" && amount < 0) {
        disallowableRows.push({ ...tx, ctType: "disallowable" });
        continue;
      }

      reviewRows.push({ ...tx, ctType: "review" });
    }

    return { incomeRows, allowableRows, disallowableRows, reviewRows };
  }, [result]);

  // Auto-load statutory metadata once CT summary + period are in place
  useEffect(() => {
    if (clientId && from && to && result) {
      loadAccountsMeta();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, from, to, !!result]);

  // 🔹 ONLY NOW DO WE GATE RENDERING
  if (isLoading) return null;
  if (!isAuthenticated || !user) return null;

  // Fetch CT summary
  async function fetchCorp(start = from, end = to) {
    if (!start || !end) {
      alert("Please select both start and end dates.");
      return;
    }
    if (!clientId) {
      alert("Missing client ID.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/corp/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          periodStart: start,
          periodEnd: end,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        alert("Error fetching Corporation Tax summary: " + (data.error || "Unknown error"));
        return;
      }

      setResult({ ...data, locked: data.locked || false });
    } catch (err) {
      console.error(err);
      alert("Error fetching Corporation Tax summary: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Submit CT period (lock)
  async function submitCorp() {
    if (!from || !to) {
      alert("Please select both start and end dates.");
      return;
    }
    if (!confirm("Lock this Corporation Tax period? This will prevent further edits.")) return;

    setLoading(true);
    try {
      const res = await fetch("/api/corp/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          periodStart: from,
          periodEnd: to,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert("Corporation Tax period locked successfully.");
        setResult((prev) => (prev ? { ...prev, locked: true } : prev));
      } else {
        alert("Error submitting Corporation Tax: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error(err);
      alert("Submission failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Add CT payment
  async function submitPayment() {
    if (!paymentDate || !paymentAmount) {
      alert("Please enter date and amount.");
      return;
    }

    try {
      const res = await fetch("/api/ct/add-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          paymentDate,
          amount: paymentAmount,
          direction: paymentDirection,
          reference: paymentReference,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert("Error adding payment: " + (data.error || "Unknown error"));
        return;
      }

      alert("Payment added successfully.");

      setShowPaymentModal(false);
      setPaymentDate("");
      setPaymentAmount("");
      setPaymentDirection("payment");
      setPaymentReference("");

      if (data.totals) {
        setPaymentTotals(data.totals);
      }

      if (from && to) {
        fetchCorp(from, to);
      }
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    }
  }

  // Fetch CT MTD data
  async function fetchCtMtd() {
    setCtLoading(true);
    setCtError(null);

    try {
      const [statusRes, obligationsRes, returnsRes, liabilitiesRes, paymentsRes] =
        await Promise.all([
          fetch("/api/mtd/ct/status"),
          fetch("/api/mtd/ct/obligations"),
          fetch("/api/mtd/ct/returns"),
          fetch("/api/mtd/ct/liabilities"),
          fetch("/api/mtd/ct/payments"),
        ]);

      const [statusData, obligationsData, returnsData, liabilitiesData, paymentsData] =
        await Promise.all([
          statusRes.json(),
          obligationsRes.json(),
          returnsRes.json(),
          liabilitiesRes.json(),
          paymentsRes.json(),
        ]);

      if (!statusRes.ok) throw new Error(statusData.error || "Error fetching CT MTD status");
      if (!obligationsRes.ok)
        throw new Error(obligationsData.error || "Error fetching CT obligations");
      if (!returnsRes.ok) throw new Error(returnsData.error || "Error fetching CT returns");
      if (!liabilitiesRes.ok)
        throw new Error(liabilitiesData.error || "Error fetching CT liabilities");
      if (!paymentsRes.ok)
        throw new Error(paymentsData.error || "Error fetching CT payments");

      setCtStatus(statusData.status || statusData || null);
      setCtObligations(obligationsData.obligations || obligationsData || []);
      setCtReturns(returnsData.returns || returnsData || []);
      setCtLiabilities(liabilitiesData.liabilities || liabilitiesData || []);
      setCtPayments(paymentsData.payments || paymentsData || []);
    } catch (err) {
      console.error("CT MTD fetch error:", err);
      setCtError(err.message);
    } finally {
      setCtLoading(false);
    }
  }

  // CT600 filing: generate pack
  async function generateFilingPack() {
    if (!clientId) {
      alert("Missing client ID.");
      return;
    }
    if (!from || !to) {
      alert("Please select both start and end dates before generating the filing pack.");
      return;
    }

    setFilingLoading(true);
    setFilingError(null);
    try {
      const res = await fetch("/api/forms/generate-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          periodStart: from,
          periodEnd: to,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setFilingError(data.error || "Error generating filing pack.");
        alert("Error generating filing pack: " + (data.error || "Unknown error"));
        return;
      }

      // { success: true, pack: { ct600PdfUrl, accountsIxbrlUrl, computationsIxbrlUrl, ct600XmlUrl } }
      setFilingPack(data.pack || null);
      alert("Filing pack generated successfully.");
    } catch (err) {
      console.error(err);
      setFilingError(err.message);
      alert("Error generating filing pack: " + err.message);
    } finally {
      setFilingLoading(false);
    }
  }

  // CT600 filing: build submission envelope
  async function buildSubmissionEnvelope() {
    if (!clientId) {
      alert("Missing client ID.");
      return;
    }
    if (!from || !to) {
      alert("Please select both start and end dates before building the submission envelope.");
      return;
    }

    setFilingLoading(true);
    setFilingError(null);
    try {
      const res = await fetch("/api/forms/generate-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          periodStart: from,
          periodEnd: to,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setFilingError(data.error || "Error generating submission envelope.");
        alert("Error generating submission envelope: " + (data.error || "Unknown error"));
        return;
      }

      setSubmissionEnvelope(data.submission || null);
      alert("Submission envelope generated successfully.");
    } catch (err) {
      console.error(err);
      setFilingError(err.message);
      alert("Error generating submission envelope: " + err.message);
    } finally {
      setFilingLoading(false);
    }
  }

  // CT600 filing: submit to HMRC (test or live)
  async function submitToHmrc(environment = "test") {
    if (!clientId) {
      alert("Missing client ID.");
      return;
    }
    if (!from || !to) {
      alert("Please select both start and end dates before submitting to HMRC.");
      return;
    }

    const label = environment === "live" ? "LIVE" : "TEST";
    if (
      environment === "live" &&
      !confirm("Submit this CT600 to HMRC LIVE gateway? This cannot be undone.")
    ) {
      return;
    }

    setFilingLoading(true);
    setFilingError(null);
    try {
      const res = await fetch("/api/forms/submit-to-hmrc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          periodEnd: to,
          environment,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setFilingError(data.error || `Error submitting CT600 to HMRC (${label}).`);
        alert("Error submitting CT600 to HMRC: " + (data.error || "Unknown error"));
        return;
      }

      // { success: true, environment, response: { hmrcResponseUrl } }
      setHmrcSubmission(data.response || null);
      alert(`CT600 submitted to HMRC (${label}) successfully.`);
    } catch (err) {
      console.error(err);
      setFilingError(err.message);
      alert("Error submitting CT600 to HMRC: " + err.message);
    } finally {
      setFilingLoading(false);
    }
  }

  // Load statutory accounts metadata for this client + period
  async function loadAccountsMeta() {
    if (!clientId || !from || !to) return;

    setAccountsMetaLoading(true);
    setAccountsMetaError(null);

    try {
      const res = await fetch("/api/accounts/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          periodStart: from,
          periodEnd: to,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setAccountsMetaError(data.error || "Error loading statutory accounts metadata.");
        return;
      }

      const meta = data.meta || {};

      setDirectorNameInput(
        meta.director_name ||
          meta.directorName ||
          user?.contact_person ||
          user?.business_name ||
          ""
      );
      setApprovalDateInput(meta.accounts_approval_date || meta.approvalDate || to || "");

      setEmployeesCurrentInput(
        meta.employees_current_year != null ? String(meta.employees_current_year) : ""
      );
      setEmployeesPreviousInput(
        meta.employees_previous_year != null ? String(meta.employees_previous_year) : ""
      );

      setDirectorsRemCurrentInput(
        meta.directors_remuneration != null ? String(meta.directors_remuneration) : ""
      );
      setDirectorsRemPreviousInput(
        meta.directors_remuneration_previous != null
          ? String(meta.directors_remuneration_previous)
          : ""
      );

      setRelatedPartyNotesInput(meta.related_party_notes || "");
      setContingentLiabilitiesNotesInput(meta.contingent_liabilities_notes || "");
      setPostBalanceSheetEventsNotesInput(meta.post_balance_sheet_events || "");

      setAccountingPoliciesOverrideInput(meta.accounting_policies_override || "");
      setSmallCompaniesRegimeOverrideInput(meta.small_companies_regime_override || "");

      setAccountsMetaSavedAt(meta.updated_at || meta.created_at || null);
    } catch (err) {
      console.error(err);
      setAccountsMetaError(err.message);
    } finally {
      setAccountsMetaLoading(false);
    }
  }

  // Save statutory accounts metadata
  async function saveAccountsMeta() {
    if (!clientId || !from || !to) {
      alert("Client and period must be selected before saving statutory accounts.");
      return;
    }
    if (result?.locked) {
      alert("This period is locked. Statutory accounts metadata is read‑only.");
      return;
    }

    setAccountsMetaLoading(true);
    setAccountsMetaError(null);

    try {
      const res = await fetch("/api/accounts/meta/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          periodStart: from,
          periodEnd: to,
          directorName: directorNameInput || null,
          approvalDate: approvalDateInput || null,
          employeesCurrent:
            employeesCurrentInput !== "" ? Number(employeesCurrentInput) : null,
          employeesPrevious:
            employeesPreviousInput !== "" ? Number(employeesPreviousInput) : null,
          directorsRemCurrent:
            directorsRemCurrentInput !== "" ? Number(directorsRemCurrentInput) : null,
          directorsRemPrevious:
            directorsRemPreviousInput !== "" ? Number(directorsRemPreviousInput) : null,
          relatedPartyNotes: relatedPartyNotesInput || null,
          contingentLiabilitiesNotes: contingentLiabilitiesNotesInput || null,
          postBalanceSheetEventsNotes: postBalanceSheetEventsNotesInput || null,
          accountingPoliciesOverride: accountingPoliciesOverrideInput || null,
          smallCompaniesRegimeOverride: smallCompaniesRegimeOverrideInput || null,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setAccountsMetaError(data.error || "Error saving statutory accounts metadata.");
        alert("Error saving statutory accounts: " + (data.error || "Unknown error"));
        return;
      }

      setAccountsMetaSavedAt(data.meta?.updated_at || new Date().toISOString());
      alert("Statutory accounts details saved.");
    } catch (err) {
      console.error(err);
      setAccountsMetaError(err.message);
      alert("Error saving statutory accounts: " + err.message);
    } finally {
      setAccountsMetaLoading(false);
    }
  }

  const hasResult = !!result;

  // RENDER
  return (
    <ResponsiveLayout currentPageName="Corporation Tax">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">Corporation Tax</h1>
        <p className="text-slate-600">
          Cockpit view of trading income, allowable expenses, add‑backs, and Corporation Tax
          liability for your chosen accounting year.
        </p>

        {/* Period controls */}
        <ResponsiveCard title="Select Accounting Year">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Period start
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border p-2 rounded w-full"
                disabled={result?.locked}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Period end
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border p-2 rounded w-full"
                disabled={result?.locked}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => fetchCorp()}
                className="bg-blue-600 text-white rounded px-4 py-2 w-full sm:w-auto"
                disabled={result?.locked || loading}
              >
                {loading ? "Loading…" : "Get Summary"}
              </button>
              {hasResult && !result.locked && (
                <button
                  onClick={submitCorp}
                  className="bg-green-600 text-white px-4 py-2 rounded w-full sm:w-auto"
                  disabled={loading}
                >
                  {loading ? "Submitting…" : "Lock Period"}
                </button>
              )}
            </div>
          </div>
        </ResponsiveCard>

        {/* Summary + KPIs */}
        {hasResult && (
          <>
            <ResponsiveCard
              title={`Corporation Tax Summary ${result.locked ? "(Locked)" : ""}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Trading income</p>
                  <p className="text-xl font-semibold text-emerald-700">
                    £{result.income.toFixed(2)}
                  </p>
                </div>
                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Allowable expenses</p>
                  <p className="text-xl font-semibold text-red-600">
                    £{result.allowable.toFixed(2)}
                  </p>
                </div>
                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Add‑backs (disallowable)</p>
                  <p className="text-xl font-semibold text-amber-600">
                    £{result.disallowable.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Profit</p>
                  <p className="text-xl font-semibold text-slate-900">
                    £{result.profit.toFixed(2)}
                  </p>
                </div>
                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Adjusted profit</p>
                  <p className="text-xl font-semibold text-slate-900">
                    £{result.adjustedProfit.toFixed(2)}
                  </p>
                </div>
                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Corporation Tax due</p>
                  <p className="text-xl font-semibold text-indigo-700">
                    £{result.corpTaxDue.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Effective rate: {result.effectiveRate.toFixed(2)}%
                  </p>
                </div>
              </div>

              {reviewRows.length > 0 && (
                <div className="mt-4 p-3 rounded border border-amber-300 bg-amber-50 text-amber-900 text-sm">
                  There are <strong>{reviewRows.length}</strong> transactions marked as{" "}
                  <strong>review/uncategorised</strong>. These do not slot cleanly into HMRC‑aligned
                  CT rules and should be checked before filing.
                </div>
              )}
            </ResponsiveCard>

            {/* Statutory Accounts – cockpit for FRS102‑1A / FRS105 / IFRS */}
            <ResponsiveCard title="Statutory Accounts (FRS102‑1A / FRS105 / IFRS)">
              <p className="text-sm text-slate-600 mb-3">
                These details feed directly into your statutory accounts iXBRL (FRS102‑1A, FRS105 or
                IFRS) used in the CT600 filing pack.
              </p>

              {accountsMetaError && (
                <div className="mb-3 p-3 rounded border border-red-300 bg-red-50 text-red-800 text-sm">
                  Statutory accounts error: {accountsMetaError}
                </div>
              )}

              <div className="flex items-center justify-between mb-4 gap-3">
                <p className="text-xs text-slate-500">
                  Period: {from || "—"} to {to || "—"}{" "}
                  {accountsMetaSavedAt && (
                    <span className="ml-2">
                      • Last saved:{" "}
                      {new Date(accountsMetaSavedAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  )}
                  {result?.locked && (
                    <span className="ml-2 text-amber-700 font-semibold">
                      • Locked – read‑only
                    </span>
                  )}
                </p>
                <button
                  onClick={loadAccountsMeta}
                  className="text-xs px-3 py-1 rounded border border-slate-300 text-slate-700 bg-white hover:bg-slate-50"
                  disabled={accountsMetaLoading || !from || !to}
                >
                  {accountsMetaLoading ? "Loading…" : "Reload details"}
                </button>
              </div>

              {/* Directors & approval */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Director name (signature)
                  </label>
                  <input
                    type="text"
                    value={directorNameInput}
                    onChange={(e) => setDirectorNameInput(e.target.value)}
                    className="border p-2 rounded w-full"
                    disabled={result?.locked}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Accounts approval date
                  </label>
                  <input
                    type="date"
                    value={approvalDateInput}
                    onChange={(e) => setApprovalDateInput(e.target.value)}
                    className="border p-2 rounded w-full"
                    disabled={result?.locked}
                  />
                </div>
              </div>

              {/* Employees & directors’ remuneration */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Employees – current year
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={employeesCurrentInput}
                    onChange={(e) => setEmployeesCurrentInput(e.target.value)}
                    className="border p-2 rounded w-full"
                    disabled={result?.locked}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Employees – previous year
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={employeesPreviousInput}
                    onChange={(e) => setEmployeesPreviousInput(e.target.value)}
                    className="border p-2 rounded w-full"
                    disabled={result?.locked}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Directors’ remuneration – current (£)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={directorsRemCurrentInput}
                    onChange={(e) => setDirectorsRemCurrentInput(e.target.value)}
                    className="border p-2 rounded w-full"
                    disabled={result?.locked}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Directors’ remuneration – previous (£)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={directorsRemPreviousInput}
                    onChange={(e) => setDirectorsRemPreviousInput(e.target.value)}
                    className="border p-2 rounded w-full"
                    disabled={result?.locked}
                  />
                </div>
              </div>

              {/* Narrative notes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Related party transactions (override)
                  </label>
                  <textarea
                    rows={4}
                    value={relatedPartyNotesInput}
                    onChange={(e) => setRelatedPartyNotesInput(e.target.value)}
                    className="border p-2 rounded w-full text-sm"
                    disabled={result?.locked}
                    placeholder="Leave blank to use the standard disclosure."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Contingent liabilities (override)
                  </label>
                  <textarea
                    rows={4}
                    value={contingentLiabilitiesNotesInput}
                    onChange={(e) => setContingentLiabilitiesNotesInput(e.target.value)}
                    className="border p-2 rounded w-full text-sm"
                    disabled={result?.locked}
                    placeholder="Leave blank to use the standard disclosure."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Post balance sheet events (override)
                  </label>
                  <textarea
                    rows={4}
                    value={postBalanceSheetEventsNotesInput}
                    onChange={(e) => setPostBalanceSheetEventsNotesInput(e.target.value)}
                    className="border p-2 rounded w-full text-sm"
                    disabled={result?.locked}
                    placeholder="Leave blank to use the standard disclosure."
                  />
                </div>
              </div>

              {/* Overrides: accounting policies + small companies regime */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Accounting policies (HTML override)
                  </label>
                  <textarea
                    rows={6}
                    value={accountingPoliciesOverrideInput}
                    onChange={(e) => setAccountingPoliciesOverrideInput(e.target.value)}
                    className="border p-2 rounded w-full text-sm font-mono"
                    disabled={result?.locked}
                    placeholder="Optional HTML override. Leave blank to use the standard ProfitLens template."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Small companies / micro‑entity regime statement (HTML override)
                  </label>
                  <textarea
                    rows={6}
                    value={smallCompaniesRegimeOverrideInput}
                    onChange={(e) => setSmallCompaniesRegimeOverrideInput(e.target.value)}
                    className="border p-2 rounded w-full text-sm font-mono"
                    disabled={result?.locked}
                    placeholder="Optional HTML override. Leave blank to use the standard regime statement."
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-slate-500 max-w-xl">
                  These fields flow into the Directors’ report, notes, balance sheet statements and
                  regime statements in your FRS102‑1A / FRS105 / IFRS accounts iXBRL.
                </p>
                <button
                  onClick={saveAccountsMeta}
                  className="bg-emerald-600 text-white px-4 py-2 rounded text-sm"
                  disabled={accountsMetaLoading || !from || !to}
                >
                  {accountsMetaLoading ? "Saving…" : "Save statutory details"}
                </button>
              </div>
            </ResponsiveCard>

            {/* CT600 Filing – new engine */}
            <ResponsiveCard title="CT600 Filing">
              <p className="text-sm text-slate-600 mb-3">
                Generate CT600 PDFs, iXBRL accounts and computations, build the HMRC submission
                envelope, and submit to HMRC. Review all artefacts before filing.
              </p>

              {filingError && (
                <div className="mb-3 p-3 rounded border border-red-300 bg-red-50 text-red-800 text-sm">
                  Filing error: {filingError}
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={generateFilingPack}
                  className="bg-indigo-600 text-white px-4 py-2 rounded text-sm"
                  disabled={filingLoading || !from || !to}
                >
                  {filingLoading ? "Working…" : "Generate Filing Pack"}
                </button>
                <button
                  onClick={buildSubmissionEnvelope}
                  className="bg-slate-800 text-white px-4 py-2 rounded text-sm"
                  disabled={filingLoading || !from || !to}
                >
                  {filingLoading ? "Working…" : "Build Submission Envelope"}
                </button>
                <button
                  onClick={() => submitToHmrc("test")}
                  className="bg-emerald-600 text-white px-4 py-2 rounded text-sm"
                  disabled={filingLoading || !from || !to}
                >
                  {filingLoading ? "Submitting…" : "Submit to HMRC (Test)"}
                </button>
                <button
                  onClick={() => submitToHmrc("live")}
                  className="bg-red-600 text-white px-4 py-2 rounded text-sm"
                  disabled={filingLoading || !from || !to}
                >
                  {filingLoading ? "Submitting…" : "Submit to HMRC (Live)"}
                </button>
              </div>

              {/* Preview artefacts from filing pack */}
              {filingPack && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">
                    Generated artefacts (from filing pack):
                  </p>
                  <ul className="text-xs text-slate-600 space-y-1">
                    {filingPack.ct600PdfUrl && (
                      <li>
                        <a
                          href={filingPack.ct600PdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-700 underline"
                        >
                          View CT600 PDF
                        </a>
                      </li>
                    )}
                    {filingPack.accountsIxbrlUrl && (
                      <li>
                        <a
                          href={filingPack.accountsIxbrlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-700 underline"
                        >
                          View Accounts iXBRL
                        </a>
                      </li>
                    )}
                    {filingPack.computationsIxbrlUrl && (
                      <li>
                        <a
                          href={filingPack.computationsIxbrlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-700 underline"
                        >
                          View Computations iXBRL
                        </a>
                      </li>
                    )}
                    {filingPack.ct600XmlUrl && (
                      <li>
                        <a
                          href={filingPack.ct600XmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-700 underline"
                        >
                          View CT600 XML
                        </a>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Preview submission envelope */}
              {submissionEnvelope && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">
                    HMRC submission envelope:
                  </p>
                  {submissionEnvelope.envelopeUrl ? (
                    <a
                      href={submissionEnvelope.envelopeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-700 underline text-xs"
                    >
                      View Submission Envelope XML
                    </a>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Submission envelope generated, but no URL returned. Check backend response
                      shape.
                    </p>
                  )}
                </div>
              )}

              {/* HMRC response */}
              {hmrcSubmission && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">
                    HMRC response:
                  </p>
                  {hmrcSubmission.hmrcResponseUrl ? (
                    <a
                      href={hmrcSubmission.hmrcResponseUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-700 underline text-xs"
                    >
                      View HMRC Response XML
                    </a>
                  ) : (
                    <p className="text-xs text-slate-500">
                      HMRC response recorded, but no URL returned. Check backend response shape.
                    </p>
                  )}
                </div>
              )}
            </ResponsiveCard>

            {/* Corporation Tax Payments */}
            <ResponsiveCard title="Corporation Tax Payments">
              <p className="text-sm text-slate-600 mb-2">
                Track payments to and refunds from HMRC for this client. These records are stored
                separately from transactions and used for reconciliation.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">CT due (this period)</p>
                  <p className="text-lg font-semibold text-indigo-700">
                    £{result.corpTaxDue.toFixed(2)}
                  </p>
                </div>

                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Total paid (all time)</p>
                  <p className="text-lg font-semibold text-emerald-700">
                    £{paymentTotals?.totalPaid?.toFixed(2) ?? "0.00"}
                  </p>
                </div>

                <div className="border rounded p-3 bg-slate-50">
                  <p className="text-xs uppercase text-slate-500">Net paid (payments - refunds)</p>
                  <p className="text-lg font-semibold text-slate-900">
                    £{paymentTotals?.netPaid?.toFixed(2) ?? "0.00"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowPaymentModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Add payment or refund
              </button>
            </ResponsiveCard>

            {/* Drilldown: Income */}
            <ResponsiveCard title="Trading income breakdown">
              <ResponsiveTable
                columns={[
                  { header: "Date", accessor: "date" },
                  { header: "Description", accessor: "description" },
                  { header: "Category", accessor: "business_category" },
                  { header: "Amount (£)", accessor: "amount" },
                ]}
                data={incomeRows}
              />
            </ResponsiveCard>

            {/* Drilldown: Allowable */}
            <ResponsiveCard title="Allowable expenses breakdown">
              <ResponsiveTable
                columns={[
                  { header: "Date", accessor: "date" },
                  { header: "Description", accessor: "description" },
                  { header: "Category", accessor: "business_category" },
                  { header: "Amount (£)", accessor: "amount" },
                ]}
                data={allowableRows}
              />
            </ResponsiveCard>

            {/* Drilldown: Disallowable */}
            <ResponsiveCard title="Disallowable expenses (add‑backs)">
              <ResponsiveTable
                columns={[
                  { header: "Date", accessor: "date" },
                  { header: "Description", accessor: "description" },
                  { header: "Category", accessor: "business_category" },
                  { header: "Amount (£)", accessor: "amount" },
                ]}
                data={disallowableRows}
              />
            </ResponsiveCard>

            {/* Drilldown: Review */}
            {reviewRows.length > 0 && (
              <ResponsiveCard title="Review / uncategorised transactions">
                <p className="text-sm text-slate-600 mb-2">
                  These rows are not clearly allowable or disallowable. Adjust their categories on
                  the Transactions page to tidy your Corporation Tax position.
                </p>
                <ResponsiveTable
                  columns={[
                    { header: "Date", accessor: "date" },
                    { header: "Description", accessor: "description" },
                    { header: "Category", accessor: "business_category" },
                    { header: "CT Type", accessor: "ctType" },
                    { header: "Amount (£)", accessor: "amount" },
                  ]}
                  data={reviewRows}
                />
              </ResponsiveCard>
            )}
          </>
        )}

        {/* CT MTD – HMRC cockpit */}
        <ResponsiveCard title="HMRC MTD – Corporation Tax">
          <div className="flex items-center justify-between mb-3 gap-3">
            <p className="text-sm text-slate-600">
              Live HMRC view for Corporation Tax: obligations, returns, liabilities and payments for
              the selected client.
            </p>
            <button
              onClick={fetchCtMtd}
              className="bg-indigo-600 text-white px-4 py-2 rounded text-sm"
              disabled={ctLoading}
            >
              {ctLoading ? "Refreshing…" : "Refresh from HMRC"}
            </button>
          </div>

          {ctError && (
            <div className="mb-3 p-3 rounded border border-red-300 bg-red-50 text-red-800 text-sm">
              HMRC error: {ctError}
            </div>
          )}

          {ctStatus && (
            <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded p-3 bg-slate-50">
                <p className="text-xs uppercase text-slate-500">MTD connection</p>
                <p className="text-sm font-semibold text-slate-900">
                  {ctStatus.isConnected ? "Connected" : "Not connected"}
                </p>
                {!ctStatus.isConnected && (
                  <p className="text-xs text-slate-500 mt-1">
                    HMRC did not return CT obligations. Check authorisation or UTR.
                  </p>
                )}
              </div>
              <div className="border rounded p-3 bg-slate-50">
                <p className="text-xs uppercase text-slate-500">Token</p>
                <p className="text-sm font-semibold text-slate-900">
                  {ctStatus.tokenValid ? "Valid" : "Invalid / expired"}
                </p>
              </div>
              <div className="border rounded p-3 bg-slate-50">
                <p className="text-xs uppercase text-slate-500">UTR linked</p>
                <p className="text-sm font-semibold text-slate-900">
                  {ctStatus.utrLinked ? "Yes" : "No"}
                </p>
              </div>
            </div>
          )}

          {/* Obligations */}
          {ctObligations && ctObligations.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                HMRC CT obligations
              </h3>
              <ResponsiveTable
                columns={[
                  { header: "Period start", accessor: "start" },
                  { header: "Period end", accessor: "end" },
                  { header: "Due date", accessor: "due" },
                  { header: "Status", accessor: "status" },
                ]}
                data={ctObligations}
              />
            </div>
          )}

          {/* Returns */}
          {ctReturns && ctReturns.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                HMRC CT returns
              </h3>
              <ResponsiveTable
                columns={[
                  { header: "Period start", accessor: "start" },
                  { header: "Period end", accessor: "end" },
                  { header: "Received", accessor: "received" },
                  { header: "Status", accessor: "status" },
                ]}
                data={ctReturns}
              />
            </div>
          )}

          {/* Liabilities */}
          {ctLiabilities && ctLiabilities.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                HMRC CT liabilities
              </h3>
              <ResponsiveTable
                columns={[
                  { header: "Tax year", accessor: "taxYear" },
                  { header: "Amount (£)", accessor: "amount" },
                  { header: "Due date", accessor: "due" },
                  { header: "Status", accessor: "status" },
                ]}
                data={ctLiabilities}
              />
            </div>
          )}

          {/* Payments */}
          {ctPayments && ctPayments.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-800 mb-2">
                HMRC CT payments
              </h3>
              <ResponsiveTable
                columns={[
                  { header: "Date", accessor: "date" },
                  { header: "Amount (£)", accessor: "amount" },
                  { header: "Reference", accessor: "reference" },
                  { header: "Method", accessor: "method" },
                ]}
                data={ctPayments}
              />
            </div>
          )}

          {!ctLoading &&
            !ctError &&
            !ctStatus &&
            ctObligations.length === 0 &&
            ctReturns.length === 0 &&
            ctLiabilities.length === 0 &&
            ctPayments.length === 0 && (
              <p className="text-xs text-slate-500 mt-2">
                No HMRC CT data loaded yet. Use “Refresh from HMRC” to pull the latest obligations,
                returns, liabilities and payments.
              </p>
            )}
        </ResponsiveCard>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md space-y-4">
            <h2 className="text-xl font-bold">Add Corporation Tax Payment</h2>

            <div className="space-y-2">
              <label className="block font-medium text-sm">Payment date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="border p-2 rounded w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-sm">Amount (£)</label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="border p-2 rounded w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-sm">Direction</label>
              <select
                value={paymentDirection}
                onChange={(e) => setPaymentDirection(e.target.value)}
                className="border p-2 rounded w-full"
              >
                <option value="payment">Payment to HMRC</option>
                <option value="refund">Refund from HMRC</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="block font-medium text-sm">Reference (optional)</label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="border p-2 rounded w-full"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-4 py-2 bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={submitPayment}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Save payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filing Disclaimer */}
      <p className="text-xs text-slate-500 mt-8 text-center max-w-2xl mx-auto">
        ProfitLens does not provide tax advice. All calculations are estimates only. Users are
        solely responsible for verifying all figures and ensuring accuracy before submitting any tax
        filings to HMRC.
      </p>
    </ResponsiveLayout>
  );
}
