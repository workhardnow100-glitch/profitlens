// pages/journal/[id].js
"use client";

import { useRouter } from "next/router";
import useSWR from "swr";
import ResponsiveLayout from "../../components/ResponsiveLayout";
import ResponsiveCard from "../../components/ResponsiveCard";
import ResponsiveTable from "../../components/ResponsiveTable";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function ViewJournal() {
  const router = useRouter();
  const { id } = router.query;

  const { data, mutate } = useSWR(id ? `/api/journal/get?id=${id}` : null, fetcher);
  const journal = data?.journal;
  const lines = data?.lines || [];

  if (!journal) {
    return (
      <ResponsiveLayout>
        <div className="p-8">Loading journal…</div>
      </ResponsiveLayout>
    );
  }

  async function reverseJournal() {
    if (!confirm("Reverse this journal?")) return;

    const res = await fetch("/api/journal/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reverse",
        payload: { id },
      }),
    });

    if (res.ok) mutate();
  }

  return (
    <ResponsiveLayout>
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">
          Journal #{journal.id.slice(0, 8)}
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
          <ResponsiveTable
            headers={["Account", "Debit (£)", "Credit (£)"]}
          >
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
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reverse Journal
          </button>
        )}
      </div>
    </ResponsiveLayout>
  );
}
