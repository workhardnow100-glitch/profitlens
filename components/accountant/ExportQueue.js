// components/accountant/ExportQueue.js
import { useEffect, useState } from "react";
import { useUser } from "../../hooks/useUser";
import { getSupabaseClient } from "../../lib/supabase-client";

export default function ExportQueue() {
  const { user } = useUser();
  const [exports, setExports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.clientId) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    async function fetchExports() {
      const { data, error } = await supabase
        .from("exports") // ✅ ensure this table exists
        .select("*")
        .eq("client_id", user.clientId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch exports:", error.message);
        setError("Unable to load exports.");
      } else {
        setExports(data || []);
      }
      setLoading(false);
    }

    fetchExports();
  }, [user?.clientId]);

  return (
    <section className="p-6 bg-white rounded shadow">
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Export Queue</h2>

      {loading ? (
        <p className="text-sm text-slate-500">Loading exports...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : exports.length === 0 ? (
        <p className="text-sm text-slate-500">No exports queued for this client.</p>
      ) : (
        <ul className="space-y-3">
          {exports.map((e) => (
            <li key={e.id} className="flex justify-between items-center border-b pb-2">
              <div>
                <p className="font-medium text-slate-800">{e.format}</p>
                <p className="text-sm text-slate-500">{e.range}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    e.status === "ready"
                      ? "bg-green-50 text-green-700"
                      : e.status === "building"
                      ? "bg-yellow-50 text-yellow-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  {e.status}
                </span>
                {e.status === "ready" && e.download_url && (
                  <a
                    href={e.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Download
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
