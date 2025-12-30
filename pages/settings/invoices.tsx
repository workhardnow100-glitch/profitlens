// pages/settings/invoices.tsx

import { useEffect, useState } from "react";
import { useUser } from "../../hooks/useUser";
import type { InvoiceSettings } from "../../types/invoices";

export default function InvoiceSettingsPage() {
  const { user, loading } = useUser();
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function loadSettings() {
      const res = await fetch("/api/invoices/settings");
      const data = await res.json();
      setSettings(data.settings);
      setLoadingSettings(false);
    }

    loadSettings();
  }, [user]);

  const handleChange = (field: keyof InvoiceSettings, value: string) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);

    const res = await fetch("/api/invoices/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        default_payment_terms: settings.default_payment_terms,
        default_vat_rate: settings.default_vat_rate
          ? Number(settings.default_vat_rate)
          : null,
        default_notes: settings.default_notes,
        default_payment_instructions: settings.default_payment_instructions,
        default_footer: settings.default_footer,
        default_invoice_prefix: settings.default_invoice_prefix,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      alert(data.error || "Failed to save settings");
      return;
    }

    setSettings(data.settings);
  };

  if (loading || loadingSettings || !settings) {
    return <div className="p-6">Loading invoice settings…</div>;
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Invoice defaults</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure the default values for new invoices. These can be overridden per invoice.
        </p>
      </div>

      <div className="space-y-6 max-w-xl">
        {/* Invoice prefix */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Invoice number prefix
          </label>
          <input
            type="text"
            value={settings.default_invoice_prefix || ""}
            onChange={(e) =>
              handleChange("default_invoice_prefix", e.target.value)
            }
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            placeholder="INV-"
          />
          <p className="text-xs text-gray-500">
            Used when generating invoice numbers (e.g. INV-1001).
          </p>
        </div>

        {/* Payment terms */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Default payment terms
          </label>
          <textarea
            value={settings.default_payment_terms || ""}
            onChange={(e) =>
              handleChange("default_payment_terms", e.target.value)
            }
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            rows={3}
            placeholder="Payment due within 14 days."
          />
        </div>

        {/* VAT rate */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Default VAT rate (%)
          </label>
          <input
            type="number"
            value={settings.default_vat_rate ?? ""}
            onChange={(e) =>
              handleChange("default_vat_rate", e.target.value)
            }
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            placeholder="20"
          />
        </div>

        {/* Notes to client */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Default notes to client
          </label>
          <textarea
            value={settings.default_notes || ""}
            onChange={(e) => handleChange("default_notes", e.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            rows={3}
            placeholder="Thank you for your business."
          />
        </div>

        {/* Payment instructions */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Default payment instructions
          </label>
          <textarea
            value={settings.default_payment_instructions || ""}
            onChange={(e) =>
              handleChange("default_payment_instructions", e.target.value)
            }
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            rows={3}
            placeholder="Bank transfer details, reference format, etc."
          />
        </div>

        {/* Footer */}
        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">
            Default invoice footer
          </label>
          <textarea
            value={settings.default_footer || ""}
            onChange={(e) => handleChange("default_footer", e.target.value)}
            className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
            rows={2}
            placeholder="Company registration, VAT number, legal text."
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save defaults"}
        </button>
      </div>
    </div>
  );
}
