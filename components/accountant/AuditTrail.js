import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase-client"; // ✅ consistent import
import { useUser } from "../../hooks/useUser";

export default function AuditTrail() {
  const { user } = useUser();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.clientId) return;

    async function fetchAuditLogs() {
      const { data, error } = await supabase
        .from("audit") // ✅ adjust to your actual table name
        .select("*")
        .eq("client_id", user.clientId)
        .order("timestamp", { ascending: false });

      if (error) {
        console.error("Failed to fetch audit logs:", error.message);
        setError("Unable to load audit logs.");
      } else {
        setLogs(data || []);
      }
      setLoading(false);
    }

    fetchAuditLogs();
  }, [user?.clientId]);

  return (
    <section className="p-6 bg-white rounded shadow">
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Audit Trail</h2>

      {loading ? (
        <p className="text-sm text-slate-500">Loading audit logs...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-slate-500">No audit logs found for this client.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {logs.map((log) => (
            <li key={log.id} className="py-3">
              <p className="text-sm text-slate-700">
                <strong>{log.action}</strong> by{" "}
                <span className="text-blue-600">{log.actor_email}</span>
              </p>
              <p className="text-xs text-slate-500">
                {new Date(log.timestamp).toLocaleString()}
              </p>
              {log.details && (
                <p className="text-xs text-slate-600 mt-1">{log.details}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
