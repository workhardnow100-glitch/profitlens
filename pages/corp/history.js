// pages/corp/history.js
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import ResponsiveLayout from "../../components/ResponsiveLayout";
import ResponsiveCard from "../../components/ResponsiveCard";

export default function CorpHistory() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) router.replace("/login");
    else fetchHistory();
  }, [session, status]);

  async function fetchHistory() {
    setLoading(true);
    try {
      const res = await fetch("/api/corp/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: session.user.clientId }),
      });

      const data = await res.json();

      setSubmissions(data.submissions || []);
      setPayments(data.payments || []);
    } catch (err) {
      console.error(err);
      alert("Error loading CT history: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!session?.user) return null;

  return (
    <ResponsiveLayout currentPageName="Corporation Tax History">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Corporation Tax History</h1>

        {loading ? (
          <p>Loading history…</p>
        ) : (
          <>
            {/* ✅ Submissions */}
            <ResponsiveCard title="CT Submissions">
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
                        <strong>Profit Before Tax:</strong> £
                        {s.profit_before_tax.toFixed(2)}
                      </p>
                      <p>
                        <strong>CT Due:</strong> £
                        {s.corp_tax_due.toFixed(2)}
                      </p>
                      <p>
                        <strong>Effective Rate:</strong>{" "}
                        {s.effective_rate.toFixed(2)}%
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
                          {JSON.stringify(s.hmrc_response, null, 2)}
                        </pre>
                      </details>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No CT submissions yet.</p>
              )}
            </ResponsiveCard>

            {/* ✅ Payments */}
            <ResponsiveCard title="CT Payments">
              {payments.length > 0 ? (
                <ul className="space-y-3">
                  {payments.map((p) => (
                    <li
                      key={p.id}
                      className="border p-3 rounded bg-white flex justify-between items-center"
                    >
                      <span>{p.payment_date}</span>
                      <span
                        className={
                          p.direction === "payment"
                            ? "text-red-600"
                            : "text-green-600"
                        }
                      >
                        {p.direction === "payment"
                          ? "Paid to HMRC"
                          : "Refund from HMRC"}
                      </span>
                      <span className="font-semibold">
                        £{p.amount.toFixed(2)}
                      </span>
                      <span className="text-gray-500">{p.reference || ""}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No CT payments recorded yet.</p>
              )}
            </ResponsiveCard>
          </>
        )}
      </div>
    </ResponsiveLayout>
  );
}
