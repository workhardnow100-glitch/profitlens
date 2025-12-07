import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase-client"; // ✅ correct import
import { useUser } from "../../hooks/useUser";

export default function StatementVault() {
  const { user } = useUser();
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatements() {
      if (!user?.clientId) return;

      const { data, error } = await supabase
        .from("statements")
        .select("*")
        .eq("client_id", user.clientId)
        .order("date", { ascending: false });

      if (error) {
        console.error("Failed to fetch statements:", error.message);
      } else {
        setStatements(data || []);
      }
      setLoading(false);
    }

    fetchStatements();
  }, [user?.clientId]);

  return (
    <section className="p-6 bg-white rounded shadow">
      <h2 className="text-xl font-semibold text-slate-800 mb-2">Statement Vault</h2>

      {loading ? (
        <p className="text-sm text-slate-500">Loading statements...</p>
      ) : statements.length === 0 ? (
        <p className="text-sm text-slate-500">No statements found for this client.</p>
      ) : (
        <ul className="space-y-3">
          {statements.map((s) => (
            <li key={s.id} className="flex justify-between items-center border-b pb-2">
              <div>
                <p className="font-medium text-slate-800">
                  {s.name} • {s.format}
                </p>
                <p className="text-sm text-slate-500">
                  From: {s.source} • {s.date}
                </p>
              </div>
              <a
                href={s.download_url ?? "#"} // ✅ replace with signed URL if needed
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Download
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
