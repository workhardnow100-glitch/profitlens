import { useState, useEffect } from "react";

export function AccountantProfilePanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

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

  // ⭐ Load accountant profile (fresh)
  async function loadProfile() {
    setError(null);
    const res = await fetch(`/api/accountant/profile?ts=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-store" }
    });

    if (!res.ok) {
      setError("Failed to load accountant profile");
      setLoading(false);
      return;
    }

    const data = await res.json();
    if (data.profile) setProfile(data.profile);

    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
  }, []);

  // ⭐ Save accountant profile
  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/accountant/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save profile");
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditing(false);
    setSuccess("Profile updated successfully");

    // Reload updated profile
    await loadProfile();
  }

  // ⭐ Loading skeleton
  if (loading) {
    return (
      <div className="p-6 border rounded-lg bg-white shadow-sm animate-pulse space-y-4">
        <div className="h-6 bg-slate-200 rounded w-1/3"></div>
        <div className="h-4 bg-slate-200 rounded w-1/2"></div>
        <div className="h-24 bg-slate-200 rounded"></div>
      </div>
    );
  }

  return (
    <div className="p-6 border rounded-lg bg-white shadow-sm space-y-4">
      <h2 className="text-xl font-semibold">Your Accountant Profile</h2>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 p-2 rounded">
          {error}
        </p>
      )}

      {success && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded">
          {success}
        </p>
      )}

      {/* ⭐ VIEW MODE */}
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

      {/* ⭐ EDIT MODE */}
      {editing && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(profile).map(([key, value]) => (
              <div key={key}>
                <label className="block text-sm font-medium capitalize">
                  {key.replace(/_/g, " ")}
                </label>
                <input
                  disabled={saving}
                  className="mt-1 w-full border rounded px-3 py-2 disabled:bg-slate-100"
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
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Profile"}
            </button>

            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
