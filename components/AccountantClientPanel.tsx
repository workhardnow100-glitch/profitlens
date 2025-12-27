import React, { useEffect, useState } from "react";

type MeUser = {
  id: string;
  email: string;
  role: string;
  subscriptionStatus: string | null;
  actingAsClientId: string | null;
};

type MeResponse = { success: boolean; user: MeUser };

type ClientRow = {
  id: string;
  email: string;
  name: string | null;
  business_name: string | null;
  subscription_status: string;
  client_id: string;
};

type ClientsResponse = {
  success: boolean;
  clients: ClientRow[];
};

export function AccountantClientPanel() {
  const [me, setMe] = useState<MeUser | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ⭐ Load accountant + clients with cache-busting
  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, clientsRes] = await Promise.all([
          fetch(`/api/accountant/me?ts=${Date.now()}`, {
            cache: "no-store",
            headers: { "Cache-Control": "no-store" }
          }),
          fetch(`/api/accountant/clients?ts=${Date.now()}`, {
            cache: "no-store",
            headers: { "Cache-Control": "no-store" }
          })
        ]);

        if (!meRes.ok) {
          setLoading(false);
          return;
        }

        const meData: MeResponse = await meRes.json();
        setMe(meData.user);

        if (!["accountant", "admin", "founder"].includes(meData.user.role)) {
          setLoading(false);
          return;
        }

        if (clientsRes.ok) {
          const cData: ClientsResponse = await clientsRes.json();
          setClients(cData.clients || []);
        }
      } catch {
        setError("Failed to load accountant context");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // ⭐ Auto-select first client if none selected
  useEffect(() => {
    if (!loading && me && clients.length > 0 && !me.actingAsClientId) {
      const first = clients[0].client_id;

      fetch("/api/accountant/switch-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: first })
      }).then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setMe((prev) =>
            prev ? { ...prev, actingAsClientId: data.actingAsClientId } : prev
          );
        }
      });
    }
  }, [loading, me, clients]);

  // ⭐ Switch client manually
  const handleSwitch = async (clientId: string) => {
    setError(null);
    setSwitchingId(clientId);

    try {
      const res = await fetch("/api/accountant/switch-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to switch client");
      } else {
        setMe((prev) =>
          prev ? { ...prev, actingAsClientId: data.actingAsClientId } : prev
        );
      }
    } catch {
      setError("Network error while switching");
    } finally {
      setSwitchingId(null);
    }
  };

  // ⭐ Loading skeleton
  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
        <div className="h-5 bg-slate-200 rounded w-1/3 mb-3"></div>
        <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
        <div className="h-20 bg-slate-200 rounded"></div>
      </section>
    );
  }

  if (!me || !["accountant", "admin", "founder"].includes(me.role)) {
    return null;
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Your Clients</h2>
        <p className="text-sm text-slate-600">
          Acting as:{" "}
          <span className="font-mono">
            {me.actingAsClientId || "none selected"}
          </span>
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* ⭐ No clients */}
      {clients.length === 0 && (
        <p className="text-sm text-slate-600">
          No clients yet. Ask your clients to invite you from their dashboard.
        </p>
      )}

      {/* ⭐ Client list */}
      {clients.length > 0 && (
        <div className="space-y-2">
          {clients.map((c) => {
            const isActive = me.actingAsClientId === c.client_id;
            return (
              <div
                key={c.client_id}
                className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                  isActive ? "border-emerald-300 bg-emerald-50" : "border-slate-200"
                }`}
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-slate-900">
                    {c.business_name || c.name || c.email}
                  </p>
                  <p className="text-xs text-slate-600">
                    Client ID: <span className="font-mono">{c.client_id}</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    Subscription: {c.subscription_status}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleSwitch(c.client_id)}
                  disabled={switchingId === c.client_id}
                  className={`inline-flex items-center rounded-md px-3 py-1 text-xs font-medium shadow-sm ${
                    isActive
                      ? "bg-emerald-600 text-white"
                      : "bg-sky-600 text-white hover:bg-sky-700"
                  }`}
                >
                  {switchingId === c.client_id
                    ? "Switching..."
                    : isActive
                    ? "Active"
                    : "Act as this client"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
