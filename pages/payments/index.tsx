import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "../../hooks/useUser";

type Payout = {
  id: string;
  amount: number;
  net: number | null;
  fee: number | null;
  status: string;
  arrival_date: string | null;
  created_at: string;
  item_count: number;
};

type PayoutDrilldown = {
  payout: Payout;
  payout_items: any[];
  balance_items: any[];
  charges: any[];
};

export default function PaymentsPage() {
  const { user } = useUser();

  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<PayoutDrilldown | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  // Load payouts
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/payments/payouts");
        const data = await res.json();
        setPayouts(data.payouts || []);
      } catch (err) {
        console.error("Failed to load payouts:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Load drilldown for a payout
  async function loadDrilldown(id: string) {
    setDrillLoading(true);
    try {
      const res = await fetch(`/api/payments/payouts/${id}`);
      const data = await res.json();
      setDrilldown(data);
    } catch (err) {
      console.error("Failed to load payout drilldown:", err);
    } finally {
      setDrillLoading(false);
    }
  }

  // Derived stats
  const totalPayouts = payouts.length;
  const totalAmount = payouts.reduce((s, p) => s + p.amount, 0);
  const totalNet = payouts.reduce((s, p) => s + (p.net ?? p.amount), 0);
  const totalFees = payouts.reduce((s, p) => s + (p.fee ?? 0), 0);

  const failedCount = payouts.filter((p) => p.status === "failed").length;
  const pendingCount = payouts.filter((p) =>
    ["pending", "in_transit"].includes(p.status)
  ).length;

  const avgFeeRate =
    totalAmount > 0 ? ((totalFees / totalAmount) * 100).toFixed(2) : "0.00";

  let health = "Healthy";
  let healthColor = "text-emerald-600";

  if (failedCount > 0) {
    health = "Issues Detected";
    healthColor = "text-red-600";
  } else if (pendingCount > 0 || Number(avgFeeRate) > 3) {
    health = "Attention Needed";
    healthColor = "text-amber-600";
  }

  const currency = "£";

  return (
    <div className="p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold mb-2">Payouts Cockpit</h1>
        <p className="text-sm text-slate-600">
          Stripe settlement overview for{" "}
          <strong>{user?.email || "your account"}</strong>.
        </p>
      </header>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Payouts"
          value={totalPayouts}
          amount={`${currency}${(totalAmount / 100).toFixed(2)}`}
        />
        <SummaryCard
          title="Total Net"
          value={0}
          amount={`${currency}${(totalNet / 100).toFixed(2)}`}
        />
        <SummaryCard
          title="Total Fees"
          value={0}
          amount={`${currency}${(totalFees / 100).toFixed(2)}`}
        />
        <SummaryCard title="Avg Fee Rate" value={0} amount={`${avgFeeRate}%`} />
      </section>

      {/* Health + Actions */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg shadow p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            Settlement Health
          </h2>
          <p className={`text-lg font-semibold ${healthColor}`}>{health}</p>
          <p className="text-xs text-slate-500 mt-1">
            Failed payouts: <strong>{failedCount}</strong> · Pending:{" "}
            <strong>{pendingCount}</strong>
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg shadow p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            Quick Links
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href="/payments/radar"
                className="text-blue-600 hover:underline"
              >
                Go to Payments Radar →
              </Link>
            </li>
            <li>
              <Link
                href="/payments/transactions"
                className="text-blue-600 hover:underline"
              >
                View full transactions ledger →
              </Link>
            </li>
          </ul>
        </div>
      </section>

      {/* Payouts Table */}
      <section className="bg-white border border-slate-200 rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Payouts</h2>

        {loading ? (
          <p className="text-sm text-slate-500">Loading payouts…</p>
        ) : payouts.length === 0 ? (
          <p className="text-sm text-slate-500">No payouts found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-2 text-left">Arrival</th>
                <th className="p-2 text-left">Amount</th>
                <th className="p-2 text-left">Net</th>
                <th className="p-2 text-left">Fee</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Items</th>
                <th className="p-2 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <>
                  <tr
                    key={p.id}
                    className="border-b hover:bg-slate-50 cursor-pointer"
                    onClick={() => {
                      setExpanded(expanded === p.id ? null : p.id);
                      if (expanded !== p.id) loadDrilldown(p.id);
                    }}
                  >
                    <td className="p-2">
                      {p.arrival_date
                        ? new Date(p.arrival_date).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="p-2">{currency}{(p.amount / 100).toFixed(2)}</td>
                    <td className="p-2">
                      {p.net != null
                        ? `${currency}${(p.net / 100).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="p-2">
                      {p.fee != null
                        ? `${currency}${(p.fee / 100).toFixed(2)}`
                        : "—"}
                    </td>
                    <td className="p-2">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="p-2">{p.item_count}</td>
                    <td className="p-2 text-blue-600">
                      {expanded === p.id ? "Hide" : "View"}
                    </td>
                  </tr>

                  {/* Drilldown Row */}
                  {expanded === p.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={7} className="p-4">
                        {drillLoading || !drilldown ? (
                          <p className="text-sm text-slate-500">
                            Loading payout details…
                          </p>
                        ) : (
                          <DrilldownView data={drilldown} currency={currency} />
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  amount,
}: {
  title: string;
  value: number;
  amount: string;
}) {
  return (
    <div className="p-4 bg-white shadow rounded-lg border border-slate-200">
      <p className="text-sm text-slate-500">{title}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
      <p className="text-slate-600 text-sm">{amount}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let color = "bg-slate-200 text-slate-700";

  if (s === "paid") color = "bg-emerald-100 text-emerald-700";
  else if (["pending", "in_transit"].includes(s))
    color = "bg-amber-100 text-amber-700";
  else if (s === "failed") color = "bg-red-100 text-red-700";

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}

function DrilldownView({
  data,
  currency,
}: {
  data: PayoutDrilldown;
  currency: string;
}) {
  const { payout_items, balance_items, charges } = data;

  return (
    <div className="space-y-6">
      {/* Balance Items */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Settlement Lines</h3>
        <table className="w-full text-xs">
          <thead className="bg-slate-100 border-b">
            <tr>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Amount</th>
              <th className="p-2 text-left">Fee</th>
              <th className="p-2 text-left">Net</th>
              <th className="p-2 text-left">Charge</th>
            </tr>
          </thead>
          <tbody>
            {balance_items.map((b) => (
              <tr key={b.id} className="border-b">
                <td className="p-2">{b.stripe_type}</td>
                <td className="p-2">{currency}{(b.amount / 100).toFixed(2)}</td>
                <td className="p-2">
                  {b.fee != null ? `${currency}${(b.fee / 100).toFixed(2)}` : "—"}
                </td>
                <td className="p-2">
                  {b.net != null ? `${currency}${(b.net / 100).toFixed(2)}` : "—"}
                </td>
                <td className="p-2">{b.charge_id || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charges */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Charges</h3>
        <table className="w-full text-xs">
          <thead className="bg-slate-100 border-b">
            <tr>
              <th className="p-2 text-left">Charge ID</th>
              <th className="p-2 text-left">Gross</th>
              <th className="p-2 text-left">Fee</th>
              <th className="p-2 text-left">Net</th>
              <th className="p-2 text-left">Invoice</th>
              <th className="p-2 text-left">Client</th>
            </tr>
          </thead>
          <tbody>
            {charges.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="p-2">{c.stripe_charge_id}</td>
                <td className="p-2">{currency}{(c.amount_gross / 100).toFixed(2)}</td>
                <td className="p-2">{currency}{(c.amount_fee / 100).toFixed(2)}</td>
                <td className="p-2">{currency}{(c.amount_net / 100).toFixed(2)}</td>
                <td className="p-2">{c.invoice_id || "—"}</td>
                <td className="p-2">{c.client_id || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// SSR
export async function getServerSideProps() {
  return { props: {} };
}
