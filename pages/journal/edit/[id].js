"use client";

import { useRouter } from "next/router";
import useSWR from "swr";
import ResponsiveLayout from "../../../components/ResponsiveLayout";
import ResponsiveCard from "../../../components/ResponsiveCard";
import ResponsiveTable from "../../../components/ResponsiveTable";
import { useUser } from "../../../hooks/useUser";
import React from "react";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function EditJournal() {
  const router = useRouter();
  const { id } = router.query;
  const { user, isLoading, isAuthenticated } = useUser();

  const clientId = user?.actingAsClientId ?? user?.clientId;

  const { data } = useSWR(
    id ? `/api/journal/get?id=${id}&clientId=${clientId}` : null,
    fetcher
  );

  const journal = data?.journal;
  const periodLocked = data?.periodLocked || false;
  const originalLines = data?.lines || [];
  const trustStatus = data?.trustStatus || "none";

  const [date, setDate] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [lines, setLines] = React.useState([]);
  const [submitting, setSubmitting] = React.useState(false);

// ⭐ FIX: use lowercase role checks (because useUser lowercases roles)
  const isFounder = user?.role === "founder";
  const isAdmin = user?.role === "admin";
  const isAccountant = user?.role === "accountant";

  const isTrustedAccountant =
    isAccountant && (trustStatus === "global" || trustStatus === "client");

  const isOverride = isFounder || isAdmin || isTrustedAccountant;

  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    user?.subscriptionStatus
  );

  const formDisabled = !isOverride && (periodLocked || journal?.reversed);

  React.useEffect(() => {
    if (journal) {
      setDate(journal.date);
      setReference(journal.reference || "");
      setDescription(journal.description || "");
      setLines(
        originalLines.map((l) => ({
          id: l.id,
          account_id: l.account_id,
          line_description: l.line_description || "",
          debit: l.debit,
          credit: l.credit,
        }))
      );
    }
  }, [journal, originalLines]);

  if (isLoading) {
    return (
      <ResponsiveLayout>
        <div className="p-8">Loading journal…</div>
      </ResponsiveLayout>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <ResponsiveLayout>
        <div className="p-8">Redirecting…</div>
      </ResponsiveLayout>
    );
  }

  if (!(isFounder || isAdmin || isSubscribedOrTrial || isTrustedAccountant)) {
    return (
      <ResponsiveLayout>
        <div className="p-8 text-red-600">
          Your subscription does not allow access to Journals.
        </div>
      </ResponsiveLayout>
    );
  }

  if (!journal) {
    return (
      <ResponsiveLayout>
        <div className="p-8">Loading journal…</div>
      </ResponsiveLayout>
    );
  }

  function updateLine(index, field, value) {
    setLines((prev) => {
      const copy = [...prev];
      copy[index][field] = value;
      return copy;
    });
  }

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        id: null,
        account_id: "",
        line_description: "",
        debit: 0,
        credit: 0,
      },
    ]);
  }

  function removeLine(index) {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function saveChanges() {
    if (formDisabled) return;

    setSubmitting(true);

    const res = await fetch("/api/journal/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        payload: {
          id,
          date,
          reference,
          description,
          lines,
          clientId,
        },
      }),
    });

    const json = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      alert(json.error || "Failed to update journal.");
      return;
    }

    router.push(`/journal/${id}`);
  }

  async function deleteJournal() {
    if (
      !confirm(
        "Delete this journal? This cannot be undone and will remove it from the ledger."
      )
    )
      return;

    const res = await fetch("/api/journal/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        payload: { id },
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      alert(json.error || "Failed to delete journal.");
      return;
    }

    router.push("/journal");
  }

  return (
    <ResponsiveLayout currentPageName="Edit Journal">
      <div className="p-8 space-y-6">
        {/* HEADER */}
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          Edit Journal #{journal.id.slice(0, 8)}
          {periodLocked && (
            <span className="text-red-600 text-sm font-semibold">
              (Period Locked)
            </span>
          )}
          {journal.reversed && (
            <span className="text-red-600 text-sm font-semibold">
              (Reversed)
            </span>
          )}
        </h1>

        {/* ACTION BUTTONS */}
        <div className="flex flex-wrap gap-3">
          <button
            className="px-4 py-2 text-sm rounded bg-slate-500 text-white hover:bg-slate-600"
            onClick={() => router.push("/journal")}
          >
            Back to Journals
          </button>

          <button
            className="px-4 py-2 text-sm rounded bg-slate-400 text-white hover:bg-slate-500"
            onClick={() => router.push(`/journal/${id}`)}
          >
            Cancel Editing
          </button>

          {!formDisabled && (
            <button
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
              onClick={saveChanges}
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          )}

          {!formDisabled && (
            <button
              className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700"
              onClick={deleteJournal}
            >
              Delete Journal
            </button>
          )}
        </div>

        {/* FORM */}
        <ResponsiveCard title="Journal Details">
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Date</label>
              <input
                type="date"
                className="border p-2 rounded w-full text-sm"
                value={date}
                onChange={(e) => setDate(e.target.value)}
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
                disabled={formDisabled}
              />
            </div>
          </div>
        </ResponsiveCard>

        {/* LINES */}
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
                  <input
                    type="text"
                    className="border p-2 rounded text-sm w-full"
                    value={line.account_id}
                    onChange={(e) =>
                      updateLine(index, "account_id", e.target.value)
                    }
                    disabled={formDisabled}
                  />
                </td>

                <td className="px-2 py-2">
                  <input
                    type="text"
                    className="border p-2 rounded text-sm w-full"
                    value={line.line_description}
                    onChange={(e) =>
                      updateLine(index, "line_description", e.target.value)
                    }
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
                  {!formDisabled && lines.length > 2 && (
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
          </ResponsiveTable>

          {!formDisabled && (
            <button
              type="button"
              className="text-blue-600 text-sm underline mt-3"
              onClick={addLine}
            >
              Add line
            </button>
          )}
        </ResponsiveCard>
      </div>
    </ResponsiveLayout>
  );
}
