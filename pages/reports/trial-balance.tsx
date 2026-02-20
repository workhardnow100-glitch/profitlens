// pages/reports/trial-balance.tsx
"use client";

import { useEffect, useState } from "react";
import { TrialBalanceTable } from "../../components/trial-balance/TrialBalanceTable";

export default function TrialBalancePage() {
  const [clientId, setClientId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/auth/session");
      const session = await res.json();
      setClientId(session?.user?.clientId ?? null);
    };

    load();
  }, []);

  if (!clientId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Trial Balance</h1>
        <p className="text-gray-600 mt-2">Loading client data…</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Trial Balance</h1>
      <p className="text-gray-600">
        A summary of all account balances for this client.
      </p>

      <TrialBalanceTable clientId={clientId} />
    </div>
  );
}
