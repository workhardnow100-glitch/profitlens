import { useState, useEffect } from "react";

export function AccountantProfilePanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    business_name: "",
    trading_name: "",
    office_address: "",
    postcode: "",
    phone: "",
    website: "",
    accountant_name: "",
    regulatory_body: "",
    firm_reference_number: "",
  });

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/accountant/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.profile) setProfile(data.profile);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function save() {
    setSaving(true);
    await fetch("/api/accountant/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    setSaving(false);
  }

  if (loading) return <p>Loading profile…</p>;

  return (
    <div className="p-6 border rounded-lg bg-white shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Your Accountant Profile</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(profile).map(([key, value]) => (
          <div key={key}>
            <label className="block text-sm font-medium capitalize">
              {key.replace(/_/g, " ")}
            </label>
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={value || ""}
              onChange={(e) =>
                setProfile({ ...profile, [key]: e.target.value })
              }
            />
          </div>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
      >
        {saving ? "Saving…" : "Save Profile"}
      </button>
    </div>
  );
}
