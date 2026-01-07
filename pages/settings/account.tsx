import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "../../lib/supabase-client";
import { toast } from "react-hot-toast";

export default function AccountSettingsPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<any>(null);

  useEffect(() => {
    if (!user?.clientId) return;

    async function loadClient() {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", user.clientId)
        .single();

      if (error) console.error(error);
      setClient(data);
      setLoading(false);
    }

    loadClient();
  }, [user]);

  async function handleSave() {
    setLoading(true);

    const response = await fetch("/api/settings/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(client),
    });

    const result = await response.json();
    setLoading(false);

    if (!response.ok) {
      toast.error(result.error || "Failed to save changes");
      return;
    }

    toast.success("Account details updated");
  }

  if (loading) {
    return <div className="p-6">Loading account settings…</div>;
  }

  if (!client) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">Account Settings</h1>
        <p className="text-gray-600">
          No client record is linked to this account yet.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">

      {/* HEADER */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Account Settings</h1>
        <p className="text-gray-600 leading-relaxed">
          This is your business identity cockpit. Everything you enter here
          powers your invoices, payments, tax submissions, accountant access,
          and the overall experience inside ProfitLens.
        </p>
      </div>

      {/* USER INFO */}
      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <h2 className="text-xl font-semibold">User Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: "Name", value: user?.name },
            { label: "Email", value: user?.email },
            { label: "Role", value: user?.role },
            { label: "Subscription", value: user?.subscriptionStatus },
            { label: "Client ID", value: user?.clientId },
          ].map(({ label, value }) => (
            <div key={label} className="border rounded-md p-3 bg-gray-50">
              <div className="text-sm text-gray-600">{label}</div>
              <div className="font-medium text-gray-800">{value || "—"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* BUSINESS INFO */}
      <Section title="Business Information">
        {[
          "business_name",
          "trading_name",
          "industry",
          "business_type",
          "website",
        ].map((field) => (
          <FieldBox
            key={field}
            label={formatLabel(field)}
            value={client[field]}
            onChange={(val) => setClient({ ...client, [field]: val })}
          />
        ))}
        <FieldBox
          label="Notes"
          value={client.notes}
          onChange={(val) => setClient({ ...client, notes: val })}
          textarea
          full
        />
      </Section>

      {/* CONTACT */}
      <Section title="Contact Details">
        {[
          "email",
          "phone",
          "contact_person",
          "contact_phone",
          "contact_email",
        ].map((field) => (
          <FieldBox
            key={field}
            label={formatLabel(field)}
            value={client[field]}
            onChange={(val) => setClient({ ...client, [field]: val })}
          />
        ))}
      </Section>

      {/* ADDRESS */}
      <Section title="Address">
        {[
          "address",
          "postcode",
          "registered_address",
        ].map((field) => (
          <FieldBox
            key={field}
            label={formatLabel(field)}
            value={client[field]}
            onChange={(val) => setClient({ ...client, [field]: val })}
            full={field !== "postcode"}
          />
        ))}
      </Section>

      {/* LEGAL */}
      <Section title="Legal Details">
        {[
          "company_number",
          "utr_number",
          "vat_number",
          "nino",
          "mtditsa_id",
        ].map((field) => (
          <FieldBox
            key={field}
            label={formatLabel(field)}
            value={client[field]}
            onChange={(val) => setClient({ ...client, [field]: val })}
          />
        ))}
      </Section>

      {/* SAVE */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

// 🔹 Utility Components

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function FieldBox({
  label,
  value,
  onChange,
  textarea = false,
  full = false,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  textarea?: boolean;
  full?: boolean;
}) {
  return (
    <div className={`${full ? "md:col-span-2" : ""}`}>
      <div className="border rounded-md p-3 bg-gray-50 space-y-1">
        <div className="text-sm text-gray-600">{label}</div>
        {textarea ? (
          <textarea
            className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <input
            className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>
    </div>
  );
}

function formatLabel(field: string) {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
