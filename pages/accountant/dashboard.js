// ❗ dynamic flag does nothing in pages router, but harmless to keep
export const dynamic = "force-dynamic";

// ❗ THIS forces SSR and disables static generation
export async function getServerSideProps() {
  return { props: {} };
}

import { useEffect, useState } from "react";
import ResponsiveLayout from "../../components/ResponsiveLayout";
import { AccountantClientPanel } from "../../components/AccountantClientPanel";
import { AccountantClientOverview } from "../../components/AccountantClientOverview";
import { AccountantProfilePanel } from "../../components/AccountantProfilePanel";
import { AccountantClientProfilePanel } from "../../components/AccountantClientProfilePanel";
import ClientSwitcher from "../../components/ClientSwitcher";
// TEMP: remove route guard until it’s accountant/founder/admin aware
// import { useRouteGuard } from "../../hooks/useRouteGuard";

export default function AccountantDashboard() {
  // useRouteGuard(); // ❌ disable for now so founder/admin can access

  const [me, setMe] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // ⭐ FORCE FRESH ACCOUNTANT SESSION
        const meRes = await fetch(`/api/accountant/me?ts=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" }
        });

        if (!meRes.ok) {
          setLoading(false);
          return;
        }

        const meData = await meRes.json();
        setMe(meData.user);

        // ⭐ FORCE FRESH CLIENT LIST
        const clientsRes = await fetch(`/api/accountant/clients?ts=${Date.now()}`, {
          cache: "no-store",
          headers: { "Cache-Control": "no-store" }
        });

        if (clientsRes.ok) {
          const cData = await clientsRes.json();
          setClients(cData.clients || []);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // ⭐ Auto-select first client in production if none is set
  useEffect(() => {
    async function ensureClientSelected() {
      if (loading) return;
      if (!me) {
        setInitializing(false);
        return;
      }
      if (clients.length === 0) {
        setInitializing(false);
        return;
      }
      if (me.actingAsClientId) {
        setInitializing(false);
        return;
      }

      const firstClientId = clients[0].id;

      await fetch("/api/accountant/switch-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: firstClientId })
      });

      setMe({ ...me, actingAsClientId: firstClientId });
      setInitializing(false);
    }

    ensureClientSelected();
  }, [loading, me, clients]);

  if (loading || initializing) {
    return (
      <ResponsiveLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-1/3"></div>
          <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          <div className="h-32 bg-slate-200 rounded"></div>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <h1 className="text-2xl font-bold">Accountant Dashboard</h1>
      <p className="text-slate-600 mt-2">
        Manage your clients, switch between accounts, and review their figures.
      </p>

      <div className="mt-6 space-y-6">

        {/* ⭐ MUST COME FIRST — sets actingAsClientId (from dropdown) */}
        <ClientSwitcher
          clients={clients}
          currentClient={me?.actingAsClientId || ""}
        />

        {/* ⭐ No client selected (should almost never show now) */}
        {!me?.actingAsClientId && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
            No client selected. Choose a client above to begin.
          </div>
        )}

        {/* ⭐ These panels depend on actingAsClientId */}
        {me?.actingAsClientId && (
          <>
            {/* ⭐ Accountant-side Client Profile */}
            <AccountantClientProfilePanel />

            {/* ⭐ Overview (financials + submissions) */}
            <AccountantClientOverview />

            {/* ⭐ Client list + switcher panel */}
            <AccountantClientPanel />

            {/* ⭐ Accountant’s own profile */}
            <AccountantProfilePanel />
          </>
        )}
      </div>
    </ResponsiveLayout>
  );
}
