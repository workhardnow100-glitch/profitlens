/// page/journal/index.js

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

  const [selectedYear, setSelectedYear] = React.useState(
    new Date().getFullYear()
  );

  const { data, mutate } = useSWR(
    `/api/journal/list?year=${selectedYear}`,
    fetcher
  );

  const journals = data?.journals || [];
  const periodLocked = data?.periodLocked || false;
  const periodStart = data?.periodStart || null;
  const periodEnd = data?.periodEnd || null;

  const history = data?.history || [];
  const availableMonths = data?.availableMonths || [];
  const lockedMonthsMap = data?.lockedMonthsMap || {};
  const timeline = data?.timeline || [];

  const pendingUnlockRequest = data?.pendingUnlockRequest || false;
  const trustStatus = data?.trustStatus || "none"; // "none" | "client" | "global"

  const isAdmin = user?.role === "admin";
  const isAccountant = (user?.role || "").toUpperCase() === "ACCOUNTANT";

  const [selectedMonths, setSelectedMonths] = React.useState([]);
  const [lockNote, setLockNote] = React.useState("");
  const [unlockReason, setUnlockReason] = React.useState("");
  const [showUnlockRequestModal, setShowUnlockRequestModal] =
    React.useState(false);

  React.useEffect(() => {
    if (availableMonths.length > 0) {
      const current = availableMonths.find(
        (m) => m.start === periodStart && m.end === periodEnd
      );
      if (current) setSelectedMonths([current.start]);
    }
  }, [availableMonths, periodStart, periodEnd]);

  if (isLoading || !isAuthenticated || !user) {
    return (
      <ResponsiveLayout>
        <div className="p-8">Loading journals…</div>
      </ResponsiveLayout>
    );
  }

  function toggleMonthSelection(start) {
    setSelectedMonths((prev) =>
      prev.includes(start) ? prev.filter((s) => s !== start) : [...prev, start]
    );
  }

  async function handleLockPeriod() {
    const periods = availableMonths
      .filter((m) => selectedMonths.includes(m.start))
      .map((m) => ({
        periodStart: m.start,
        periodEnd: m.end,
      }));

    if (periods.length === 0) {
      alert("Select at least one month to lock.");
      return;
    }

    const labelList = periods
      .map((p) => formatMonthRange(p.periodStart, p.periodEnd))
      .join("\n");

    if (
      !confirm(
        `Lock journals for:\n${labelList}\n\nThis will prevent posting, reversing, and deleting in these periods.`
      )
    ) {
      return;
    }

    const res = await fetch("/api/journal/lock-period", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periods,
        note: lockNote || null,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json.error || "Failed to lock periods.");
      return;
    }

    alert(json.message || "Periods locked.");
    setLockNote("");
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

  async function handleRequestUnlock() {
    if (!isAccountant) return;

    const res = await fetch("/api/journal/request-unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodStart,
        periodEnd,
        reason: unlockReason || null,
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json.error || "Failed to request unlock.");
      return;
    }

    // Auto-approved accountants
    if (json.autoApproved) {
      alert("Unlock auto-approved. The period is now open.");
      setUnlockReason("");
      setShowUnlockRequestModal(false);
      mutate();
      return;
    }

    // Pending
    alert("Unlock request submitted and is pending admin approval.");
    setUnlockReason("");
    setShowUnlockRequestModal(false);
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

  const yearOptions = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 5; y <= currentYear + 1; y++) {
    yearOptions.push(y);
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

          {/* YEAR + PERIOD LOCK CARD */}
          <ResponsiveCard title="Period Lock Controls">
            <div className="space-y-3 text-sm">
              {/* Year Selector */}
              <div>
                <label className="font-semibold block mb-1">Year</label>
                <select
                  className="border p-2 rounded text-sm w-full"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month Grid */}
              <div>
                <label className="font-semibold block mb-1">
                  Select Months to Lock
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {availableMonths.map((m) => (
                    <button
                      key={m.start}
                      type="button"
                      onClick={() => toggleMonthSelection(m.start)}
                      className={`px-2 py-1 rounded text-xs border ${
                        selectedMonths.includes(m.start)
                          ? "bg-red-600 text-white border-red-700"
                          : "bg-white text-slate-800 border-slate-300"
                      }`}
                    >
                      {m.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lock Note */}
              <div>
                <label className="font-semibold block mb-1">
                  Lock Note (optional)
                </label>
                <textarea
                  className="border p-2 rounded text-sm w-full"
                  rows={2}
                  value={lockNote}
                  onChange={(e) => setLockNote(e.target.value)}
                  placeholder="e.g. Year-end adjustments complete"
                />
              </div>

              {/* Current Month Status */}
              <p>
                <span className="font-semibold">Current Month Status:</span>{" "}
                {periodLocked ? (
                  <span className="text-red-600 font-semibold">Locked</span>
                ) : (
                  <span className="text-green-600 font-semibold">Open</span>
                )}
              </p>

              {/* Trusted Accountant Banners */}
              {isAccountant && trustStatus === "global" && (
                <div className="p-2 rounded bg-blue-100 text-blue-800 text-xs font-medium">
                  You are globally trusted. Unlock requests will be auto-approved.
                </div>
              )}

              {isAccountant && trustStatus === "client" && (
                <div className="p-2 rounded bg-green-100 text-green-800 text-xs font-medium">
                  You are trusted for this client. Unlock requests will be auto-approved.
                </div>
              )}

              {/* Pending Unlock Banner */}
              {periodLocked && isAccountant && pendingUnlockRequest && (
                <div className="p-2 rounded bg-amber-100 text-amber-800 text-xs font-medium">
                  Unlock request submitted and awaiting admin approval.
                </div>
              )}

              {/* Lock Button */}
              <button
                type="button"
                onClick={handleLockPeriod}
                className="mt-2 px-3 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700"
              >
                Lock Selected Months
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

              {/* Request Unlock (Accountant Only, no duplicates) */}
              {periodLocked && isAccountant && !pendingUnlockRequest && (
                <button
                  type="button"
                  onClick={() => setShowUnlockRequestModal(true)}
                  className="mt-2 px-3 py-1 rounded text-xs bg-amber-500 text-white hover:bg-amber-600"
                >
                  Request Unlock
                </button>
              )}
            </div>
          </ResponsiveCard>
        </div>

        {/* UNLOCK REQUEST MODAL */}
        {showUnlockRequestModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-lg p-4 w-full max-w-md space-y-3">
              <h2 className="text-lg font-semibold">
                Request Unlock for {formatMonthRange(periodStart, periodEnd)}
              </h2>
              <p className="text-sm text-slate-600">
                Explain why this period needs to be unlocked.
              </p>
              <textarea
                className="border p-2 rounded text-sm w-full"
                rows={3}
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="e.g. Need to correct misposted payroll"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-1 text-xs rounded border border-slate-300"
                  onClick={() => {
                    setShowUnlockRequestModal(false);
                    setUnlockReason("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-1 text-xs rounded bg-amber-500 text-white hover:bg-amber-600"
                  onClick={handleRequestUnlock}
                >
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TIMELINE */}
        <ResponsiveCard title="Lock Timeline">
          <div className="flex flex-wrap gap-2 text-xs">
            {timeline.map((t) => (
              <div
                key={t.start}
                className={`px-2 py-1 rounded border cursor-default ${
                  t.locked
                    ? "bg-red-600 text-white border-red-700"
                    : "bg-green-100 text-green-800 border-green-300"
                }`}
                title={
                  t.locked
                    ? t.note
                      ? `Locked. Note: ${t.note}`
                      : "Locked."
                    : "Open."
                }
              >
                {t.label.split(" ")[0]}
              </div>
            ))}
          </div>
        </ResponsiveCard>

        {/* HISTORY TABLE */}
        <ResponsiveCard title="Locked Period History">
          <ResponsiveTable headers={["Period", "Locked By", "Locked At", "Note"]}>
            {history.map((h, i) => (
              <tr key={i} className="border-t">
                <td>{formatMonthRange(h.period_start, h.period_end)}</td>
                <td>{h.locked_by}</td>
                <td>{new Date(h.locked_at).toLocaleString("en-GB")}</td>
                <td>{h.note || "—"}</td>
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
                  className={`border-t ${locked ? "bg-red-50" : ""}`}
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
