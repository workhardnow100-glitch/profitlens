"use client";

import React from "react";
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

  const history = data?.history || [];
  const availableMonths = data?.availableMonths || [];
  const lockedMonthsMap = data?.lockedMonthsMap || {};

  const isAdmin = user?.role === "admin";

  const [selectedMonth, setSelectedMonth] = React.useState("");

  React.useEffect(() => {
    if (availableMonths.length > 0) {
      const current = availableMonths.find(
        (m) => m.start === periodStart && m.end === periodEnd
      );
      if (current) setSelectedMonth(current.start);
    }
  }, [availableMonths, periodStart, periodEnd]);

  if (isLoading || !isAuthenticated || !user) {
    return (
      <ResponsiveLayout>
        <div className="p-8">Loading journals…</div>
      </ResponsiveLayout>
    );
  }

  async function handleLockPeriod() {
    const month = availableMonths.find((m) => m.start === selectedMonth);
    if (!month) return;

    if (
      !confirm(
        `Lock journals for ${month.label}? This will prevent posting, reversing, and deleting in this period.`
      )
    ) {
      return;
    }

    const res = await fetch("/api/journal/lock-period", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodStart: month.start,
        periodEnd: month.end,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json.error || "Failed to lock period.");
      return;
    }

    alert(json.message || "Period locked.");
    mutate();
  }

  async function handleUnlockPeriod() {
    if (!isAdmin) return;

    if (
      !confirm(
        `Unlock journals for ${formatMonthRange(
          periodStart,
          periodEnd
        )}? This will allow posting, reversing, and deleting again.`
      )
    ) {
      return;
    }

    const res = await fetch("/api/journal/unlock-period", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodStart, periodEnd }),
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json.error || "Failed to unlock period.");
      return;
    }

    alert(json.message || "Period unlocked.");
    mutate();
  }

  function isJournalInLockedPeriod(journalDate) {
    const d = new Date(journalDate);
    const year = d.getFullYear();
    const month = d.getMonth();

    const start = new Date(year, month, 1).toISOString().slice(0, 10);
    const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);

    return lockedMonthsMap[`${start}_${end}`] === true;
  }

  return (
    <ResponsiveLayout currentPageName="Journals">
      <div className="p-8 space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Journals</h1>
            <p className="text-slate-600">All manual journals for this client.</p>
          </div>

          {/* PERIOD LOCK CARD */}
          <ResponsiveCard title="Period Lock Controls">
            <div className="space-y-2 text-sm">

              {/* Month Selector */}
              <div>
                <label className="font-semibold block mb-1">Select Month</label>
                <select
                  className="border p-2 rounded text-sm w-full"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {availableMonths.map((m) => (
                    <option key={m.start} value={m.start}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <p>
                <span className="font-semibold">Current Month Status:</span>{" "}
                {periodLocked ? (
                  <span className="text-red-600 font-semibold">Locked</span>
                ) : (
                  <span className="text-green-600 font-semibold">Open</span>
                )}
              </p>

              {/* Lock Button */}
              <button
                type="button"
                onClick={handleLockPeriod}
                className="mt-2 px-3 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700"
              >
                Lock Selected Month
              </button>

              {/* Unlock Button (Admin Only) */}
              {periodLocked && isAdmin && (
                <button
                  type="button"
                  onClick={handleUnlockPeriod}
                  className="mt-2 px-3 py-1 rounded text-xs bg-slate-600 text-white hover:bg-slate-700"
                >
                  Unlock Current Month
                </button>
              )}
            </div>
          </ResponsiveCard>
        </div>

        {/* HISTORY TABLE */}
        <ResponsiveCard title="Locked Period History">
          <ResponsiveTable
            headers={["Period", "Locked By", "Locked At"]}
          >
            {history.map((h, i) => (
              <tr key={i} className="border-t">
                <td>{formatMonthRange(h.period_start, h.period_end)}</td>
                <td>{h.locked_by}</td>
                <td>{new Date(h.locked_at).toLocaleString("en-GB")}</td>
              </tr>
            ))}
          </ResponsiveTable>
        </ResponsiveCard>

        {/* JOURNAL TABLE */}
        <ResponsiveCard title="Journal Entries">
          <ResponsiveTable
            headers={[
              "Date",
              "Reference",
              "Description",
              "Debit (£)",
              "Credit (£)",
              "Status",
              "Period",
              "Actions",
            ]}
          >
            {journals.map((j) => {
              const locked = isJournalInLockedPeriod(j.date);

              return (
                <tr
                  key={j.id}
                  className={`border-t ${
                    locked ? "bg-red-50" : ""
                  }`}
                >
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

                  {/* Locked Period Badge */}
                  <td>
                    {locked && (
                      <span className="text-red-600 font-semibold text-xs">
                        Locked Period
                      </span>
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
              );
            })}
          </ResponsiveTable>
        </ResponsiveCard>
      </div>
    </ResponsiveLayout>
  );
}
