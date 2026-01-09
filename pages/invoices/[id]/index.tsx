import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useUser } from "../../../hooks/useUser";

// -----------------------------
// Types
// -----------------------------
interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  issue_date: string;
  due_date: string;
  status: string;
  payment_status: string;
  gross_amount: number;
  net_amount: number;
  tax_amount: number;
  payment_instructions: any;
  stripe_payment_link_url?: string;
  created_at?: string;
  updated_at?: string;
}

interface ExternalClient {
  id: string;
  contact_name?: string;
  business_name?: string;
  trading_name?: string;
  contact_email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  line_total: number;
}

interface Payment {
  id: string;
  amount: number;
  match_confidence: string;
  source: string;
  transactions: {
    date?: string;
    description?: string;
  } | null;
  created_at?: string;
}

// -----------------------------
// Component
// -----------------------------
export default function InvoiceViewPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading } = useUser();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [externalClient, setExternalClient] = useState<ExternalClient | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingInvoice, setLoadingInvoice] = useState(true);
  const [matchResult, setMatchResult] = useState<any>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  // -----------------------------
  // Load invoice
  // -----------------------------
  useEffect(() => {
    if (!id || !user) return;

    async function loadInvoice() {
      const res = await fetch(`/api/invoices/${id}`);
      const data = await res.json();

      setInvoice(data.invoice);
      setExternalClient(data.externalClient);
      setLineItems(data.lineItems);
      setPayments(data.payments);
      setLoadingInvoice(false);
    }

    loadInvoice();
  }, [id, user]);

  if (loading || loadingInvoice) {
    return <div className="p-6">Loading invoice…</div>;
  }

  if (!invoice) {
    return <div className="p-6 text-red-600">Invoice not found</div>;
  }

  // -----------------------------
  // Derived values
  // -----------------------------
  const subtotal = invoice.net_amount;
  const vatTotal = invoice.tax_amount;
  const grossTotal = invoice.gross_amount;

  const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = grossTotal - paidAmount;

  const clientDisplayName =
    externalClient?.contact_name ||
    externalClient?.business_name ||
    externalClient?.trading_name ||
    "Client";

  // -----------------------------
  // Actions
  // -----------------------------
  const runMatchingEngine = async () => {
    const res = await fetch(`/api/invoices/${invoice.id}/match`, {
      method: "POST",
    });
    const data = await res.json();
    setMatchResult(data);

    if (data.matched) {
      const refreshed = await fetch(`/api/invoices/${invoice.id}`);
      const updated = await refreshed.json();
      setPayments(updated.payments);
      setInvoice(updated.invoice);
      setExternalClient(updated.externalClient);
    }
  };

  const sendInvoiceEmail = async () => {
    setSendingEmail(true);

    const res = await fetch(`/api/invoices/${invoice.id}/send`, {
      method: "POST",
    });

    const data = await res.json();
    setSendingEmail(false);

    if (data.success) {
      alert("Invoice email sent successfully.");
    } else {
      alert("Failed to send invoice email.");
    }
  };

  // -----------------------------
  // Activity log
  // -----------------------------
  const activityEntries: { label: string; detail?: string }[] = [];

  if (invoice.created_at) {
    activityEntries.push({
      label: "Invoice created",
      detail: new Date(invoice.created_at).toLocaleString(),
    });
  }

  if (invoice.updated_at && invoice.updated_at !== invoice.created_at) {
    activityEntries.push({
      label: "Invoice updated",
      detail: new Date(invoice.updated_at).toLocaleString(),
    });
  }

  if (invoice.stripe_payment_link_url) {
    activityEntries.push({
      label: "Payment link created",
    });
  }

  if (payments.length > 0) {
  payments.forEach((p) => {
    activityEntries.push({
      label: "Payment received",
      detail: `£${(p.amount / 100).toFixed(2)}${
        p.created_at ? ` • ${new Date(p.created_at).toLocaleString()}` : ""
      }`,
    });
  });
}

if (matchResult?.matched && matchResult.match?.transaction) {
  activityEntries.push({
    label: "Matching engine",
    detail: `Matched transaction on ${matchResult.match.transaction.date} with ${matchResult.match.confidence}% confidence`,
  });
}


  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Invoice {invoice.invoice_number}
          </h1>
          <p className="text-sm text-gray-500">
            Issue: {invoice.issue_date} • Due: {invoice.due_date}
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/invoices/${invoice.id}/edit`}
            className="rounded-md border px-4 py-2 text-sm"
          >
            Edit
          </Link>

          <a
            href={`/api/invoices/${invoice.id}/pdf`}
            target="_blank"
            className="rounded-md border px-4 py-2 text-sm"
          >
            Download PDF
          </a>

          <button
            onClick={sendInvoiceEmail}
            disabled={sendingEmail}
            className="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
          >
            {sendingEmail ? "Sending…" : "Send Invoice"}
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="flex flex-wrap gap-4">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
            invoice.status === "paid"
              ? "bg-green-100 text-green-800"
              : invoice.status === "overdue"
              ? "bg-red-100 text-red-800"
              : invoice.status === "sent"
              ? "bg-blue-100 text-blue-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {invoice.status.toUpperCase()}
        </span>

        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
            invoice.payment_status === "paid"
              ? "bg-green-100 text-green-800"
              : invoice.payment_status === "failed"
              ? "bg-red-100 text-red-800"
              : "bg-gray-100 text-gray-800"
          }`}
        >
          {invoice.payment_status.toUpperCase()}
        </span>
      </div>

      {/* Payment Panel */}
      <div className="rounded-md border p-6 space-y-4 bg-gray-50">
        <h2 className="text-lg font-semibold">Payment</h2>

        {/* Payment Status + Balance */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-sm text-gray-600">Status</div>
            <div
              className={`text-sm font-medium ${
                balance <= 0
                  ? "text-green-600"
                  : invoice.stripe_payment_link_url
                  ? "text-blue-600"
                  : "text-red-600"
              }`}
            >
              {balance <= 0
                ? "Paid"
                : invoice.stripe_payment_link_url
                ? "Card payments enabled"
                : "Payment link missing"}
            </div>
          </div>

          <div className="space-y-1 text-right">
            <div className="text-sm text-gray-600">Balance due</div>
            <div className="text-sm font-medium">
              £{balance.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Payment Link Actions */}
        {invoice.stripe_payment_link_url ? (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(invoice.stripe_payment_link_url!);
              }}
              className="rounded-md border px-3 py-1 text-sm"
            >
              Copy payment link
            </button>

            <a
              href={invoice.stripe_payment_link_url}
              target="_blank"
              className="rounded-md border px-3 py-1 text-sm"
            >
              Open link
            </a>
          </div>
        ) : (
          <p className="text-sm text-red-600">
            ⚠️ Payment link missing — this should not happen. The invoice API
            may have failed to generate a link.
          </p>
        )}

        {/* Paid / Balance summary */}
        <div className="text-sm text-gray-600">
          Paid: Paid: £{(paidAmount / 100).toFixed(2)}
          <br />
          Balance: £{(balance / 100).toFixed(2)}

        </div>
      </div>

      {/* External Client details */}
      <div className="rounded-md border p-6 space-y-2">
        <h2 className="text-lg font-semibold">Client details</h2>
        {externalClient ? (
          <div className="text-sm text-gray-700 space-y-1">
            <div className="font-medium text-gray-900">{clientDisplayName}</div>

            {(externalClient.address_line1 ||
              externalClient.address_line2 ||
              externalClient.city ||
              externalClient.postcode) && (
              <div className="text-gray-700">
                {externalClient.address_line1 && <div>{externalClient.address_line1}</div>}
                {externalClient.address_line2 && <div>{externalClient.address_line2}</div>}
                {(externalClient.city || externalClient.postcode) && (
                  <div>
                    {externalClient.city}
                    {externalClient.city && externalClient.postcode ? ", " : ""}
                    {externalClient.postcode}
                  </div>
                )}
              </div>
            )}

            {(externalClient.contact_email || externalClient.phone) && (
              <div className="text-gray-700">
                {externalClient.contact_email && (
                  <div>Email: {externalClient.contact_email}</div>
                )}
                {externalClient.phone && (
                  <div>Phone: {externalClient.phone}</div>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Loading client details…</p>
        )}
      </div>

      {/* Matching Engine Panel */}
      <div className="rounded-md border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Matching Engine</h2>

        <button
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          onClick={runMatchingEngine}
        >
          Run Matching Engine
        </button>

        <p className="text-sm text-gray-500">
          Automatically matches transactions to this invoice using amount, date, description, and client.
        </p>

        {matchResult && (
          <div className="rounded-md border p-4 text-sm space-y-2">
            {matchResult.matched ? (
              <>
                <div className="font-medium text-green-700">
                  Match Found (Confidence: {matchResult.match.confidence}%)
                </div>
                <div>Amount: £{matchResult.match.transaction.amount}</div>
                <div>Date: {matchResult.match.transaction.date}</div>
                <div>Match Type: {matchResult.match.match_type}</div>
              </>
            ) : (
              <div className="text-red-600">No strong match found.</div>
            )}
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="rounded-md border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Activity log</h2>
        {activityEntries.length === 0 ? (
          <p className="text-sm text-gray-500">
            No activity recorded yet. Events will appear here as this invoice is updated, emailed, and paid.
          </p>
        ) : (
          <ul className="text-sm text-gray-700 space-y-2">
            {activityEntries.map((entry, idx) => (
              <li key={idx} className="flex justify-between">
                <span>{entry.label}</span>
                {entry.detail && (
                  <span className="text-gray-500">{entry.detail}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Line items */}
      <div className="rounded-md border overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Description</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Unit</th>
              <th className="px-4 py-2 text-right">VAT</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lineItems.map((li) => (
              <tr key={li.id}>
                <td className="px-4 py-2">{li.description}</td>
                <td className="px-4 py-2 text-right">{li.quantity}</td>
                <td className="px-4 py-2 text-right">
                  {/* Line items */}
      <div className="rounded-md border overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Description</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Unit</th>
              <th className="px-4 py-2 text-right">VAT</th>
              <th className="px-4 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lineItems.map((li) => (
              <tr key={li.id}>
                <td className="px-4 py-2">{li.description}</td>
                <td className="px-4 py-2 text-right">{li.quantity}</td>
                <td className="px-4 py-2 text-right">
                  £{(li.unit_price / 100).toFixed(2)}

                </td>
                <td className="px-4 py-2 text-right">{li.vat_rate}%</td>
                <td className="px-4 py-2 text-right">
                  £{(
  (li.quantity * li.unit_price * (1 + li.vat_rate / 100)) / 100
).toFixed(2)}

                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
                </td>
<td className="px-4 py-2 text-right">{li.vat_rate}%</td>
<td className="px-4 py-2 text-right">
  £{(
    (li.quantity * li.unit_price * (1 + li.vat_rate / 100)) / 100
  ).toFixed(2)}
</td>
</tr>
))}
</tbody>
</table>
</div>

{/* Summary */}
<div className="flex justify-end">
  <div className="w-64 space-y-2 text-sm">
    <div className="flex justify-between">
      <span>Subtotal</span>
      <span>£{(subtotal / 100).toFixed(2)}</span>
    </div>
    <div className="flex justify-between">
      <span>VAT</span>
      <span>£{(vatTotal / 100).toFixed(2)}</span>
    </div>
    <div className="flex justify-between font-semibold">
      <span>Total</span>
      <span>£{(grossTotal / 100).toFixed(2)}</span>
    </div>
  </div>
</div>

{/* Payments */}
<div className="rounded-md border p-6 space-y-4">
  <h2 className="text-lg font-semibold">Payments</h2>

  {payments.length === 0 ? (
    <p className="text-sm text-gray-500">No payments yet.</p>
  ) : (
    <div className="space-y-3">
      {payments.map((p) => (
        <div
          key={p.id}
          className="rounded-md border p-3 text-sm flex justify-between"
        >
          <div>
            <div>£{(p.amount / 100).toFixed(2)}</div>
            <div className="text-gray-500">
              {p.match_confidence} confidence • {p.source}
            </div>
          </div>
          <div className="text-right">
            <div className="text-gray-500">
              {p.transactions?.date?.slice(0, 10)}
            </div>
            <div className="text-gray-500">
              {p.transactions?.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
</div>
);
}
