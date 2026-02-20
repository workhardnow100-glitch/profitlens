"use client";

import useSWR from "swr";
import { useRouter } from "next/router";
import { useUser } from "../../hooks/useUser";
import ResponsiveLayout from "../../components/ResponsiveLayout";
import ResponsiveCard from "../../components/ResponsiveCard";
import ResponsiveTable from "../../components/ResponsiveTable";

const fetcher = (url) => fetch(url).then((res) => res.json());

function formatMonthRange(start, end) {
  if (!start || !end) return "";
  const s = new Date(start);
  const monthName = s.toLocaleString("en-GB", { month: "long" });
  const year = s.getFullYear();
  return `${monthName} ${year} (${start} → ${end})`;
}

export default function JournalList() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useUser();

  const { data, mutate } = useSWR("/api/journal/list", fetcher);
  const journals = data?.journals || [];
  const periodLocked = data?.periodLocked || false;
  const periodStart = data?.periodStart || null;
  const periodEnd = data?.periodEnd || null;

  if (isLoading || !isAuthenticated || !user) {
    return (
      <ResponsiveLayout>
        <div className="p-8">Loading journals…</div>
      </ResponsiveLayout>
    );
  }

  async function handleLockPeriod() {
    if (
      !confirm(
        `Lock journals for ${formatMonthRange(
          periodStart,
          periodEnd
        )}? This will prevent posting, reversing, and deleting in this period.`
      )
    ) {
      return;
    }

    const res = await fetch("/api/journal/lock-period", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodStart, periodEnd }),
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json.error || "Failed to lock period.");
      return;
    }

    alert(json.message || "Period locked.");
    mutate();
  }

  return (
    <ResponsiveLayout currentPageName="Journals">
      <div className="p-8 space-y-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Journals</h1>
            <p className="text-slate-600">All manual journals for this client.</p>
          </div>

          <ResponsiveCard title="Current Period Lock">
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-semibold">Period:</span>{" "}
                {formatMonthRange(periodStart, periodEnd)}
              </p>
              <p>
                <span className="font-semibold">Status:</span>{" "}
                {periodLocked ? (
                  <span className="text-red-600 font-semibold">Locked</span>
                ) : (
                  <span className="text-green-600 font-semibold">Open</span>
                )}
              </p>

              <button
                type="button"
                onClick={handleLockPeriod}
                disabled={periodLocked}
                className={`mt-2 px-3 py-1 rounded text-xs ${
                  periodLocked
                    ? "bg-slate-300 text-slate-600 cursor-not-allowed"
                    : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                {periodLocked ? "Period Locked" : "Lock Current Period"}
              </button>
            </div>
          </ResponsiveCard>
        </div>

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
