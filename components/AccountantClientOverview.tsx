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

  // Load accountant context + overview
  useEffect(() => {
    const load = async () => {
      try {
        // 1. Get acting client
        const meRes = await fetch("/api/accountant/me");
        if (!meRes.ok) return;

        const meData = await meRes.json();
        const clientId = meData?.user?.actingAsClientId || null;
        setActingAs(clientId);

        if (!clientId) {
          setLoading(false);
          return;
        }

        // 2. Fetch overview
        const res = await fetch("/api/accountant/client-overview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

  if (!data || !data.client || !data.financials) {
    return null;
  }

  const { client, financials, submissions } = data;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-6">
      <h2 className="text-lg font-semibold text-slate-900">
        {client.businessName || client.name || "Client Overview"}
      </h2>

      {/* Financials */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-md border border-slate-200 p-3">
          <p className="text-slate-500 text-sm">Total Revenue</p>
          <p className="text-xl font-bold">
            £{financials.totalRevenue.toFixed(2)}
          </p>
        </div>

        <div className="rounded-md border border-slate-200 p-3">
          <p className="text-slate-500 text-sm">Total Expenses</p>
          <p className="text-xl font-bold">
            £{financials.totalExpenses.toFixed(2)}
          </p>
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

      {/* Subscription */}
      <div className="rounded-md border border-slate-200 p-3">
        <p className="text-slate-500 text-sm">Subscription</p>
        <p className="text-md font-medium">{client.subscriptionStatus}</p>
      </div>

      {/* Last Submissions */}
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
