// pages/journal/[id].js
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

  // Unified client resolution (same as SA/Corp)
  const clientId = user?.actingAsClientId ?? user?.clientId;

  // Load journal + lines
  const { data, mutate } = useSWR(
    id ? `/api/journal/get?id=${id}&clientId=${clientId}` : null,
    fetcher
  );

  const journal = data?.journal;
  const lines = data?.lines || [];
  const periodLocked = data?.periodLocked || false; // ⭐ NEW

  // AUTH GUARD (SOC2)
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

  // SUBSCRIPTION GUARD
  const isFounder = user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    user.subscriptionStatus
  );

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
        payload: { id, clientId },
      }),
    });

    if (res.ok) mutate();
    else {
      const json = await res.json();
      alert(json.error || "Failed to reverse journal.");
    }
  }

  return (
    <ResponsiveLayout currentPageName="Journal">
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
          Journal #{journal.id.slice(0, 8)}
          {periodLocked && (
            <span className="text-red-600 text-sm font-semibold">
              (Period Locked)
            </span>
          )}
        </h1>

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

        {!journal.reversed && (
          <button
            onClick={reverseJournal}
            disabled={periodLocked}
            className={`px-4 py-2 rounded text-white ${
              periodLocked
                ? "bg-slate-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {periodLocked ? "Locked" : "Reverse Journal"}
          </button>
        )}
      </div>
    </ResponsiveLayout>
  );
}
