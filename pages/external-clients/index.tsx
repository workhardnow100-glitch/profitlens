import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "../../hooks/useUser";

interface ExternalClient {
  id: string;
  contact_name?: string;
  business_name?: string;
  trading_name?: string;
  contact_email?: string;
  contact_phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
}

export default function ExternalClientsPage() {
  const { user, loading } = useUser();
  const [clients, setClients] = useState<ExternalClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const res = await fetch("/api/external-clients");
      const data = await res.json();
      setClients(data.externalClients || []);
      setLoadingClients(false);
    }

    load();
  }, [user]);

  if (loading || loadingClients) {
    return <div className="p-6">Loading clients…</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clients</h1>
          <p className="text-sm text-gray-500">
            Manage your external invoice clients.
          </p>
        </div>

        <Link
          href="/external-clients/new"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          New Client
        </Link>
      </div>

      <div className="overflow-hidden rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Phone</th>
              <th className="px-4 py-2 text-left">City</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {clients.map((c) => {
              const displayName =
                c.contact_name ||
                c.business_name ||
                c.trading_name ||
                "Unnamed Client";

              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">{displayName}</td>
                  <td className="px-4 py-2">{c.contact_email || "—"}</td>
                  <td className="px-4 py-2">{c.contact_phone || "—"}</td>
                  <td className="px-4 py-2">{c.city || "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/external-clients/${c.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}

            {clients.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-sm text-gray-500"
                >
                  No clients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
