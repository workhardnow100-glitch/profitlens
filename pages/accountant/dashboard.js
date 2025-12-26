export const dynamic = "force-dynamic";

import ResponsiveLayout from "../../components/ResponsiveLayout";
import { AccountantClientPanel } from "../../components/AccountantClientPanel";
import { AccountantClientOverview } from "../../components/AccountantClientOverview";
import { useRouteGuard } from "../../hooks/useRouteGuard";

export default function AccountantDashboard() {
  // ✅ Route guard: only accountants and founder can access
  useRouteGuard();

  return (
    <ResponsiveLayout>
      <h1 className="text-2xl font-bold">Accountant Dashboard</h1>
      <p className="text-slate-600 mt-2">
        Manage your clients, switch between accounts, and review their figures.
      </p>

      <div className="mt-6 space-y-6">
        <AccountantClientPanel />
        <AccountantClientOverview />
      </div>
    </ResponsiveLayout>
  );
}
