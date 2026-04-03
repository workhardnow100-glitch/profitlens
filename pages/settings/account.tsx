import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { supabase } from "../../lib/supabase-client";
import { toast } from "react-hot-toast";

type Client = Record<string, any>;

const AUTOSAVE_DELAY = 1200; // ms

export default function AccountSettingsPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  // ────────────────────────────────────────────────
  // LOAD CLIENT
  // ────────────────────────────────────────────────
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

  // ────────────────────────────────────────────────
  // VALIDATION
  // ────────────────────────────────────────────────
  function validate(next: Client) {
    const nextErrors: Record<string, string> = {};

    if (!next.business_name?.trim()) {
      nextErrors.business_name = "Business name is required.";
    }
    if (!next.email?.trim()) {
      nextErrors.email = "Business email is required.";
    }
    if (!next.utr_number?.trim()) {
      nextErrors.utr_number = "Corporation Tax UTR is recommended.";
    }

    setErrors(nextErrors);
    return nextErrors;
  }

  // ────────────────────────────────────────────────
  // SAVE HANDLER (USED BY AUTOSAVE + BUTTON)
  // ────────────────────────────────────────────────
  async function saveClient(current: Client) {
    setSaving(true);

    const response = await fetch("/api/settings/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(current),
    });

    const result = await response.json();
    setSaving(false);

    if (!response.ok) {
      toast.error(result.error || "Failed to save changes");
      return false;
    }

    setLastSavedAt(new Date());
    setDirty(false);
    return true;
  }

  async function handleSaveClick() {
    if (!client) return;
    const errs = validate(client);
    if (Object.keys(errs).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    const ok = await saveClient(client);
    if (ok) toast.success("Account details updated");
  }

  // ────────────────────────────────────────────────
  // AUTOSAVE (DEBOUNCED)
  // ────────────────────────────────────────────────
  useEffect(() => {
    if (!client || !dirty) return;

    const errs = validate(client);
    if (Object.keys(errs).length > 0) return;

    const timer = setTimeout(() => {
      saveClient(client);
    }, AUTOSAVE_DELAY);

    return () => clearTimeout(timer);
  }, [client, dirty]);

  // ────────────────────────────────────────────────
  // FIELD UPDATE
  // ────────────────────────────────────────────────
  function updateField(field: string, value: string) {
    if (!client) return;
    const next = { ...client, [field]: value };
    setClient(next);
    setDirty(true);
  }

  const saveStatus = useMemo(() => {
    if (saving) return "Saving…";
    if (dirty) return "Unsaved changes";
    if (lastSavedAt) return `Saved at ${lastSavedAt.toLocaleTimeString()}`;
    return "All changes saved";
  }, [saving, dirty, lastSavedAt]);

  // ────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────
  if (loading) return <div className="p-6">Loading account settings…</div>;

  if (!client) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">Account Settings</h1>
        <p className="text-gray-600 text-sm">
          No client record is linked to this account yet.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 pb-24">

      {/* HEADER */}
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Client Settings</h1>
        <p className="text-gray-600 text-sm">
          Your business identity cockpit. These details power invoices, tax submissions,
          accountant access, and the overall ProfitLens experience.
        </p>
      </div>

      {/* USER INFO */}
      <Section title="User Information" badge="Read-only" icon="👤" defaultOpen>
        {[
          { label: "Name", value: user?.name },
          { label: "Email", value: user?.email },
          { label: "Role", value: user?.role },
          { label: "Subscription", value: user?.subscriptionStatus },
          { label: "Client ID", value: user?.clientId },
        ].map(({ label, value }) => (
          <StaticBox key={label} label={label} value={value} />
        ))}
      </Section>

      {/* BUSINESS IDENTITY */}
      <Section
        title="Business Identity"
        badge="Core"
        icon="🏢"
        defaultOpen
      >
        {[
          "business_name",
          "trading_name",
          "company_number",
          "utr_number",
          "registered_address",
          "website",
          "industry",
          "business_type",
        ].map((field) => (
          <FieldBox
            key={field}
            label={formatLabel(field)}
            value={client[field]}
            onChange={(val) => updateField(field, val)}
            error={errors[field]}
          />
        ))}
      </Section>

      {/* CONTACT DETAILS */}
      <Section
        title="Contact Details"
        badge="Client-facing"
        icon="☎️"
      >
        {[
          "contact_person",
          "contact_email",
          "contact_phone",
          "email",
          "phone",
          "address",
          "postcode",
        ].map((field) => (
          <FieldBox
            key={field}
            label={formatLabel(field)}
            value={client[field]}
            onChange={(val) => updateField(field, val)}
            error={errors[field]}
            full={field === "address"}
          />
        ))}
      </Section>

      {/* HMRC CREDENTIALS */}
      <Section
        title="HMRC Credentials"
        badge="CT600"
        icon="🛂"
        highlight
      >
        {[
          "hmrc_sender_id",
          "hmrc_password",
          "utr_number",
          "self_assessment_utr",
          "nino",
          "mtditsa_id",
          "vat_number",
          "eori_number",
          "employer_reference",
          "lisa_manager_reference",
          "pension_scheme_admin_id",
          "excise_number",
          "set_reference",
          "pillar2_id",
          "group_identifier",
        ].map((field) => (
          <FieldBox
            key={field}
            label={formatLabel(field)}
            value={client[field]}
            onChange={(val) => updateField(field, val)}
            error={errors[field]}
          />
        ))}
      </Section>

      {/* DIRECTOR DETAILS */}
      <Section
        title="Director Details"
        badge="Sign-off"
        icon="✍️"
      >
        {[
          "director_name",
          "director_signature_name",
        ].map((field) => (
          <FieldBox
            key={field}
            label={formatLabel(field)}
            value={client[field]}
            onChange={(val) => updateField(field, val)}
            error={errors[field]}
          />
        ))}
      </Section>

      {/* STICKY SAVE BAR */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-white/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="text-xs text-gray-600 flex items-center gap-2">
            <span
              className={`inline-flex h-2 w-2 rounded-full ${
                saving ? "bg-amber-500" : dirty ? "bg-red-500" : "bg-emerald-500"
              }`}
            />
            <span>{saveStatus}</span>
          </div>
          <button
            onClick={handleSaveClick}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------- UI COMPONENTS ------------------------- */

function Section({
  title,
  children,
  defaultOpen = false,
  highlight = false,
  badge,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  highlight?: boolean;
  badge?: string;
  icon?: string;
}) {
  return (
    <details
      className={`rounded-lg border shadow-sm p-4 ${
        highlight ? "border-blue-500 bg-blue-50" : "bg-white"
      }`}
      open={defaultOpen}
    >
      <summary className="cursor-pointer flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {icon && <span className="text-sm">{icon}</span>}
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-700">
            {title}
          </span>
        </div>
        {badge && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 uppercase tracking-wide">
            {badge}
          </span>
        )}
      </summary>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {children}
      </div>
    </details>
  );
}

function FieldBox({
  label,
  value,
  onChange,
  textarea = false,
  full = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  textarea?: boolean;
  full?: boolean;
  error?: string;
}) {
  return (
    <div className={`${full ? "md:col-span-2" : ""} space-y-1`}>
      <label className="text-[11px] text-gray-600">{label}</label>
      {textarea ? (
        <textarea
          className={`w-full bg-white border rounded-md p-2 text-sm ${
            error ? "border-red-400" : "border-gray-300"
          }`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className={`w-full bg-white border rounded-md p-2 text-sm ${
            error ? "border-red-400" : "border-gray-300"
          }`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}

function StaticBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-md p-3 bg-gray-50 space-y-1">
      <div className="text-[11px] text-gray-600">{label}</div>
      <div className="font-medium text-gray-800 text-sm">{value || "—"}</div>
    </div>
  );
}

function formatLabel(field: string) {
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
