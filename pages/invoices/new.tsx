import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useUser } from "../../hooks/useUser";
import type { InvoiceSettings } from "../../types/invoices";

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

function createEmptyLine(defaultVat: number = 20): LineItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: 1,
    unitPrice: 0,
    vatRate: defaultVat,
  };
}

export default function NewInvoicePage() {
  const { user, loading } = useUser();
  const router = useRouter();

  // Prevent defaults from loading twice
  const defaultsLoaded = useRef(false);

  const [settings, setSettings] = useState<InvoiceSettings | null>(null);

  const [externalClientId, setExternalClientId] = useState<string>("");
  const [externalClients, setExternalClients] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");

  const [paymentTerms, setPaymentTerms] = useState<string>("");

  const [lineItems, setLineItems] = useState<LineItem[]>([
    createEmptyLine(),
  ]);

  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [sortCode, setSortCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [referenceHint, setReferenceHint] = useState("");
  const [notesToClient, setNotesToClient] = useState("");

  const [saving, setSaving] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(true);

  // -----------------------------
  // Load external clients
  // -----------------------------
  useEffect(() => {
    if (!user) return;

    async function loadClients() {
      try {
        const res = await fetch("/api/external-clients");
        const data = await res.json();
        setExternalClients(data.externalClients || []);
      } catch (err) {
        console.error("Failed to load external clients:", err);
      } finally {
        setLoadingClients(false);
      }
    }

    loadClients();
  }, [user]);

  // -----------------------------
  // Load invoice defaults (ONLY ONCE)
  // -----------------------------
  useEffect(() => {
    if (!user || defaultsLoaded.current) return;

    async function loadDefaults() {
      try {
        const res = await fetch("/api/invoices/settings");
        const data = await res.json();
        const s: InvoiceSettings = data.settings;
        setSettings(s);

        // Pre-seed fields ONCE
        setPaymentTerms(s.default_payment_terms || "Payment due within 14 days.");
        setNotesToClient(s.default_notes || "");
        setReferenceHint(
          s.default_payment_instructions || "Please use invoice number as reference"
        );

        // Payment instructions (bank details)
        if (s.default_payment_instructions) {
          try {
            const parsed = JSON.parse(s.default_payment_instructions);
            setBankName(parsed.bank_name || "");
            setAccountName(parsed.account_name || "");
            setSortCode(parsed.sort_code || "");
            setAccountNumber(parsed.account_number || "");
          } catch {}
        }

        // VAT rate for new line items
        const defaultVat = s.default_vat_rate ?? 20;
        setLineItems([createEmptyLine(defaultVat)]);

        // Invoice prefix — apply only once
        if (s.default_invoice_prefix) {
          setInvoiceNumber(s.default_invoice_prefix);
        }

        defaultsLoaded.current = true;
        setLoadingDefaults(false);
      } catch (err) {
        console.error("Failed to load invoice defaults:", err);
        setLoadingDefaults(false);
      }
    }

    loadDefaults();
  }, [user]);

  if (loading || loadingDefaults || loadingClients) return <div>Loading…</div>;
  if (!user) return <div>Please sign in</div>;

  // -----------------------------
  // Calculations
  // -----------------------------
  const subtotal = lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unitPrice,
    0
  );
  const vatTotal = lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unitPrice * (li.vatRate / 100),
    0
  );
  const grossTotal = subtotal + vatTotal;

  // -----------------------------
  // Line item handlers
  // -----------------------------
  const handleLineChange = (id: string, field: keyof LineItem, value: any) => {
    setLineItems((items) =>
      items.map((li) =>
        li.id === id
          ? { ...li, [field]: field === "description" ? value : Number(value) }
          : li
      )
    );
  };

  const addLine = () =>
    setLineItems((items) => [
      ...items,
      createEmptyLine(settings?.default_vat_rate ?? 20),
    ]);

  const removeLine = (id: string) =>
    setLineItems((items) => items.filter((li) => li.id !== id));

  // -----------------------------
  // Save invoice
  // -----------------------------
  const handleSave = async (markSent: boolean) => {
    if (!externalClientId) {
      alert("Please select a client");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: externalClientId,
          invoiceNumber: invoiceNumber || undefined,
          issueDate,
          dueDate,
          paymentTerms,
          lineItems: lineItems.map((li) => ({
            description: li.description,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            vatRate: li.vatRate,
          })),
          paymentInstructions: {
            bank_name: bankName,
            account_name: accountName,
            sort_code: sortCode,
            account_number: accountNumber,
            reference_hint: referenceHint,
          },
          notesToClient,
          markSent,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to save invoice");
        setSaving(false);
        return;
      }

      const data = await res.json();
      router.push(`/invoices/${data.invoice.id}`);
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New Invoice</h1>
          <p className="text-sm text-gray-500">
            Create a full payment-ready invoice with auto-matching.
          </p>
        </div>
      </div>

      {/* FORM */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Client */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Client</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={externalClientId}
            onChange={(e) => setExternalClientId(e.target.value)}
          >
            <option value="">Select client…</option>
            {externalClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.contact_name ||
                  c.business_name ||
                  c.trading_name ||
                  "Unnamed client"}
              </option>
            ))}
          </select>
        </div>

        {/* Invoice number */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Invoice number</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Auto-generate if blank"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />
        </div>

        {/* Payment terms */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Payment terms</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
          />
        </div>

        {/* Issue date */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Issue date</label>
          <input
            type="date"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </div>

        {/* Due date */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Due date</label>
          <input
            type="date"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      {/* LINE ITEMS */}
      {/* (unchanged — your existing code here) */}

      {/* PAYMENT + SUMMARY */}
      {/* (unchanged — your existing code here) */}
    </div>
  );
}
