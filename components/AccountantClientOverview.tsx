import React, { useEffect, useState } from "react";

type OverviewResponse = {
  success: boolean;
  overview: {
    businessName: string | null;
    totalRevenue: number;
    totalExpenses: number;
    net: number;
    lastStatementDate: string | null;
    subscriptionStatus: string;
  };
};

export function AccountantClientOverview() {
  const [overview, setOverview] = useState<OverviewResponse["overview"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingAs, setActingAs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load accountant context
  useEffect(() => {
    const load = async () => {
      try {
        const meRes = await fetch("/api/accountant/me");
        if (!meRes.ok) return;

        const meData = await meRes.json();
        const clientId = meData?.user?.actingAsClientId || null;
        setActingAs(clientId);

        if (!clientId) {
          setLoading(false);
          return;
        }

        const res = await fetch("/api/accountant/client-overview");
        const data: OverviewResponse = await res.json();

        if (!res.ok) {
          setError(data?.error || "Failed to load overview");
        } else {
          setOverview(data.overview);
        }
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">Loading client overview…</p>
      </section>
    );
  }

  if (!actingAs) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">
          Select a client above to view their overview.
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-red-600">{error}</p>
      </section>
    );
  }

  if (!overview) {
    return null;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">
        {overview.businessName || "Client Overview"}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-md border border-slate-200 p-3">
          <p className="text-slate-500 text-sm">Total Revenue</p>
          <p className="text-xl font-bold">£{overview.totalRevenue.toFixed(2)}</p>
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <p className="text-slate-500 text-sm">Total Expenses</p>
          <p className="text-xl font-bold">£{overview.totalExpenses.toFixed(2)}</p>
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <p className="text-slate-500 text-sm">Net Profit</p>
          <p
            className={`text-xl font-bold ${
              overview.net >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            £{overview.net.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 p-3">
        <p className="text-slate-500 text-sm">Last Statement</p>
        <p className="text-md font-medium">
          {overview.lastStatementDate || "No statements yet"}
        </p>
      </div>

      <div className="rounded-md border border-slate-200 p-3">
        <p className="text-slate-500 text-sm">Subscription</p>
        <p className="text-md font-medium">{overview.subscriptionStatus}</p>
      </div>
    </section>
  );
}
