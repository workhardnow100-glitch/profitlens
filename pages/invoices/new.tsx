// pages/invoices/new.tsx // standard invoice creation page

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

  // -----------------------------
  // State
  // -----------------------------
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);

  const [externalClientId, setExternalClientId] = useState<string>("");
  const [externalClients, setExternalClients] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [invoiceNumberError, setInvoiceNumberError] = useState<string | null>(
    null
  );
  const [checkingInvoiceNumber, setCheckingInvoiceNumber] = useState(false);

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

  // prevent defaults from re-applying and resetting fields
  const defaultsLoaded = useRef(false);
  const invoiceNumberDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // -----------------------------
  // Load external clients
  // -----------------------------
  useEffect(() => {
    if (!user?.id) return;

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
  }, [user?.id]);

  // -----------------------------
  // Load invoice defaults
  // -----------------------------
  useEffect(() => {
    if (!user?.id || defaultsLoaded.current) return;

    async function loadDefaults() {
      try {
        const res = await fetch("/api/invoices/settings");
        const data = await res.json();
        const s: InvoiceSettings = data.settings;
        setSettings(s);

        // Pre-seed fields
        setPaymentTerms(
          s.default_payment_terms || "Payment due within 14 days."
        );
        setNotesToClient(s.default_notes || "");
        setReferenceHint(
          s.default_payment_instructions ||
            "Please use invoice number as reference"
        );

        // Payment instructions (bank details)
        if (s.default_payment_instructions) {
          try {
            const parsed = JSON.parse(s.default_payment_instructions);
            setBankName(parsed.bank_name || "");
            setAccountName(parsed.account_name || "");
            setSortCode(parsed.sort_code || "");
            setAccountNumber(parsed.account_number || "");
          } catch {
            // ignore malformed JSON
          }
        }

        // VAT rate for new line items
        const defaultVat = s.default_vat_rate ?? 20;
        setLineItems([createEmptyLine(defaultVat)]);

        defaultsLoaded.current = true;
        setLoadingDefaults(false);
      } catch (err) {
        console.error("Failed to load invoice defaults:", err);
        setLoadingDefaults(false);
      }
    }

    loadDefaults();
  }, [user?.id]);

  // -----------------------------
  // Fetch next available invoice number
  // -----------------------------
  useEffect(() => {
    if (!user?.id) return;
    if (!defaultsLoaded.current) return;
    if (invoiceNumber) return;

    async function fetchNextNumber() {
      try {
        const res = await fetch("/api/invoices/next-number");
        if (!res.ok) {
          console.error("Failed to fetch next invoice number");
          return;
        }
        const data = await res.json();
        if (data.nextNumber && !invoiceNumber) {
          setInvoiceNumber(data.nextNumber);
        }
      } catch (err) {
        console.error("Error fetching next invoice number:", err);
      }
    }

    fetchNextNumber();
  }, [user?.id, invoiceNumber]);

  // -----------------------------
  // Live duplicate invoice number check (debounced)
  // -----------------------------
  useEffect(() => {
    if (!user?.id) return;

    if (invoiceNumberDebounceRef.current) {
      clearTimeout(invoiceNumberDebounceRef.current);
    }

    if (!invoiceNumber) {
      setInvoiceNumberError(null);
      setCheckingInvoiceNumber(false);
      return;
    }

    invoiceNumberDebounceRef.current = setTimeout(async () => {
      try {
        setCheckingInvoiceNumber(true);
        const res = await fetch(
          `/api/invoices/check-number?invoiceNumber=${encodeURIComponent(
            invoiceNumber
          )}`
        );
        if (!res.ok) {
          console.error("Failed to check invoice number");
          setCheckingInvoiceNumber(false);
          return;
        }
        const data = await res.json();
        if (data.exists) {
          setInvoiceNumberError("This invoice number is already in use.");
        } else {
          setInvoiceNumberError(null);
        }
      } catch (err) {
        console.error("Error checking invoice number:", err);
      } finally {
        setCheckingInvoiceNumber(false);
      }
    }, 300);

    return () => {
      if (invoiceNumberDebounceRef.current) {
        clearTimeout(invoiceNumberDebounceRef.current);
      }
    };
  }, [user?.id, invoiceNumber]);

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
const handleLineChange = (
  id: string,
  field: string,   // <-- FIXED: no more LineItemTemplate reference
  value: any
) => {
  setLineItems((items) =>
    items.map((li) =>
      li.id === id
        ? {
            ...li,
            [field]:
              field === "description"
                ? value
                : field === "unit_price"
                ? parseFloat(value || "0") // keep pounds as pounds, prevent NaN
                : Number(value || 0),
          }
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

    if (checkingInvoiceNumber) {
      alert("Please wait while we validate the invoice number.");
      return;
    }

    if (invoiceNumberError) {
      alert("Please fix the invoice number before saving.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: externalClientId, // correct FK
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

      if (res.status === 409) {
        // Duplicate invoice number – fetch next available and inform user
        try {
          const nextRes = await fetch("/api/invoices/next-number");
          const nextData = await nextRes.json();
          if (nextData.nextNumber) {
            setInvoiceNumber(nextData.nextNumber);
            alert(
              "That invoice number was already used. We've updated it to the next available number."
            );
          } else {
            alert(
              "That invoice number was already used. Please choose a different number."
            );
          }
        } catch (err) {
          console.error("Failed to fetch next invoice number after conflict:", err);
          alert(
            "That invoice number was already used, and we couldn't fetch the next one automatically. Please choose a different number."
          );
        }
        setSaving(false);
        return;
      }

      if (!res.ok) {
        console.error("Failed to save invoice");
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New Invoice</h1>
          <p className="text-sm text-gray-500">
            Create a full payment-ready invoice with auto-matching.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* External client selector */}
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

        <div className="space-y-2">
          <label className="text-sm font-medium">Invoice number</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Auto-generated if blank"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />
          {checkingInvoiceNumber && (
            <p className="text-xs text-gray-500">Checking invoice number…</p>
          )}
          {invoiceNumberError && (
            <p className="text-xs text-red-600">{invoiceNumberError}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Payment terms</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Issue date</label>
          <input
            type="date"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </div>

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

      {/* Line items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase text-gray-500">
            Line items
          </h2>
          <button
            type="button"
            className="text-sm text-blue-600 hover:underline"
            onClick={addLine}
          >
            Add line
          </button>
        </div>

        <div className="overflow-hidden rounded-md border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit price</th>
                <th className="px-3 py-2 text-right">VAT %</th>
                <th className="px-3 py-2 text-right">Line total</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>

            <tbody className="divide-y">
              {lineItems.map((li) => {
                const lineTotal =
                  li.quantity * li.unitPrice * (1 + li.vatRate / 100);

                return (
                  <tr key={li.id}>
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded-md border px-2 py-1 text-sm"
                        value={li.description}
                        onChange={(e) =>
                          handleLineChange(li.id, "description", e.target.value)
                        }
                        placeholder="Description"
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        className="w-20 rounded-md border px-2 py-1 text-sm text-right"
                        value={li.quantity}
                        onChange={(e) =>
                          handleLineChange(li.id, "quantity", e.target.value)
                        }
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        className="w-24 rounded-md border px-2 py-1 text-sm text-right"
                        value={li.unitPrice}
                        onChange={(e) =>
                          handleLineChange(li.id, "unitPrice", e.target.value)
                        }
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        className="w-20 rounded-md border px-2 py-1 text-sm text-right"
                        value={li.vatRate}
                        onChange={(e) =>
                          handleLineChange(li.id, "vatRate", e.target.value)
                        }
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      £{lineTotal.toFixed(2)}
                    </td>

                    <td className="px-3 py-2 text-center">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => removeLine(li.id)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary + payment section */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase text-gray-500">
            How to pay
          </h2>

          <div className="space-y-2">
            <label className="text-sm font-medium">Bank name</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Account name</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sort code</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={sortCode}
                onChange={(e) => setSortCode(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Account number</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Reference hint</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={referenceHint}
              onChange={(e) => setReferenceHint(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes to client</label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm"
              rows={4}
              value={notesToClient}
              onChange={(e) => setNotesToClient(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4 md:justify-self-end md:w-80">
          <h2 className="text-sm font-semibold uppercase text-gray-500">
            Summary
          </h2>

          <div className="space-y-2 rounded-md border p-4 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>£{subtotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between">
              <span>VAT</span>
              <span>£{vatTotal.toFixed(2)}</span>
            </div>

            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>£{grossTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              className="flex-1 rounded-md border px-4 py-2 text-sm font-medium"
              disabled={saving || !!invoiceNumberError || checkingInvoiceNumber}
              onClick={() => handleSave(false)}
            >
              Save draft
            </button>

            <button
              type="button"
              className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={saving || !!invoiceNumberError || checkingInvoiceNumber}
              onClick={() => handleSave(true)}
            >
              Save & mark as sent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
