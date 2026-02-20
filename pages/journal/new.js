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

  // Access guard
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }
  }, [isLoading, isAuthenticated, user, router]);

  // Load accounts
  const { data: coaData } = useSWR(
    "/api/chart-of-accounts?usedOnly=false",
    fetcher
  );
  const accounts = coaData?.accounts || [];

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

    const cleanedLines = lines
      .map((l) => ({
        account_id: l.account_id,
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

  return (
    <ResponsiveLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Post Journal</h1>
          <p className="text-slate-600 mt-2 max-w-2xl">
            Create a manual journal entry. Debits and credits must balance.
          </p>
        </div>

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
                          updateLine(index, "line_description", e.target.value)
                        }
                        placeholder="Optional"
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
                      />
                    </td>

                    <td className="px-2 py-2 text-right">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          className="text-red-600 text-xs underline"
                          onClick={() => removeLine(index)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                <tr>
                  <td colSpan={5} className="px-2 py-2">
                    <button
                      type="button"
                      className="text-blue-600 text-sm underline"
                      onClick={addLine}
                    >
                      Add line
                    </button>
                  </td>
                </tr>

                <tr className="border-t bg-slate-50">
                  <td colSpan={2} className="px-2 py-2 text-right font-medium">
                    Totals
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">
                    £
                    {totalDebit.toLocaleString("en-GB", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">
                    £
                    {totalCredit.toLocaleString("en-GB", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td />
                </tr>
              </ResponsiveTable>
            </ResponsiveCard>

            {errorMsg && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}
            {successMsg && (
              <p className="text-sm text-green-600">{successMsg}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 border rounded text-sm hover:bg-slate-100"
                onClick={() => router.push("/accounting-overview")}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                {submitting ? "Posting…" : "Post Journal"}
              </button>
            </div>
          </form>
        </ResponsiveCard>

        <p className="text-xs text-slate-500 mt-4 max-w-2xl">
          Journals feed directly into your trial balance, profit &amp; loss,
          and balance sheet. Always ensure debits and credits are correct.
        </p>
      </div>
    </ResponsiveLayout>
  );
}
