// pages/journal/new.js
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import useSWR from "swr";

import ResponsiveLayout from "../../components/ResponsiveLayout";
import ResponsiveCard from "../../components/ResponsiveCard";
import ResponsiveTable from "../../components/ResponsiveTable";
import { useUser } from "../../hooks/useUser";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function NewJournalPage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useUser();

  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState([
    { account_id: "", line_description: "", debit: "", credit: "" },
    { account_id: "", line_description: "", debit: "", credit: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [showHelp, setShowHelp] = useState(false); // mobile guidance panel

  // Access guard
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }
  }, [isLoading, isAuthenticated, user, router]);

  // Unified client resolution (same pattern as SA/Corp)
  const clientId = user?.actingAsClientId ?? user?.clientId;

  // Load accounts
  const { data: coaData } = useSWR(
    clientId ? "/api/chart-of-accounts?usedOnly=false" : null,
    fetcher
  );
  const accounts = coaData?.accounts || [];

  // Period lock awareness (reuse journal list API)
  const { data: journalMeta } = useSWR(
    clientId ? `/api/journal/list?clientId=${clientId}` : null,
    fetcher
  );
  const periodLocked = journalMeta?.periodLocked || false;

  const totalDebit = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.debit) || 0), 0),
    [lines]
  );
  const totalCredit = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.credit) || 0), 0),
    [lines]
  );

  function updateLine(index, field, value) {
    setLines((prev) =>
      prev.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      )
    );
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      { account_id: "", line_description: "", debit: "", credit: "" },
    ]);
  }

  function removeLine(index) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (periodLocked) {
      setErrorMsg(
        "This period is locked. New journals cannot be posted in a locked period."
      );
      return;
    }

    const cleanedLines = lines
      .map((l) => ({
        account_id: l.account_id,
        line_description: l.line_description || "",
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      }))
      .filter((l) => l.account_id && (l.debit > 0 || l.credit > 0));

    if (cleanedLines.length === 0) {
      setErrorMsg("Add at least one line with an account and amount.");
      return;
    }

    const debitSum = cleanedLines.reduce((s, l) => s + l.debit, 0);
    const creditSum = cleanedLines.reduce((s, l) => s + l.credit, 0);

    if (debitSum <= 0 || creditSum <= 0) {
      setErrorMsg("Journal must have at least one debit and one credit.");
      return;
    }

    if (Math.abs(debitSum - creditSum) > 0.0001) {
      setErrorMsg("Debits and credits must balance.");
      return;
    }

    setSubmitting(true);

    const res = await fetch("/api/journal/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        payload: {
          date,
          description,
          reference,
          lines: cleanedLines,
        },
      }),
    });

    const json = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setErrorMsg(json.error || "Failed to post journal.");
      return;
    }

    setSuccessMsg("Journal posted successfully.");
    setDescription("");
    setReference("");
    setLines([
      { account_id: "", line_description: "", debit: "", credit: "" },
      { account_id: "", line_description: "", debit: "", credit: "" },
    ]);
  }

  if (isLoading || !isAuthenticated || !user) {
    return (
      <ResponsiveLayout>
        <div className="p-8">
          <p className="text-slate-500">Loading journal form…</p>
        </div>
      </ResponsiveLayout>
    );
  }

  // Subscription guard (SOC2)
  const isFounder = user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return (
      <ResponsiveLayout>
        <div className="p-8 text-red-600">
          Your subscription does not allow posting journals.
        </div>
      </ResponsiveLayout>
    );
  }

  const formDisabled = submitting || periodLocked;

  return (
    <ResponsiveLayout currentPageName="Post Journal">
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            Post Journal
            {periodLocked && (
              <span className="text-red-600 text-sm font-semibold">
                (Period Locked)
              </span>
            )}
          </h1>
          <p className="text-slate-600 mt-2 max-w-2xl">
            Create a manual journal entry. Debits and credits must balance.
            {periodLocked && (
              <span className="text-red-600 ml-2">
                Journals cannot be posted in a locked period.
              </span>
            )}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded bg-red-50 text-red-700 text-sm">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded bg-emerald-50 text-emerald-700 text-sm">
            {successMsg}
          </div>
        )}

        {/* Main layout: left = journal form, right = guidance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: form */}
          <div className="lg:col-span-2 space-y-6">
            <ResponsiveCard title="Journal Details">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      className="border p-2 rounded w-full text-sm"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      disabled={formDisabled}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      Reference
                    </label>
                    <input
                      type="text"
                      className="border p-2 rounded w-full text-sm"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Optional reference"
                      disabled={formDisabled}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-500 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      className="border p-2 rounded w-full text-sm"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Accrual for utilities"
                      disabled={formDisabled}
                    />
                  </div>
                </div>

                <ResponsiveCard title="Lines">
                  <ResponsiveTable
                    headers={[
                      "Account",
                      "Line Description",
                      "Debit (£)",
                      "Credit (£)",
                      "",
                    ]}
                  >
                    {lines.map((line, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-2 py-2">
                          <select
                            className="border p-2 rounded text-sm w-full"
                            value={line.account_id}
                            onChange={(e) =>
                              updateLine(index, "account_id", e.target.value)
                            }
                            disabled={formDisabled}
                          >
                            <option value="">Select account</option>
                            {accounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.account_code
                                  ? `${acc.account_code} - ${acc.account_name}`
                                  : acc.account_name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-2 py-2">
                          <input
                            type="text"
                            className="border p-2 rounded text-sm w-full"
                            value={line.line_description}
                            onChange={(e) =>
                              updateLine(
                                index,
                                "line_description",
                                e.target.value
                              )
                            }
                            placeholder="Optional"
                            disabled={formDisabled}
                          />
                        </td>

                        <td className="px-2 py-2">
                          <input
                            type="number"
                            step="0.01"
                            className="border p-2 rounded text-sm w-full text-right"
                            value={line.debit}
                            onChange={(e) =>
                              updateLine(index, "debit", e.target.value)
                            }
                            disabled={formDisabled}
                          />
                        </td>

                        <td className="px-2 py-2">
                          <input
                            type="number"
                            step="0.01"
                            className="border p-2 rounded text-sm w-full text-right"
                            value={line.credit}
                            onChange={(e) =>
                              updateLine(index, "credit", e.target.value)
                            }
                            disabled={formDisabled}
                          />
                        </td>

                        <td className="px-2 py-2 text-right">
                          <button
                            type="button"
                            className="text-red-600 text-xs underline"
                            onClick={() => removeLine(index)}
                            disabled={formDisabled || lines.length <= 2}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </ResponsiveTable>

                  <div className="flex justify-between items-center mt-4">
                    <button
                      type="button"
                      className="text-blue-600 text-sm underline"
                      onClick={addLine}
                      disabled={formDisabled}
                    >
                      Add line
                    </button>

                    <div className="text-sm text-slate-700">
                      <span className="mr-4">
                        Total Debit:{" "}
                        <strong>£{totalDebit.toFixed(2)}</strong>
                      </span>
                      <span>
                        Total Credit:{" "}
                        <strong>£{totalCredit.toFixed(2)}</strong>
                      </span>
                    </div>
                  </div>
                </ResponsiveCard>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className={`px-4 py-2 rounded text-white text-sm ${
                      formDisabled
                        ? "bg-slate-400 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                    disabled={formDisabled}
                  >
                    {submitting ? "Posting…" : "Post Journal"}
                  </button>
                </div>
              </form>
            </ResponsiveCard>
          </div>

          {/* RIGHT: guidance panel (desktop) */}
          <aside className="hidden lg:block lg:col-span-1">
            <GuidancePanel />
          </aside>
        </div>
      </div>

      {/* Mobile help button */}
      <button
        className="lg:hidden fixed bottom-4 right-4 z-30 px-4 py-2 rounded-full bg-blue-600 text-white shadow-lg"
        onClick={() => setShowHelp(true)}
      >
        ?
      </button>

      {/* Mobile slide-out guidance panel */}
      {showHelp && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black bg-opacity-40"
            onClick={() => setShowHelp(false)}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-xl p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                How to Post a Journal
              </h2>
              <button
                className="text-sm px-3 py-1 border rounded"
                onClick={() => setShowHelp(false)}
              >
                Close
              </button>
            </div>
            <GuidancePanel innerOnly />
          </div>
        </div>
      )}
    </ResponsiveLayout>
  );
}

function GuidancePanel({ innerOnly }) {
  const Wrapper = ({ children }) =>
    innerOnly ? (
      <>{children}</>
    ) : (
      <div className="p-6 bg-white border rounded shadow-sm lg:sticky lg:top-6">
        {children}
      </div>
    );

  return (
    <Wrapper>
      <h2 className="text-xl font-semibold mb-4">
        How to Post a Journal
      </h2>

      <p className="text-sm text-slate-700 mb-3">
        A manual journal entry lets you adjust your accounts directly. It is
        powerful and must be used carefully. Use this page for corrections,
        adjustments, accruals, prepayments, depreciation, and year‑end entries.
      </p>

      <h3 className="font-semibold mt-4 mb-2">What this page is for</h3>
      <p className="text-sm text-slate-700 mb-2">
        Use this page when you need to:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>Correct mistakes in previous postings.</li>
        <li>Record adjustments at month‑end or year‑end.</li>
        <li>Post accruals or prepayments.</li>
        <li>Record depreciation on fixed assets.</li>
        <li>Move balances between accounts.</li>
        <li>Post transactions that don’t come from invoices, bills, or bank feeds.</li>
      </ul>
      <p className="text-sm text-slate-700 mb-3">
        Every journal you post updates your <strong>Profit &amp; Loss</strong>,{" "}
        <strong>Balance Sheet</strong>, and <strong>Trial Balance</strong> in
        real time.
      </p>

      <h3 className="font-semibold mt-4 mb-2">
        Debits and credits (simple explanation)
      </h3>
      <p className="text-sm text-slate-700 mb-2">
        Every journal has two sides:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-2">
        <li>
          <strong>Debit</strong> – increases assets or expenses.
        </li>
        <li>
          <strong>Credit</strong> – increases liabilities, equity, or income.
        </li>
      </ul>
      <p className="text-sm font-medium text-slate-900 mb-3">
        Total Debits must always equal Total Credits.
      </p>
      <p className="text-sm text-slate-700 mb-3">
        ProfitLens will block any journal that doesn’t balance.
      </p>

      <h3 className="font-semibold mt-4 mb-2">
        Common journal types (with examples)
      </h3>
      <ul className="text-sm text-slate-700 space-y-3 mb-4">
        <li>
          <strong>Accruals</strong> – expenses that belong to this period but
          haven’t been invoiced yet.
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>Debit: Expense</li>
            <li>Credit: Accruals (Liability)</li>
          </ul>
        </li>
        <li>
          <strong>Prepayments</strong> – spreading costs over multiple periods.
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>Debit: Prepayments (Asset)</li>
            <li>Credit: Expense</li>
          </ul>
        </li>
        <li>
          <strong>Depreciation</strong> – reducing the value of long‑term assets
          over time.
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>Debit: Depreciation Expense</li>
            <li>Credit: Accumulated Depreciation</li>
          </ul>
        </li>
        <li>
          <strong>Loan repayments</strong> – splitting between principal and interest.
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>Debit: Loan Liability</li>
            <li>Debit: Interest Expense</li>
            <li>Credit: Bank</li>
          </ul>
        </li>
        <li>
          <strong>Owner drawings / director’s loan</strong> – money taken out by
          the owner.
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>Debit: Director’s Loan</li>
            <li>Credit: Bank</li>
          </ul>
        </li>
        <li>
          <strong>VAT adjustments</strong> – rounding, corrections, or
          accountant‑only adjustments.
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>Debit/Credit: VAT Control</li>
            <li>Opposite entry: Expense or Liability depending on correction</li>
          </ul>
        </li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">
        How journals flow into your reports
      </h3>
      <p className="text-sm text-slate-700 mb-2">
        When you post a journal:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>
          If it hits <strong>income or expenses</strong> → it affects{" "}
          <strong>Profit &amp; Loss</strong>.
        </li>
        <li>
          If it hits <strong>assets, liabilities, or equity</strong> → it
          affects the <strong>Balance Sheet</strong>.
        </li>
        <li>Every journal updates the Trial Balance instantly.</li>
      </ul>
      <p className="text-sm text-slate-700 mb-3">
        ProfitLens recalculates everything automatically.
      </p>

      <h3 className="font-semibold mt-4 mb-2">Locked periods</h3>
      <p className="text-sm text-slate-700 mb-2">
        If a month is locked:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>You cannot post journals dated inside that month.</li>
        <li>You cannot reverse journals inside that month.</li>
        <li>You cannot delete journals inside that month.</li>
      </ul>
      <p className="text-sm text-slate-700 mb-3">
        This protects your accounts after VAT returns, year‑end, or accountant
        sign‑off.
      </p>

      <h3 className="font-semibold mt-4 mb-2">
        Override rules (very important)
      </h3>
      <p className="text-sm text-slate-700 mb-2">
        Only certain users can override locked periods:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>Founder</li>
        <li>Admin</li>
        <li>Trusted Accountant</li>
      </ul>
      <p className="text-sm text-slate-700 mb-3">
        A normal accountant cannot override locked periods unless they have been
        explicitly marked as <strong>trusted</strong>.
      </p>

      <h4 className="font-semibold mt-3 mb-1">What is a Trusted Accountant?</h4>
      <p className="text-sm text-slate-700 mb-2">
        A trusted accountant is someone you have granted elevated permissions to.
        They can:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>Post journals into locked periods.</li>
        <li>Reverse journals in locked periods.</li>
        <li>Delete journals in locked periods.</li>
        <li>Unlock periods (if allowed by your settings).</li>
      </ul>
      <p className="text-sm text-slate-700 mb-3">
        This is designed for professional accountants who manage your year‑end.
      </p>

      <h4 className="font-semibold mt-3 mb-1">If you need an override</h4>
      <p className="text-sm text-slate-700 mb-2">
        If you are not a founder, admin, or trusted accountant:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>You cannot override locked periods.</li>
        <li>You cannot unlock periods.</li>
        <li>You cannot post adjustments into locked months.</li>
      </ul>
      <p className="text-sm text-slate-700 mb-3">
        If you need help with an override, you should:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-4">
        <li>Email ProfitLens customer support.</li>
        <li>
          Or invite your accountant and mark them as{" "}
          <strong>trusted</strong> so they can make the adjustments.
        </li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">Posting best practices</h3>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>Always double‑check the journal date.</li>
        <li>Make sure the period is not locked (unless you are allowed to override).</li>
        <li>Use the correct client (for accountants working across clients).</li>
        <li>Ensure debits equal credits before posting.</li>
        <li>Add a clear, meaningful description.</li>
        <li>Avoid posting directly to system accounts unless you know why.</li>
        <li>Use the correct VAT codes where applicable.</li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">
        Common mistakes to avoid
      </h3>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-4">
        <li>Reversing a journal the wrong way around.</li>
        <li>Posting to the wrong year or wrong period.</li>
        <li>Using the wrong client (for accountants).</li>
        <li>Posting directly to Retained Earnings manually.</li>
        <li>Posting incorrectly to VAT Control.</li>
        <li>Forgetting to split loan repayments between principal and interest.</li>
        <li>
          Posting depreciation directly to the asset instead of accumulated
          depreciation.
        </li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">The goal</h3>
      <p className="text-sm text-slate-800 mb-2">
        The goal of this page is to help you post clean, accurate, professional
        journals that flow correctly into:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>Profit &amp; Loss</li>
        <li>Balance Sheet</li>
        <li>Trial Balance</li>
        <li>VAT returns</li>
        <li>Year‑end accounts</li>
      </ul>
      <p className="text-sm text-slate-800">
        This page is designed to give you confidence — and to give your
        accountant everything they need to review and sign off your numbers.
      </p>
    </Wrapper>
  );
}
