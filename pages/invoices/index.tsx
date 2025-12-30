// pages/invoices/index.tsx
import { useEffect, useState } from "react";
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

export default function InvoicesPage() {
  const { user, loading } = useUser();
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("q", search);

      // 1) Fetch invoices
      const invRes = await fetch(`/api/invoices?${params.toString()}`);
      const invJson = await invRes.json();
      const rawInvoices = invJson.invoices || [];

      if (rawInvoices.length === 0) {
        setInvoices([]);
        return;
      }

      // 2) Collect external client IDs
      const clientIds = rawInvoices.map((i: any) => i.external_client_id);

      // 3) Fetch all external clients in one batch
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

      // 4) Map invoices → UI format
      const mapped: InvoiceListItem[] = rawInvoices.map((inv: any) => {
        const ext = clientMap[inv.external_client_id];

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

      setInvoices(mapped);
    };

    load();
  }, [user, statusFilter, search]);

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please sign in</div>;

  return (
    <div className="space-y-6">
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
              return (
                <tr key={inv.id} className="hover:bg-gray-50">
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
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {inv.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    £{inv.paidAmount.toFixed(2)} / £{inv.grossAmount.toFixed(2)}
                    {balance > 0 && (
                      <div className="text-xs text-gray-500">
                        Balance £{balance.toFixed(2)}
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
                  colSpan={7}
                  className="px-4 py-6 text-center text-sm text-gray-500"
                >
                  No invoices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
