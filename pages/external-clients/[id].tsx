import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "../../hooks/useUser";

interface ExternalClient {
  id: string;
  contact_name?: string;
  business_name?: string;
  trading_name?: string;
  contact_email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  postcode?: string;
}

export default function ExternalClientDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading } = useUser();

  const [client, setClient] = useState<ExternalClient | null>(null);
  const [loadingClient, setLoadingClient] = useState(true);

  useEffect(() => {
    if (!id || !user) return;

    async function load() {
      const res = await fetch(`/api/external-clients/${id}`);
      const data = await res.json();

      if (data.externalClient) {
        setClient(data.externalClient);
      }

      setLoadingClient(false);
    }

    load();
  }, [id, user]);

  if (loading || loadingClient) {
    return <div className="p-6">Loading client…</div>;
  }

  if (!client) {
    return <div className="p-6 text-red-600">Client not found</div>;
  }

  const displayName =
    client.contact_name ||
    client.business_name ||
    client.trading_name ||
    "Unnamed Client";

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">{displayName}</h1>

      <div className="rounded-md border p-6 space-y-3 text-sm">
        <div>
          <div className="font-medium text-gray-900">Contact</div>
          {client.contact_email && <div>Email: {client.contact_email}</div>}
          {client.phone && <div>Phone: {client.phone}</div>}
        </div>

        <div>
          <div className="font-medium text-gray-900">Address</div>
          {client.address_line1 && <div>{client.address_line1}</div>}
          {client.address_line2 && <div>{client.address_line2}</div>}
          {(client.city || client.postcode) && (
            <div>
              {client.city}
              {client.city && client.postcode ? ", " : ""}
              {client.postcode}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
