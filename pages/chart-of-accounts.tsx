// pages/chart-of-accounts.tsx
import { useEffect, useState } from "react";

type CoaEntry = {
  id: string;
  account_code: string | null;
  account_name: string;
  account_type: string;
  hmrc_bucket: string | null;
  is_system: boolean;
  has_activity: boolean;
};

type CoaResponse = {
  accounts: CoaEntry[];
  meta: {
    clientId: string;
    count: number;
  };
};

export default function ChartOfAccountsPage() {
  const [data, setData] = useState<CoaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [usedOnly, setUsedOnly] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/chart-of-accounts?usedOnly=${usedOnly ? "true" : "false"}`);
        if (!res.ok) throw new Error("Failed to load chart of accounts");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message ?? "Failed to load chart of accounts");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [usedOnly]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Chart of Accounts</h1>
          <p className="text-gray-600 text-sm">
            System and activity-driven accounts for this client.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={usedOnly}
              onChange={(e) => setUsedOnly(e.target.checked)}
            />
            Show used accounts only
          </label>
        </div>
      </header>

      {loading && <p>Loading chart of accounts…</p>}
      {error && <p className="text-red-600 text-sm">Error: {error}</p>}

      {!loading && !error && data && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Code</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Name</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Type</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">HMRC Bucket</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">System</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Has Activity</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((acc) => (
                <tr key={acc.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-xs text-gray-800">
                    {acc.account_code || "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-900">{acc.account_name}</td>
                  <td className="px-3 py-2 text-gray-700">{acc.account_type}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {acc.hmrc_bucket || "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {acc.is_system ? "Yes" : "No"}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {acc.has_activity ? "Yes" : "No"}
                  </td>
                </tr>
              ))}
              {data.accounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                    No accounts found for this client.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
