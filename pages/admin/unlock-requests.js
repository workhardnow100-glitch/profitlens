// pages/admin/unlock-requests.js
import { useState, useCallback } from "react";
import useSWR from "swr";

const fetcher = (url) => fetch(url).then((r) => r.json());

const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  auto_approved: "Auto-approved",
};

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  auto_approved: "bg-blue-100 text-blue-800",
};

export default function AdminUnlockRequestsPage() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const { data, error, mutate } = useSWR(
    `/api/admin/unlock-requests${statusFilter ? `?status=${statusFilter}` : ""}`,
    fetcher,
    { refreshInterval: 15000 }
  );

  const requests = data?.requests || [];

  const handleApproveReject = useCallback(
    async (requestId, action) => {
      const res = await fetch("/api/journal/approve-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });

      if (!res.ok) {
        console.error("Failed to process unlock request");
        return;
      }

      await mutate();
    },
    [mutate]
  );

  const handleToggleTrust = useCallback(
    async ({ accountantId, clientId, global }) => {
      const res = await fetch("/api/admin/toggle-accountant-trust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountantId, clientId, global }),
      });

      if (!res.ok) {
        console.error("Failed to toggle trust");
        return;
      }

      await mutate();
    },
    [mutate]
  );

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Unlock Requests</h1>
        <p className="text-red-600">Failed to load unlock requests.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Unlock Requests</h1>
          <p className="text-sm text-gray-500">
            Global cockpit for all journal period unlock requests across the platform.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 mr-2">Filter:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value || "")}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="pending">Pending</option>
            <option value="">All</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="auto_approved">Auto-approved</option>
          </select>
        </div>
      </header>

      <section className="bg-white shadow-sm rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h2 className="font-medium">Requests</h2>
          <span className="text-xs text-gray-500">
            {requests.length} {requests.length === 1 ? "request" : "requests"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Client</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Period</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Accountant</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Reason</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Requested At</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Actions</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Trust</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-center text-gray-400 text-sm"
                  >
                    No unlock requests found for this filter.
                  </td>
                </tr>
              )}

              {requests.map((r) => {
                const statusClass =
                  STATUS_COLORS[r.status] || "bg-gray-100 text-gray-800";

                const accountantName =
                  r.accountant?.name || r.accountant?.email || "Unknown";
                const clientName = r.client?.name || r.client_id;

                const requestedAt = r.requested_at
                  ? new Date(r.requested_at).toLocaleString("en-GB")
                  : "-";

                const isPending = r.status === "pending";

                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2 align-top">{clientName}</td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {r.period_start} → {r.period_end}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex flex-col">
                        <span>{accountantName}</span>
                        {r.accountant?.email && (
                          <span className="text-xs text-gray-500">
                            {r.accountant.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top max-w-xs">
                      <span className="block text-gray-700 whitespace-pre-wrap">
                        {r.reason || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}
                      >
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 align-top text-gray-600">
                      {requestedAt}
                    </td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex flex-col gap-1">
                        <button
                          disabled={!isPending}
                          onClick={() =>
                            handleApproveReject(r.id, "approve")
                          }
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            isPending
                              ? "bg-green-600 text-white hover:bg-green-700"
                              : "bg-gray-200 text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          Approve
                        </button>
                        <button
                          disabled={!isPending}
                          onClick={() =>
                            handleApproveReject(r.id, "reject")
                          }
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            isPending
                              ? "bg-red-600 text-white hover:bg-red-700"
                              : "bg-gray-200 text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2 align-top">
                      <div className="flex flex-col gap-1">
                        {/* Per-client trust */}
                        <button
                          onClick={() =>
                            handleToggleTrust({
                              accountantId: r.requested_by,
                              clientId: r.client_id,
                              global: false,
                            })
                          }
                          className="px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        >
                          Trust for this client
                        </button>

                        {/* Global trust */}
                        <button
                          onClick={() =>
                            handleToggleTrust({
                              accountantId: r.requested_by,
                              clientId: null,
                              global: true,
                            })
                          }
                          className="px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
                        >
                          Trust globally
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
