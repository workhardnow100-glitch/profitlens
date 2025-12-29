// pages/sa/history.js
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import ResponsiveLayout from "../../components/ResponsiveLayout";
import ResponsiveCard from "../../components/ResponsiveCard";

export default function SAHistory() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) router.replace("/login");
    else fetchHistory();
  }, [session, status]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const res = await fetch("/api/sa/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: session.user.actingAsClientId ?? session.user.clientId }),
      });

      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error(err);
      alert("Error loading SA history: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!session?.user) return null;

  return (
    <ResponsiveLayout currentPageName="SA History">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Self Assessment History</h1>

        {loading ? (
          <p>Loading history…</p>
        ) : (
          <ResponsiveCard title="SA Submissions">
            {submissions.length > 0 ? (
              <ul className="space-y-3">
                {submissions.map((s) => (
                  <li
                    key={s.id}
                    className="border p-3 rounded bg-white flex flex-col gap-1"
                  >
                    <p>
                      <strong>Period:</strong>{" "}
                      {s.period_start} → {s.period_end}
                    </p>

                    <p>
                      <strong>Profit:</strong> £
                      {s.profit?.toFixed(2) || "0.00"}
                    </p>

                    <p>
                      <strong>Tax Liability:</strong> £
                      {s.tax_liability?.toFixed(2) || "0.00"}
                    </p>

                    <p>
                      <strong>Submitted:</strong>{" "}
                      {new Date(s.created_at).toLocaleString()}
                    </p>

                    <details className="mt-2">
                      <summary className="cursor-pointer text-blue-600">
                        HMRC Response
                      </summary>
                      <pre className="bg-gray-100 p-2 rounded mt-2 overflow-x-auto">
                        {JSON.stringify(s.hmrc_response || {}, null, 2)}
                      </pre>
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No SA submissions yet.</p>
            )}
          </ResponsiveCard>
        )}
      </div>

      {/* ✅ Filing Disclaimer (Strong Version for SA History) */}
      <p className="text-xs text-slate-500 mt-8 text-center max-w-2xl mx-auto">
        ProfitLens does not provide tax advice. All calculations are estimates
        only. Users are solely responsible for verifying all figures and
        ensuring accuracy before submitting any tax filings to HMRC.
      </p>

    </ResponsiveLayout>
  );
}

