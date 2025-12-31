import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "../../../hooks/useUser";

interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  issue_date: string;
  due_date: string;
  payment_terms: string;
  payment_instructions: any;
  notes_to_client: string;
  status: string;
  net_amount: number;
  tax_amount: number;
  gross_amount: number;
}

interface ExternalClient {
  id: string;
  contact_name?: string;
  business_name?: string;
  trading_name?: string;
  contact_email?: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  line_total: number;
  position: number;
}

export default function EditInvoicePage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading } = useUser();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [externalClient, setExternalClient] = useState<ExternalClient | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(true);

  // -----------------------------
  // Load invoice + client + line items
  // -----------------------------
  useEffect(() => {
    if (!id || !user) return;

    async function load() {
      const res = await fetch(`/api/invoices/${id}`);
      const data = await res.json();

      setInvoice(data.invoice);
      setExternalClient(data.externalClient);
      setLineItems(data.lineItems);
      setLoadingInvoice(false);
    }

    load();
  }, [id, user]);

  if (loading || loadingInvoice) {
    return <div className="p-6">Loading invoice…</div>;
  }

  if (!invoice) {
    return <div className="p-6 text-red-600">Invoice not found</div>;
  }

  // -----------------------------
  // Save handler
  // -----------------------------
  const saveInvoice = async () => {
    setSaving(true);

    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceNumber: invoice.invoice_number,
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        paymentTerms: invoice.payment_terms,
        paymentInstructions: invoice.payment_instructions,
        notesToClient: invoice.notes_to_client,
        status: invoice.status,
      }),
    });

    setSaving(false);

    if (res.ok) {
      router.push(`/invoices/${invoice.id}`);
    } else {
      alert("Failed to save invoice");
    }
  };

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-semibold">Edit Invoice</h1>

      {/* Client */}
      <div className="rounded-md border p-4">
        <h2 className="text-lg font-semibold">Client</h2>
        <p className="text-sm text-gray-600">
          {externalClient?.contact_name ||
            externalClient?.business_name ||
            externalClient?.trading_name}
        </p>
        <p className="text-sm text-gray-500">{externalClient?.contact_email}</p>
      </div>

      {/* Invoice details */}
      <div className="rounded-md border p-4 space-y-4">
        <h2 className="text-lg font-semibold">Invoice Details</h2>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Invoice Number</label>
          <input
            type="text"
            value={invoice.invoice_number}
            onChange={(e) =>
              setInvoice({ ...invoice, invoice_number: e.target.value })
            }
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Issue Date</label>
            <input
              type="date"
              value={invoice.issue_date}
              onChange={(e) =>
                setInvoice({ ...invoice, issue_date: e.target.value })
              }
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Due Date</label>
            <input
              type="date"
              value={invoice.due_date}
              onChange={(e) =>
                setInvoice({ ...invoice, due_date: e.target.value })
              }
              className="w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Payment Terms</label>
          <input
            type="text"
            value={invoice.payment_terms}
            onChange={(e) =>
              setInvoice({ ...invoice, payment_terms: e.target.value })
            }
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Notes to Client</label>
          <textarea
            value={invoice.notes_to_client}
            onChange={(e) =>
              setInvoice({ ...invoice, notes_to_client: e.target.value })
            }
            className="w-full rounded border px-3 py-2 text-sm"
            rows={4}
          />
        </div>
      </div>

      {/* Line items */}
      <div className="rounded-md border p-4 space-y-4">
        <h2 className="text-lg font-semibold">Line Items</h2>

        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Description</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Unit</th>
              <th className="px-3 py-2 text-right">VAT %</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lineItems.map((li) => (
              <tr key={li.id}>
                <td className="px-3 py-2">{li.description}</td>
                <td className="px-3 py-2 text-right">{li.quantity}</td>
                <td className="px-3 py-2 text-right">£{li.unit_price}</td>
                <td className="px-3 py-2 text-right">{li.vat_rate}%</td>
                <td className="px-3 py-2 text-right">£{li.line_total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-xs text-gray-500">
          Line items editing will be added in the next upgrade.
        </p>
      </div>

      {/* Save */}
      <button
        onClick={saveInvoice}
        disabled={saving}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Invoice"}
      </button>
    </div>
  );
}
