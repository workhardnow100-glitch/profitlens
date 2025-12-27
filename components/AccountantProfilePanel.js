import { useState, useEffect } from "react";

export function AccountantProfilePanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

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

  // Load profile
  async function loadProfile() {
    const res = await fetch(`/api/accountant/profile?ts=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-store" }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.profile) setProfile(data.profile);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
  }, []);

  // Save profile
  async function save() {
    setSaving(true);

    await fetch("/api/accountant/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });

    setSaving(false);
    setEditing(false);

    // Reload updated profile
    await loadProfile();
  }

  if (loading) return <p>Loading profile…</p>;

  return (
    <div className="p-6 border rounded-lg bg-white shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Your Accountant Profile</h2>

      {!editing && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(profile).map(([key, value]) => (
              <div key={key}>
                <p className="text-sm font-medium capitalize text-slate-600">
                  {key.replace(/_/g, " ")}
                </p>
                <p className="mt-1 text-slate-900">{value || "—"}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => setEditing(true)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Edit Profile
          </button>
        </>
      )}

      {editing && (
        <>
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

          <div className="flex gap-3 mt-4">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              {saving ? "Saving…" : "Save Profile"}
            </button>

            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
