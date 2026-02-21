"use client";

import { useRouter } from "next/router";
import useSWR from "swr";
import ResponsiveLayout from "../../components/ResponsiveLayout";
import ResponsiveCard from "../../components/ResponsiveCard";
import ResponsiveTable from "../../components/ResponsiveTable";
import { useUser } from "../../hooks/useUser";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function ViewJournal() {
  const router = useRouter();
  const { id } = router.query;
  const { user, isLoading, isAuthenticated } = useUser();

  const clientId = user?.actingAsClientId ?? user?.clientId;

  const { data, mutate } = useSWR(
    id ? `/api/journal/get?id=${id}&clientId=${clientId}` : null,
    fetcher
  );

  const journal = data?.journal;
  const lines = data?.lines || [];
  const periodLocked = data?.periodLocked || false;

  const isFounder = user?.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    user?.subscriptionStatus
  );
  const isAccountant = (user?.role || "").toUpperCase() === "ACCOUNTANT";

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

  if (!(isFounder || isSubscribedOrTrial)) {
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

  async function reverseJournal() {
    if (periodLocked) {
      alert("This period is locked. Journals cannot be reversed.");
      return;
    }

    if (!confirm("Reverse this journal?")) return;

    const res = await fetch("/api/journal/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reverse",
        payload: { id },
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      alert(json.error || "Failed to reverse journal.");
      return;
    }

    mutate();
  }

  async function deleteJournal() {
    if (periodLocked) {
      alert("This period is locked. Journals cannot be deleted.");
      return;
    }

    if (!confirm("Delete this journal? This cannot be undone.")) return;

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
    <ResponsiveLayout currentPageName="Journal">
      <div className="p-8 space-y-6">

        {/* HEADER */}
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          Journal #{journal.id.slice(0, 8)}
          {periodLocked && (
            <span className="text-red-600 text-sm font-semibold">
              (Period Locked)
            </span>
          )}
        </h1>

        {/* ⭐ ACTION BUTTONS UNDER TITLE */}
        <div className="flex flex-wrap gap-3">

          {/* BACK */}
          <button
            className="px-4 py-2 text-sm rounded bg-slate-500 text-white hover:bg-slate-600"
            onClick={() => router.push("/journal")}
          >
            Back to Journals
          </button>

          {/* EDIT */}
          {!journal.reversed && !periodLocked && (
            <button
              className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => router.push(`/journal/edit/${journal.id}`)}
            >
              Edit Journal
            </button>
          )}

          {/* REVERSE */}
          {!journal.reversed && (
            <button
              onClick={reverseJournal}
              disabled={periodLocked}
              className={`px-4 py-2 text-sm rounded text-white ${
                periodLocked
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-amber-500 hover:bg-amber-600"
              }`}
            >
              {periodLocked ? "Locked" : "Reverse Journal"}
            </button>
          )}

          {/* DELETE */}
          {!journal.reversed && !periodLocked && (
            <button
              onClick={deleteJournal}
              className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700"
            >
              Delete Journal
            </button>
          )}
        </div>

        {/* JOURNAL DETAILS */}
        <ResponsiveCard title="Journal Details">
          <p><strong>Date:</strong> {journal.date}</p>
          <p><strong>Reference:</strong> {journal.reference || "—"}</p>
          <p><strong>Description:</strong> {journal.description || "—"}</p>
          <p>
            <strong>Status:</strong>{" "}
            {journal.reversed ? (
              <span className="text-red-600 font-medium">Reversed</span>
            ) : (
              <span className="text-green-600 font-medium">Posted</span>
            )}
          </p>
        </ResponsiveCard>

        {/* LINES */}
        <ResponsiveCard title="Lines">
          <ResponsiveTable headers={["Account", "Debit (£)", "Credit (£)"]}>
            {lines.map((l) => (
              <tr key={l.id} className="border-t">
                <td>{l.account_name}</td>
                <td className="text-right">£{l.debit}</td>
                <td className="text-right">£{l.credit}</td>
              </tr>
            ))}
          </ResponsiveTable>
        </ResponsiveCard>

      </div>
    </ResponsiveLayout>
  );
}
