// pages/pay/invoice/[id].tsx
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function PayInvoicePage() {
  const router = useRouter();
  const { id } = router.query;
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const res = await fetch(`/api/invoices/${id}`);
      const data = await res.json();
      setInvoice(data.invoice);
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

  if (!invoice) return <div>Loading invoice…</div>;

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "Arial, sans-serif" }}>
      <h1>Pay Invoice</h1>
      <p><strong>From:</strong> {invoice.business_name}</p>
      <p><strong>Total:</strong> £{(invoice.total / 100).toFixed(2)}</p>
      <button onClick={handlePay} disabled={loading}>
        {loading ? "Redirecting…" : "Pay securely"}
      </button>
    </div>
  );
}
