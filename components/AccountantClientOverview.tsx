import React, { useEffect, useState } from "react";

type ClientOverviewResponse = {
  success?: boolean;
  error?: string;
  client?: {
    id: string;
    clientId: string;
    email: string;
    name: string | null;
    businessName: string | null;
    subscriptionStatus: string;
    createdAt: string;
  };
  financials?: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
  };
  submissions?: {
    vat: any;
    sa: any;
    cis: any;
    ct: any;
  };
};

export function AccountantClientOverview() {
  const [actingAs, setActingAs] = useState<string | null>(null);
  const [data, setData] = useState<ClientOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ⭐ Load accountant context + overview (reactive)
  async function load() {
    try {
      setLoading(true);
      setError(null);

      // 1. Get acting client (fresh)
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

      // 2. Fetch overview (fresh)
      const res = await fetch(`/api/accountant/client-overview?ts=${Date.now()}`, {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ clientId }),
      });

      const json: ClientOverviewResponse = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to load overview");
      } else {
        setData(json);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  // ⭐ Load on mount
  useEffect(() => {
    load();
  }, []);

  // ⭐ Reload when accountant switches clients
  useEffect(() => {
    if (actingAs) load();
  }, [actingAs]);

  // ⭐ Loading skeleton
  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm animate-pulse space-y-4">
        <div className="h-5 bg-slate-200 rounded w-1/3"></div>
        <div className="h-4 bg-slate-200 rounded w-1/2"></div>
        <div className="h-24 bg-slate-200 rounded"></div>
      </section>
    );
  }

  // ⭐ No client selected
  if (!actingAs) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">
          Select a client above to view their overview.
        </p>
      </section>
    );
  }

  // ⭐ Error state
  if (error) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-red-600">{error}</p>
      </section>
    );
  }

  // ⭐ No data
  if (!data || !data.client) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-600">No overview data available.</p>
      </section>
    );
  }

  const { client, financials, submissions } = data;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">
        {client.businessName || client.name || "Client Overview"}
      </h2>

      {/* ⭐ Financials */}
      {financials ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-slate-500 text-sm">Total Revenue</p>
            <p className="text-xl font-bold">£{financials.totalRevenue.toFixed(2)}</p>
          </div>

          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-slate-500 text-sm">Total Expenses</p>
            <p className="text-xl font-bold">£{financials.totalExpenses.toFixed(2)}</p>
          </div>

          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-slate-500 text-sm">Net Profit</p>
            <p
              className={`text-xl font-bold ${
                financials.netProfit >= 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              £{financials.netProfit.toFixed(2)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-600">No financial data available.</p>
      )}

      {/* ⭐ Subscription */}
      <div className="rounded-md border border-slate-200 p-3">
        <p className="text-slate-500 text-sm">Subscription</p>
        <p className="text-md font-medium">{client.subscriptionStatus}</p>
      </div>

      {/* ⭐ Last Submissions */}
      <div className="rounded-md border border-slate-200 p-3 space-y-2">
        <p className="text-slate-500 text-sm">Last Submissions</p>

        <p className="text-sm">
          VAT:{" "}
          {submissions?.vat
            ? `${submissions.vat.period_start} → ${submissions.vat.period_end}`
            : "No VAT submissions"}
        </p>

        <p className="text-sm">
          Self Assessment:{" "}
          {submissions?.sa
            ? `${submissions.sa.period_start} → ${submissions.sa.period_end}`
            : "No SA submissions"}
        </p>

        <p className="text-sm">
          CIS:{" "}
          {submissions?.cis
            ? `${submissions.cis.period_start} → ${submissions.cis.period_end}`
            : "No CIS submissions"}
        </p>

        <p className="text-sm">
          Corporation Tax:{" "}
          {submissions?.ct
            ? `${submissions.ct.period_start} → ${submissions.ct.period_end}`
            : "No CT submissions"}
        </p>
      </div>
    </section>
  );
}
