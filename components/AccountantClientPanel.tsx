import React, { useEffect, useState } from "react";

type MeUser = {
  id: string;
  email: string;
  role: string;
  clientId: string;
  subscriptionStatus: string;
  accessibleClients: string[];
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

  useEffect(() => {
    const load = async () => {
      try {
        const [meRes, clientsRes] = await Promise.all([
          fetch("/api/accountant/me"),
          fetch("/api/accountant/clients"),
        ]);

        if (!meRes.ok) {
          setLoading(false);
          return;
        }

        const meData: MeResponse = await meRes.json();
        setMe(meData.user);

        if (meData.user.role !== "accountant") {
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

  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">Loading accountant context…</p>
      </section>
    );
  }

  if (!me || me.role !== "accountant") {
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

      {clients.length === 0 ? (
        <p className="text-sm text-slate-600">
          No clients yet. Ask your clients to invite you from their dashboard.
        </p>
      ) : (
        <div className="space-y-2">
          {clients.map((c) => {
            const isActive = me.actingAsClientId === c.client_id;
            return (
              <div
                key={c.client_id}
                className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2"
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
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
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
