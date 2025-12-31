// pages/recurring-invoices/index.tsx
import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "../../hooks/useUser";

type RecurringInvoice = {
  id: string;
  name?: string;
  client_id: string | null;
  frequency_type: string;
  interval: number;
  next_run_date: string | null;
  active: boolean;
  created_at: string;
};

export default function RecurringInvoicesPage() {
  const { user } = useUser();
  const [items, setItems] = useState<RecurringInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function load() {
      try {
        const res = await fetch("/api/recurring-invoices");
        if (!res.ok) {
          throw new Error(`Failed to load recurring invoices (${res.status})`);
        }
        const data = await res.json();
        setItems(data.recurring || []);
      } catch (err: any) {
        console.error("Failed to load recurring invoices", err);
        setError(err?.message || "Failed to load recurring invoices");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Recurring Invoices</h1>
        <Link
          href="/recurring-invoices/new"
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          New Schedule
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading schedules…</p>}

      {error && (
        <p className="text-sm text-red-600 mb-3">
          {error}
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-slate-500">
          No recurring schedules yet. Create your first one above.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                  Name
                </th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                  Frequency
                </th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                  Interval
                </th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                  Next Run
                </th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                  Status
                </th>
                <th className="px-4 py-2 text-right font-semibold text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((sched) => (
                <tr key={sched.id} className="border-t">
                  <td className="px-4 py-2">
                    {sched.name || `Schedule ${sched.id.slice(0, 8)}`}
                  </td>
                  <td className="px-4 py-2 capitalize">
                    {sched.frequency_type}
                  </td>
                  <td className="px-4 py-2">
                    {sched.interval || 1}
                  </td>
                  <td className="px-4 py-2">
                    {sched.next_run_date || "—"}
                  </td>
                  <td className="px-4 py-2">
                    {sched.active ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/recurring-invoices/${sched.id}`}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      View / Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// 🔒 Force SSR so static export doesn’t break on API/session usage
export async function getServerSideProps() {
  return { props: {} };
}
