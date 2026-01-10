// pages/invoices/index.tsx   /// selection page of invoices

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useUser } from "../../hooks/useUser";

type InvoiceStatus =
  | "draft"
  | "sent"
  | "part_paid"
  | "paid"
  | "overdue"
  | "cancelled";

interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  grossAmount: number;
  paidAmount: number;
  hasPaymentLink: boolean;
}

type BulkAction = "send" | "mark_paid" | "cancel";

export default function InvoicesPage() {
  const { user, loading } = useUser();

  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");

  // Debounced search
  const [search, setSearch] = useState("");
  const searchRef = useRef<NodeJS.Timeout | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, [search]);

  // Load invoices (fixed — no infinite loop)
  useEffect(() => {
    if (!user?.id) return; // stable guard

    const load = async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedSearch) params.set("q", debouncedSearch);

      const invRes = await fetch(`/api/invoices?${params.toString()}`);
      const invJson = await invRes.json();
      const rawInvoices = invJson.invoices || [];

      if (rawInvoices.length === 0) {
        setInvoices([]);
        setSelectedIds([]);
        return;
      }

      const clientIds = rawInvoices.map((i: any) => i.client_id);

      const clientRes = await fetch("/api/external-clients/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: clientIds }),
      });

      const clientJson = await clientRes.json();
      const clientMap: Record<string, any> = {};
      (clientJson.externalClients || []).forEach((c: any) => {
        clientMap[c.id] = c;
      });

      const mapped: InvoiceListItem[] = rawInvoices.map((inv: any) => {
        const ext = clientMap[inv.client_id];

        const clientName =
          ext?.contact_name ||
          ext?.business_name ||
          ext?.trading_name ||
          "Customer";

        return {
          id: inv.id,
          invoiceNumber: inv.invoice_number,
          clientName,
          issueDate: inv.issue_date?.slice(0, 10) || "",
          dueDate: inv.due_date?.slice(0, 10) || "",
          status: inv.status,
          grossAmount: Number(inv.gross_amount || 0),
          paidAmount: Number(inv.paid_amount || 0),
          hasPaymentLink: !!inv.stripe_payment_link_url,
        };
      });

      // Persist selections across refresh
      setSelectedIds((prev) =>
        prev.filter((id) => mapped.some((inv) => inv.id === id))
      );

      setInvoices(mapped);
    };

    load();
  }, [statusFilter, debouncedSearch, user?.id]);

  const allSelected = useMemo(
    () => invoices.length > 0 && selectedIds.length === invoices.length,
    [invoices, selectedIds]
  );

  const someSelected = useMemo(
    () => selectedIds.length > 0 && selectedIds.length < invoices.length,
    [invoices, selectedIds]
  );

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : invoices.map((inv) => inv.id));
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const runBulkAction = async (action: BulkAction) => {
    if (selectedIds.length === 0) return;

    setBulkLoading(true);
    setBulkMessage(null);

    try {
      const res = await fetch("/api/invoices/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceIds: selectedIds,
          action,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setBulkMessage(data.error || "Bulk action failed");
        setBulkLoading(false);
        return;
      }

      const successCount = (data.results || []).filter(
        (r: any) => r.success
      ).length;
      const failCount = (data.results || []).filter(
        (r: any) => !r.success
      ).length;

      setBulkMessage(
        `${successCount} updated successfully${
          failCount ? `, ${failCount} failed` : ""
        }`
      );

      // Refresh invoices
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedSearch) params.set("q", debouncedSearch);

      const invRes = await fetch(`/api/invoices?${params.toString()}`);
      const invJson = await invRes.json();
      const rawInvoices = invJson.invoices || [];

      const clientIds = rawInvoices.map((i: any) => i.client_id);

      const clientRes = await fetch("/api/external-clients/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: clientIds }),
      });

      const clientJson = await clientRes.json();
      const clientMap: Record<string, any> = {};
      (clientJson.externalClients || []).forEach((c: any) => {
        clientMap[c.id] = c;
      });

      const mapped: InvoiceListItem[] = rawInvoices.map((inv: any) => {
        const ext = clientMap[inv.client_id];

        const clientName =
          ext?.contact_name ||
          ext?.business_name ||
          ext?.trading_name ||
          "Customer";

        return {
          id: inv.id,
          invoiceNumber: inv.invoice_number,
          clientName,
          issueDate: inv.issue_date?.slice(0, 10) || "",
          dueDate: inv.due_date?.slice(0, 10) || "",
          status: inv.status,
          grossAmount: Number(inv.gross_amount || 0),
          paidAmount: Number(inv.paid_amount || 0),
          hasPaymentLink: !!inv.stripe_payment_link_url,
        };
      });

      // Persist selections across refresh
      setSelectedIds((prev) =>
        prev.filter((id) => mapped.some((inv) => inv.id === id))
      );

      setInvoices(mapped);
      setBulkLoading(false);
    } catch (err) {
      console.error(err);
      setBulkMessage("Bulk action failed");
      setBulkLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please sign in</div>;

  const selectedCount = selectedIds.length;

  return (
    <div className="space-y-6 relative pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Invoices</h1>
          <p className="text-sm text-gray-500">
            Full invoicing cockpit with auto-matching and payments.
          </p>
        </div>
        <Link
          href="/invoices/new"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New Invoice
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input
          className="border rounded-md px-3 py-2 text-sm"
          placeholder="Search by invoice #, client, reference..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="border rounded-md px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="part_paid">Part paid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 cursor-pointer"
                />
              </th>

              <th className="px-4 py-2 text-left">Invoice #</th>
              <th className="px-4 py-2 text-left">Client</th>
              <th className="px-4 py-2 text-left">Issue</th>
              <th className="px-4 py-2 text-left">Due</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right">Paid / Total</th>
              <th className="px-4 py-2 text-center">Payments</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {invoices.map((inv) => {
              const balance = inv.grossAmount - inv.paidAmount;
              const isSelected = selectedIds.includes(inv.id);

              return (
                <tr
                  key={inv.id}
                  className={`hover:bg-gray-50 ${
                    isSelected ? "bg-blue-50/40" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOne(inv.id)}
                      className="h-4 w-4 cursor-pointer"
                    />
                  </td>

                  <td className="px-4 py-2">
                    <Link
                      href={`/invoices/${inv.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {inv.invoiceNumber}
                    </Link>
                  </td>

                  <td className="px-4 py-2">{inv.clientName}</td>
                  <td className="px-4 py-2">{inv.issueDate}</td>
                  <td className="px-4 py-2">{inv.dueDate}</td>

                  <td className="px-4 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        inv.status === "paid"
                          ? "bg-green-100 text-green-800"
                          : inv.status === "overdue"
                          ? "bg-red-100 text-red-800"
                          : inv.status === "part_paid"
                          ? "bg-yellow-100 text-yellow-800"
                          : inv.status === "cancelled"
                          ? "bg-gray-200 text-gray-700 line-through"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {inv.status.replace("_", " ")}
                    </span>
                  </td>

                  <td className="px-4 py-2 text-right">
                    £{(inv.paidAmount / 100).toFixed(2)} / £{(inv.grossAmount / 100).toFixed(2)}
                    {balance > 0 && (
                      <div className="text-xs text-gray-500">
                        Balance £{(balance / 100).toFixed(2)}

                      </div>
                    )}
                  </td>

                  <td className="px-4 py-2 text-center">
                    {inv.hasPaymentLink ? (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                        Pay‑enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs text-gray-500">
                        Offline only
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}

            {invoices.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-6 text-center text-sm text-gray-500"
                >
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-4 rounded-full bg-slate-900 text-white px-6 py-3 shadow-2xl shadow-slate-900/40 border border-slate-700/60 backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 min-w-[2.5rem] items-center justify-center rounded-full bg-blue-500/20 text-xs font-semibold text-blue-200 border border-blue-400/40">
                {selectedCount} selected
              </span>

              {bulkLoading ? (
                <span className="text-xs text-slate-300">Running command…</span>
              ) : (
                <span className="text-xs text-slate-300">
                  Choose a command to run on selected invoices.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={bulkLoading}
                onClick={() => runBulkAction("send")}
                className="rounded-full bg-blue-500 px-3 py-1.5 text-xs font-medium hover:bg-blue-400 disabled:opacity-50"
              >
                Send
              </button>

              <button
                disabled={bulkLoading}
                onClick={() => runBulkAction("mark_paid")}
                className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium hover:bg-emerald-400 disabled:opacity-50"
              >
                Mark as paid
              </button>

              <button
                disabled={bulkLoading}
                onClick={() => runBulkAction("cancel")}
                className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-medium hover:bg-rose-400 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            <button
              disabled={bulkLoading}
              onClick={() => setSelectedIds([])}
              className="text-xs text-slate-300 hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {bulkMessage && (
        <div className="fixed bottom-2 right-4 rounded-md bg-slate-900 text-slate-100 px-3 py-2 text-xs shadow-lg border border-slate-700/70">
          {bulkMessage}
        </div>
      )}
    </div>
  );
}
