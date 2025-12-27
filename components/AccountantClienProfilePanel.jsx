import { useEffect, useState } from "react";

export function AccountantClientProfilePanel() {
  const [actingAs, setActingAs] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);

    // ⭐ Get acting client
    const meRes = await fetch(`/api/accountant/me?ts=${Date.now()}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-store" }
    });

    if (!meRes.ok) {
      setError("Failed to load accountant context");
      setLoading(false);
      return;
    }

    const meData = await meRes.json();
    const clientId = meData?.user?.actingAsClientId || null;
    setActingAs(clientId);

    if (!clientId) {
      setLoading(false);
      return;
    }

    // ⭐ Fetch client profile
    const res = await fetch(`/api/accountant/client-profile?ts=${Date.now()}`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });

    const json = await res.json();

    if (!res.ok) {
      setError(json.error || "Failed to load client profile");
    } else {
      setClient(json.client);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // ⭐ Reload when switching clients
  useEffect(() => {
    if (actingAs) load();
  }, [actingAs]);

  if (loading) {
    return (
      <section className="p-6 border rounded-lg bg-white shadow-sm animate-pulse space-y-4">
        <div className="h-6 bg-slate-200 rounded w-1/3"></div>
        <div className="h-4 bg-slate-200 rounded w-1/2"></div>
        <div className="h-24 bg-slate-200 rounded"></div>
      </section>
    );
  }

  if (!actingAs) {
    return (
      <section className="p-6 border rounded-lg bg-white shadow-sm">
        <p className="text-sm text-slate-600">
          Select a client above to view their business profile.
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="p-6 border rounded-lg bg-white shadow-sm">
        <p className="text-sm text-red-600">{error}</p>
      </section>
    );
  }

  if (!client) return null;

  return (
    <section className="p-6 border rounded-lg bg-white shadow-sm space-y-6">
      <h2 className="text-xl font-semibold">Client Business Profile</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(client).map(([key, value]) => (
          <div key={key}>
            <p className="text-sm font-medium capitalize text-slate-600">
              {key.replace(/_/g, " ")}
            </p>
            <p className="mt-1 text-slate-900">{value || "—"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
