import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "../../../hooks/useUser";

interface ExternalClient {
  id: string;
  contact_name?: string;
  business_name?: string;
  trading_name?: string;
  contact_email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
  country?: string;
}

export default function EditExternalClientPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading } = useUser();

  const [client, setClient] = useState<ExternalClient | null>(null);
  const [loadingClient, setLoadingClient] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [contactName, setContactName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("");

  useEffect(() => {
    if (!id || !user) return;

    async function load() {
      const res = await fetch(`/api/external-clients/${id}`);
      const data = await res.json();

      if (data.externalClient) {
        const c = data.externalClient;
        setClient(c);

        setContactName(c.contact_name || "");
        setBusinessName(c.business_name || "");
        setTradingName(c.trading_name || "");
        setContactEmail(c.contact_email || "");
        setPhone(c.phone || "");

        setAddress1(c.address_line1 || "");
        setAddress2(c.address_line2 || "");
        setCity(c.city || "");
        setPostcode(c.postcode || "");
        setCountry(c.country || "");
      }

      setLoadingClient(false);
    }

    load();
  }, [id, user]);

  if (loading || loadingClient) return <div className="p-6">Loading…</div>;
  if (!client) return <div className="p-6 text-red-600">Client not found</div>;

  const handleSave = async () => {
    if (!contactEmail) {
      alert("Email is required");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/external-clients/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: client.id,
          contact_name: contactName,
          business_name: businessName,
          trading_name: tradingName,
          contact_email: contactEmail,
          phone,
          address_line1: address1,
          address_line2: address2,
          city,
          postcode,
          country,
        }),
      });

      if (!res.ok) {
        console.error("Failed to update client");
        setSaving(false);
        return;
      }

      router.push("/external-clients");
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Edit Client</h1>
        <p className="text-sm text-gray-500">
          Update the details for this external client.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Contact name</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Business name</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Trading name</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={tradingName}
            onChange={(e) => setTradingName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Email *</label>
          <input
            type="email"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Phone</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
      </div>

      <h2 className="text-sm font-semibold uppercase text-gray-500">
        Address
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Address line 1</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={address1}
            onChange={(e) => setAddress1(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Address line 2</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={address2}
            onChange={(e) => setAddress2(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">City</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Postcode</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium">Country</label>
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          className="rounded-md border px-4 py-2 text-sm font-medium"
          onClick={() => router.push("/external-clients")}
        >
          Cancel
        </button>

        <button
          type="button"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          disabled={saving}
          onClick={handleSave}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}
