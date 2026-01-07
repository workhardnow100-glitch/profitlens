// pages/settings/account.tsx
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
      <div className="bg-white shadow rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">User Information</h2>
        <p className="text-gray-500 text-sm">Read‑only profile details.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-600">Name</label>
            <div className="font-medium">{user?.name}</div>
          </div>

          <div>
            <label className="text-sm text-gray-600">Email</label>
            <div className="font-medium">{user?.email}</div>
          </div>

          <div>
            <label className="text-sm text-gray-600">Role</label>
            <div className="font-medium">{user?.role}</div>
          </div>

          <div>
            <label className="text-sm text-gray-600">Subscription</label>
            <div className="font-medium capitalize">
              {user?.subscriptionStatus}
            </div>
          </div>
        </div>
      </div>

      {/* BUSINESS INFO */}
      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <h2 className="text-xl font-semibold">Business Information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            "business_name",
            "trading_name",
            "industry",
            "business_type",
            "website",
          ].map((field) => (
            <div key={field}>
              <label className="text-sm text-gray-600">
                {field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </label>
              <input
                className="input"
                value={client[field] || ""}
                onChange={(e) =>
                  setClient({ ...client, [field]: e.target.value })
                }
              />
            </div>
          ))}

          <div className="md:col-span-2">
            <label className="text-sm text-gray-600">Notes</label>
            <textarea
              className="input h-24"
              value={client.notes || ""}
              onChange={(e) =>
                setClient({ ...client, notes: e.target.value })
              }
            />
          </div>
        </div>
      </div>

      {/* CONTACT */}
      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <h2 className="text-xl font-semibold">Contact Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            "email",
            "phone",
            "contact_person",
            "contact_phone",
            "contact_email",
          ].map((field) => (
            <div key={field}>
              <label className="text-sm text-gray-600">
                {field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </label>
              <input
                className="input"
                value={client[field] || ""}
                onChange={(e) =>
                  setClient({ ...client, [field]: e.target.value })
                }
              />
            </div>
          ))}
        </div>
      </div>

      {/* ADDRESS */}
      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <h2 className="text-xl font-semibold">Address</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            "address",
            "postcode",
            "registered_address",
          ].map((field) => (
            <div key={field} className={field === "address" || field === "registered_address" ? "md:col-span-2" : ""}>
              <label className="text-sm text-gray-600">
                {field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </label>
              <input
                className="input"
                value={client[field] || ""}
                onChange={(e) =>
                  setClient({ ...client, [field]: e.target.value })
                }
              />
            </div>
          ))}
        </div>
      </div>

      {/* LEGAL */}
      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <h2 className="text-xl font-semibold">Legal Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            "company_number",
            "utr_number",
            "vat_number",
            "nino",
            "mtditsa_id",
          ].map((field) => (
            <div key={field}>
              <label className="text-sm text-gray-600">
                {field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </label>
              <input
                className="input"
                value={client[field] || ""}
                onChange={(e) =>
                  setClient({ ...client, [field]: e.target.value })
                }
              />
            </div>
          ))}
        </div>
      </div>

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
