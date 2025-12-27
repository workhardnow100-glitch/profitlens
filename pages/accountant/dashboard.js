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
import ClientSwitcher from "../../components/ClientSwitcher";
import { useRouteGuard } from "../../hooks/useRouteGuard";

export default function AccountantDashboard() {
  useRouteGuard();

  const [me, setMe] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch("/api/accountant/me", {
          cache: "no-store"
        });
        if (!meRes.ok) {
          setLoading(false);
          return;
        }

        const meData = await meRes.json();
        setMe(meData.user);

        const clientsRes = await fetch("/api/accountant/clients", {
          cache: "no-store"
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

  if (loading) {
    return (
      <ResponsiveLayout>
        <p className="text-slate-600">Loading accountant dashboard…</p>
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

        {/* ⭐ MUST COME FIRST — sets actingAsClientId */}
        <ClientSwitcher
          clients={clients}
          currentClient={me?.actingAsClientId || ""}
        />

        <AccountantProfilePanel />
        <AccountantClientPanel />
        <AccountantClientOverview />
      </div>
    </ResponsiveLayout>
  );
}
