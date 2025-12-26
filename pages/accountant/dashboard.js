// ❗ dynamic flag does nothing in pages router, but harmless to keep
export const dynamic = "force-dynamic";

// ❗ THIS is the real fix — forces SSR and disables static generation
export async function getServerSideProps() {
  return { props: {} };
}

import ResponsiveLayout from "../../components/ResponsiveLayout";
import { AccountantClientPanel } from "../../components/AccountantClientPanel";
import { AccountantClientOverview } from "../../components/AccountantClientOverview";
import { AccountantProfilePanel } from "../../components/AccountantProfilePanel";
import ClientSwitcher from "../../components/ClientSwitcher";   // ⭐ ADDED
import { useRouteGuard } from "../../hooks/useRouteGuard";

export default function AccountantDashboard() {
  useRouteGuard();

  return (
    <ResponsiveLayout>
      <h1 className="text-2xl font-bold">Accountant Dashboard</h1>
      <p className="text-slate-600 mt-2">
        Manage your clients, switch between accounts, and review their figures.
      </p>

      <div className="mt-6 space-y-6">

        {/* ⭐ MUST COME FIRST — sets actingAsClientId */}
        <ClientSwitcher />

        <AccountantProfilePanel />
        <AccountantClientPanel />
        <AccountantClientOverview />
      </div>
    </ResponsiveLayout>
  );
}
