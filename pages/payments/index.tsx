import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "../../hooks/useUser";
import type { PaymentStats } from "../api/types/payments"; // <-- UPDATED PATH

export default function PaymentsPage() {
  const { user } = useUser();

  // Typed state
  const [stats, setStats] = useState<PaymentStats | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch("/api/payments/radar");
        const data: { summary: PaymentStats } = await res.json();
        setStats(data.summary || null);
      } catch (err) {
        console.error("Failed to load payment stats:", err);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Payments Cockpit</h1>

      <p className="text-sm text-slate-600 mb-6">
        Manage payouts, transactions, and payment matching for{" "}
        <strong>{user?.email || "your account"}</strong>.
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <SummaryCard
          title="Stripe Payments"
          value={stats?.stripePaymentsCount ?? 0}
          amount={stats?.stripePaymentsAmount ?? "£0.00"}
        />
        <SummaryCard
          title="Invoice Payments"
          value={stats?.invoicePaymentsCount ?? 0}
          amount={stats?.invoicePaymentsAmount ?? "£0.00"}
        />
        <SummaryCard
          title="Transactions"
          value={stats?.transactionsCount ?? 0}
          amount={stats?.transactionsAmount ?? "£0.00"}
        />
        <SummaryCard
          title="Invoices Issued"
          value={stats?.invoicesCount ?? 0}
          amount=""
        />
      </div>

      {/* Navigation Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <NavTile
          title="Radar"
          description="Match payments to invoices using AI-powered matching."
          href="/payments/radar"
        />
        <NavTile
          title="Transactions"
          description="View all incoming payments and ledger activity."
          href="/payments/transactions"
        />
        <NavTile
          title="Payouts"
          description="Track outgoing payouts and settlement activity."
          href="/payments/payouts"
        />
      </div>
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
      {amount && <p className="text-slate-600 text-sm">{amount}</p>}
    </div>
  );
}

function NavTile({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <div className="p-5 bg-white shadow rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
        <h2 className="text-lg font-semibold mb-1">{title}</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
    </Link>
  );
}

// 🔒 Force SSR to prevent static export errors
export async function getServerSideProps() {
  return { props: {} };
}
