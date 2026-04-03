// setting/account.tsx
"use client";

import { useState } from "react";

type Client = {
  id: string;
  business_name: string | null;
  trading_name: string | null;
  company_number: string | null;
  utr_number: string | null;
  registered_address: string | null;
  website: string | null;
  industry: string | null;
  business_type: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  postcode: string | null;
  hmrc_sender_id: string | null;
  hmrc_password: string | null;
  self_assessment_utr: string | null;
  nino: string | null;
  mtditsa_id: string | null;
  vat_number: string | null;
  eori_number: string | null;
  employer_reference: string | null;
  lisa_manager_reference: string | null;
  pension_scheme_admin_id: string | null;
  excise_number: string | null;
  set_reference: string | null;
  pillar2_id: string | null;
  group_identifier: string | null;
  director_name: string | null;
  director_signature_name: string | null;
};

type Props = {
  initialClient: Client;
  onSaved?: (client: Client) => void;
};

export function ClientSettingsForm({ initialClient, onSaved }: Props) {
  const [client, setClient] = useState<Client>(initialClient);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof Client>(key: K, value: Client[K]) {
    setClient((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/settings/account", {

      method: "POST",

        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(client),
      });
      if (!res.ok) throw new Error("Failed to save client");
      const data = (await res.json()) as Client;
      setClient(data);
      onSaved?.(data);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
      {/* SECTION 1 — Business Identity */}
      <section className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600 mb-3">
          Business identity
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Business name"
            value={client.business_name ?? ""}
            onChange={(v) => update("business_name", v)}
          />
          <Field
            label="Trading name"
            value={client.trading_name ?? ""}
            onChange={(v) => update("trading_name", v)}
          />
          <Field
            label="Company number"
            value={client.company_number ?? ""}
            onChange={(v) => update("company_number", v)}
          />
          <Field
            label="UTR number"
            value={client.utr_number ?? ""}
            onChange={(v) => update("utr_number", v)}
          />
          <Field
            label="Registered address"
            value={client.registered_address ?? ""}
            onChange={(v) => update("registered_address", v)}
          />
          <Field
            label="Website"
            value={client.website ?? ""}
            onChange={(v) => update("website", v)}
          />
          <Field
            label="Industry"
            value={client.industry ?? ""}
            onChange={(v) => update("industry", v)}
          />
          <Field
            label="Business type"
            value={client.business_type ?? ""}
            onChange={(v) => update("business_type", v)}
          />
        </div>
      </section>

      {/* SECTION 2 — Contact Details */}
      <details className="rounded-lg border bg-white p-4 shadow-sm" open>
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-gray-600 mb-3">
          Contact details
        </summary>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Contact person"
            value={client.contact_person ?? ""}
            onChange={(v) => update("contact_person", v)}
          />
          <Field
            label="Contact email"
            type="email"
            value={client.contact_email ?? ""}
            onChange={(v) => update("contact_email", v)}
          />
          <Field
            label="Contact phone"
            value={client.contact_phone ?? ""}
            onChange={(v) => update("contact_phone", v)}
          />
          <Field
            label="Business email"
            type="email"
            value={client.email ?? ""}
            onChange={(v) => update("email", v)}
          />
          <Field
            label="Business phone"
            value={client.phone ?? ""}
            onChange={(v) => update("phone", v)}
          />
          <Field
            label="Address"
            value={client.address ?? ""}
            onChange={(v) => update("address", v)}
          />
          <Field
            label="Postcode"
            value={client.postcode ?? ""}
            onChange={(v) => update("postcode", v)}
          />
        </div>
      </details>

      {/* SECTION 3 — HMRC Credentials */}
      <details className="rounded-lg border bg-white p-4 shadow-sm border-blue-500">
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-blue-700 mb-3">
          HMRC credentials
        </summary>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Government Gateway ID"
            value={client.hmrc_sender_id ?? ""}
            onChange={(v) => update("hmrc_sender_id", v)}
          />
          <Field
            label="Government Gateway password"
            type="password"
            value={client.hmrc_password ?? ""}
            onChange={(v) => update("hmrc_password", v)}
          />
          <Field
            label="Corporation Tax UTR"
            value={client.utr_number ?? ""}
            onChange={(v) => update("utr_number", v)}
          />
          <Field
            label="Self Assessment UTR"
            value={client.self_assessment_utr ?? ""}
            onChange={(v) => update("self_assessment_utr", v)}
          />
          <Field
            label="NINO"
            value={client.nino ?? ""}
            onChange={(v) => update("nino", v)}
          />
          <Field
            label="MTD ITSA ID"
            value={client.mtditsa_id ?? ""}
            onChange={(v) => update("mtditsa_id", v)}
          />
          <Field
            label="VAT number"
            value={client.vat_number ?? ""}
            onChange={(v) => update("vat_number", v)}
          />
          <Field
            label="EORI number"
            value={client.eori_number ?? ""}
            onChange={(v) => update("eori_number", v)}
          />
          <Field
            label="Employer reference"
            value={client.employer_reference ?? ""}
            onChange={(v) => update("employer_reference", v)}
          />
          <Field
            label="LISA manager reference"
            value={client.lisa_manager_reference ?? ""}
            onChange={(v) => update("lisa_manager_reference", v)}
          />
          <Field
            label="Pension scheme admin ID"
            value={client.pension_scheme_admin_id ?? ""}
            onChange={(v) => update("pension_scheme_admin_id", v)}
          />
          <Field
            label="Excise number"
            value={client.excise_number ?? ""}
            onChange={(v) => update("excise_number", v)}
          />
          <Field
            label="SET reference"
            value={client.set_reference ?? ""}
            onChange={(v) => update("set_reference", v)}
          />
          <Field
            label="Pillar 2 ID"
            value={client.pillar2_id ?? ""}
            onChange={(v) => update("pillar2_id", v)}
          />
          <Field
            label="Group identifier"
            value={client.group_identifier ?? ""}
            onChange={(v) => update("group_identifier", v)}
          />
        </div>
      </details>

      {/* SECTION 4 — Director Details */}
      <details className="rounded-lg border bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-gray-600 mb-3">
          Director details
        </summary>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="Director name"
            value={client.director_name ?? ""}
            onChange={(v) => update("director_name", v)}
          />
          <Field
            label="Director signature name"
            value={client.director_signature_name ?? ""}
            onChange={(v) => update("director_signature_name", v)}
          />
        </div>
      </details>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}

type FieldProps = {
  label: string;
  value: string;
  type?: "text" | "email" | "password";
  onChange: (value: string) => void;
};

function Field({ label, value, type = "text", onChange }: FieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </label>
  );
}
