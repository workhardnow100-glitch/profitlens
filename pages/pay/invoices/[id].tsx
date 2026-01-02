// pages/pay/invoice/[id].tsx

import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function PayInvoicePage() {
  const router = useRouter();
  const { id } = router.query;

  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    (async () => {
      try {
        const res = await fetch(`/api/invoices/${id}`);
        const json = await res.json();

        if (!res.ok) {
          setError(json.error || "Failed to load invoice");
          return;
        }

        setInvoiceData(json);
      } catch (err: any) {
        setError("Failed to load invoice");
      }
    })();
  }, [id]);

  const handlePay = async () => {
    if (!id) return;
    setLoading(true);

    const res = await fetch("/api/payments/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: id }),
    });

    const data = await res.json();
    if (data.url) window.location.href = data.url;

    setLoading(false);
  };

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!invoiceData) return <div className="p-6">Loading invoice…</div>;

  const { invoice, externalClient, lineItems, paidAmount, balance } = invoiceData;

  const isPaid = invoice.status === "paid" || invoice.payment_status === "paid";

  return (
    <div className="max-w-2xl mx-auto p-6 font-sans space-y-8">

      {/* HEADER */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-slate-800">Invoice Payment</h1>
        <p className="text-slate-500">Invoice #{invoice.invoice_number}</p>
      </div>

      {/* BUSINESS INFO */}
      <div className="p-4 border rounded-lg bg-slate-50">
        <p className="font-semibold text-slate-700">Issued by:</p>
        <p className="text-slate-600">{invoice.business_name || "Your Supplier"}</p>
        <p className="text-slate-500 text-sm">{invoice.business_email}</p>
      </div>

      {/* LINE ITEMS */}
      <div className="border rounded-lg overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="p-2 text-left">Description</th>
              <th className="p-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item: any) => (
              <tr key={item.id} className="border-b">
                <td className="p-2">{item.description}</td>
                <td className="p-2 text-right">
                  £{(item.total / 100).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* TOTALS */}
      <div className="p-4 border rounded-lg bg-white space-y-2">
        <div className="flex justify-between text-slate-700">
          <span>Total:</span>
          <span className="font-semibold">
            £{(invoice.total / 100).toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between text-slate-700">
          <span>Paid:</span>
          <span>£{paidAmount.toFixed(2)}</span>
        </div>

        <div className="flex justify-between text-slate-900 text-lg font-bold">
          <span>Balance:</span>
          <span>£{balance.toFixed(2)}</span>
        </div>
      </div>

      {/* PAYMENT BUTTON */}
      {isPaid ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 font-medium">
          This invoice is already paid.
        </div>
      ) : (
        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full py-3 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-900 transition"
        >
          {loading ? "Redirecting…" : "Pay securely"}
        </button>
      )}
    </div>
  );
}
