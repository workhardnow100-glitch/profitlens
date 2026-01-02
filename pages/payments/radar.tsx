// pages/payments/radar.tsx

import { useEffect, useState } from "react";

type RadarResponse = {
  payments: any[];
  invoicePayments: any[];
  transactions: any[];
  invoices: any[];
};

export default function PaymentsRadarPage() {
  const [data, setData] = useState<RadarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/payments/radar");
        if (!res.ok) throw new Error(`Radar API error: ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        console.error("Radar UI error:", err);
        setError(err.message ?? "Failed to load payments radar");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return <div className="p-6 text-slate-600">Loading Payments Radar…</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">Error: {error}</div>;
  }

  if (!data) {
    return <div className="p-6">No data returned from Payments Radar.</div>;
  }

  const { payments, invoicePayments, transactions, invoices } = data;

  const totalPayments = sumBy(payments, (p) => p.amount || 0);
  const totalTransactions = sumBy(transactions, (t) => t.amount || 0);
  const totalInvoices = invoices.length;

  return (
    <div className="p-6 space-y-10">

      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Payments Radar</h1>
          <p className="text-slate-500 mt-1">
            Cockpit view of Stripe payments, invoice matches, and ledger activity.
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <div>Radar · Live data</div>
          <div>{new Date().toLocaleString()}</div>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <SummaryCard
          title="Stripe Payments"
          value={payments.length}
          subtitle={formatAmount(totalPayments, "GBP")}
        />
        <SummaryCard
          title="Invoice Payments"
          value={invoicePayments.length}
          subtitle="Reconciled"
        />
        <SummaryCard
          title="Transactions"
          value={transactions.length}
          subtitle={formatAmount(totalTransactions, "GBP")}
        />
        <SummaryCard
          title="Invoices"
          value={totalInvoices}
          subtitle="Issued"
        />
      </div>

      {/* GRID: PAYMENTS + INVOICE PAYMENTS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Section title="Stripe Payments">
          <DataTable
            columns={["ID", "Amount", "Platform Fee", "Intent", "Invoice"]}
            rows={payments.map((p) => ({
              ID: shortId(p.id),
              Amount: (
                <AmountPill
                  amount={p.amount}
                  currency="GBP"
                  direction="in"
                />
              ),
              "Platform Fee": formatAmount(p.platform_fee_amount, "GBP"),
              Intent: shortId(p.stripe_payment_intent),
              Invoice: p.invoice_id ?? "-",
            }))}
          />
        </Section>

        <Section title="Invoice Payments (Matched)">
          <DataTable
            columns={["Invoice", "Transaction", "Amount", "Confidence"]}
            rows={invoicePayments.map((ip) => ({
              Invoice: ip.invoice_id,
              Transaction: ip.transaction_id,
              Amount: (
                <AmountPill
                  amount={Math.round(ip.amount * 100)}
                  currency="GBP"
                  direction="in"
                />
              ),
              Confidence: ip.match_confidence,
            }))}
          />
        </Section>
      </div>

      {/* GRID: TRANSACTIONS + INVOICES */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Section title="Transactions Ledger">
          <DataTable
            columns={["ID", "Client", "Amount", "Date", "Type"]}
            rows={transactions.map((t) => ({
              ID: shortId(t.id),
              Client: t.client_id,
              Amount: (
                <AmountPill
                  amount={Math.round(t.amount * 100)}
                  currency="GBP"
                  direction={t.type === "income" ? "in" : "out"}
                />
              ),
              Date: new Date(t.date).toLocaleDateString(),
              Type: t.type,
            }))}
          />
        </Section>

        <Section title="Invoices">
          <DataTable
            columns={["ID", "Number", "Total", "Status", "Client"]}
            rows={invoices.map((inv) => ({
              ID: shortId(inv.id),
              Number: inv.invoice_number,
              Total: formatAmount(inv.total, "GBP"),
              Status: <StatusBadge status={inv.status} />,
              Client: inv.client_id,
            }))}
          />
        </Section>
      </div>
    </div>
  );
}

/* ----------------------------- COMPONENTS ----------------------------- */

function SummaryCard({
  title,
  value,
  subtitle,
  variant = "default",
}: {
  title: string;
  value: number;
  subtitle?: string;
  variant?: "default" | "warning" | "success";
}) {
  const variantClasses =
    variant === "warning"
      ? "border-amber-300 bg-amber-50"
      : variant === "success"
      ? "border-emerald-300 bg-emerald-50"
      : "border-slate-200 bg-white";

  return (
    <div className={`shadow rounded-lg p-6 border ${variantClasses}`}>
      <p className="text-slate-500 text-xs uppercase tracking-wide">{title}</p>
      <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
      {subtitle && (
        <p className="text-slate-500 text-sm mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="bg-white shadow rounded-lg border border-slate-200 p-4 overflow-auto">
        {children}
      </div>
    </div>
  );
}

function DataTable({ columns, rows }: { columns: string[]; rows: any[] }) {
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="text-left border-b border-slate-200 bg-slate-50">
          {columns.map((col) => (
            <th key={col} className="py-2 px-2 text-slate-600 font-semibold">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="py-4 text-slate-400 text-center">
              No data
            </td>
          </tr>
        )}

        {rows.map((row, i) => (
          <tr
            key={i}
            className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
          >
            {columns.map((col) => (
              <td key={col} className="py-2 px-2 text-slate-700 align-middle">
                {row[col]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = (status || "").toLowerCase();

  let label = status || "unknown";
  let classes =
    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border";

  if (["succeeded", "paid", "available"].includes(normalized)) {
    classes += " bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (["pending", "in_transit"].includes(normalized)) {
    classes += " bg-amber-50 text-amber-700 border-amber-200";
  } else if (["failed", "canceled"].includes(normalized)) {
    classes += " bg-rose-50 text-rose-700 border-rose-200";
  } else {
    classes += " bg-slate-50 text-slate-600 border-slate-200";
  }

  return <span className={classes}>{label}</span>;
}

function AmountPill({
  amount,
  currency,
  direction,
}: {
  amount: number;
  currency: string;
  direction: "in" | "out";
}) {
  const isOut = direction === "out";
  const sign = isOut ? "-" : "+";
  const classes = isOut
    ? "bg-rose-50 text-rose-700 border-rose-200"
    : "bg-emerald-50 text-emerald-700 border-emerald-200";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${classes}`}
    >
      {sign} {formatAmount(amount, currency)}
    </span>
  );
}

/* ----------------------------- HELPERS ----------------------------- */

function formatAmount(amount: number, currency?: string) {
  if (amount == null) return "-";
  const c = (currency || "GBP").toUpperCase();
  return `${c} ${(amount / 100).toFixed(2)}`;
}

function sumBy<T>(items: T[], fn: (item: T) => number): number {
  return items.reduce((acc, item) => acc + (fn(item) || 0), 0);
}

function shortId(id: string | null | undefined): string {
  if (!id) return "-";
  if (id.length <= 10) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}
