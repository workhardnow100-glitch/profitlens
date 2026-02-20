// pages/journal/index.js
"use client";

import useSWR from "swr";
import { useRouter } from "next/router";
import { useUser } from "../../hooks/useUser";
import ResponsiveLayout from "../../components/ResponsiveLayout";
import ResponsiveCard from "../../components/ResponsiveCard";
import ResponsiveTable from "../../components/ResponsiveTable";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function JournalList() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useUser();

  const { data } = useSWR("/api/journal/list", fetcher);
  const journals = data?.journals || [];

  if (isLoading || !isAuthenticated || !user) {
    return (
      <ResponsiveLayout>
        <div className="p-8">Loading journals…</div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="p-8 space-y-6">
        <h1 className="text-2xl font-bold text-slate-800">Journals</h1>
        <p className="text-slate-600">All manual journals for this client.</p>

        <ResponsiveCard title="Journal Entries">
          <ResponsiveTable
            headers={[
              "Date",
              "Reference",
              "Description",
              "Debit (£)",
              "Credit (£)",
              "Status",
              "Actions",
            ]}
          >
            {journals.map((j) => (
              <tr key={j.id} className="border-t">
                <td>{j.date}</td>
                <td>{j.reference || "—"}</td>
                <td>{j.description || "—"}</td>
                <td className="text-right">£{j.total_debit}</td>
                <td className="text-right">£{j.total_credit}</td>
                <td>
                  {j.reversed ? (
                    <span className="text-red-600 font-medium">Reversed</span>
                  ) : (
                    <span className="text-green-600 font-medium">Posted</span>
                  )}
                </td>
                <td>
                  <button
                    className="text-blue-600 underline text-sm"
                    onClick={() => router.push(`/journal/${j.id}`)}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </ResponsiveCard>
      </div>
    </ResponsiveLayout>
  );
}
