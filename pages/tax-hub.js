import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";

export default function TaxHub() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState({
    vat: [],
    cis: [],
    corp: [],
    sa: [],
  });

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) router.replace("/login");
    else fetchPeriods();
  }, [session, status]);

  useEffect(() => {
    if (router.query.authorized) {
      fetchPeriods();
      router.replace("/tax-hub", undefined, { shallow: true });
    }
  }, [router.query]);

  async function fetchPeriods() {
    setLoading(true);
    try {
      const res = await fetch("/api/tax-hub/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: session.user.clientId }),
      });
      const data = await res.json();

      // Safely set periods even if empty
      setPeriods({
        vat: Array.isArray(data.vat) ? data.vat : [],
        cis: Array.isArray(data.cis) ? data.cis : [],
        corp: Array.isArray(data.corp) ? data.corp : [],
        sa: Array.isArray(data.sa) ? data.sa : [],
      });
    } catch (err) {
      console.error("Tax Hub periods error:", err);
      alert("Error fetching tax periods: " + err.message);
      setPeriods({ vat: [], cis: [], corp: [], sa: [] });
    } finally {
      setLoading(false);
    }
  }

  if (!session?.user) return null;

  const taxTypes = [
    { key: "vat", name: "VAT", path: "/vat" },
    { key: "cis", name: "CIS", path: "/cis" },
    { key: "corp", name: "Corporation Tax", path: "/corp" },
    { key: "sa", name: "Self Assessment", path: "/sa" },
  ];

  // Safe check for HMRC authorization
  const needsHMRCAuth = !((periods.vat || []).some((p) => p.hmrcAuthorized));

  return (
    <ResponsiveLayout currentPageName="Tax Hub">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Tax Hub</h1>

        {needsHMRCAuth && !loading && (
          <div className="mb-4">
            <p className="text-yellow-600 mb-2">
              HMRC account not connected. You must authorize to submit VAT/CIS periods.
            </p>
            <a
              href="/api/hmrc/auth"
              className="bg-orange-600 text-white px-4 py-2 rounded"
            >
              Authorize HMRC
            </a>
          </div>
        )}

        {loading ? (
          <p>Loading periods…</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {taxTypes.map((tax) => (
              <ResponsiveCard key={tax.key} title={tax.name}>
                {(periods[tax.key] || []).length > 0 ? (
                  <ul className="space-y-2">
                    {(periods[tax.key] || []).map((p) => (
                      <li
                        key={p.periodStart}
                        className="flex justify-between items-center border p-2 rounded"
                      >
                        <span>{p.periodLabel}</span>
                        <span
                          className={
                            p.locked
                              ? "text-red-600 font-semibold"
                              : "text-green-600 font-semibold"
                          }
                        >
                          {p.locked ? "Locked" : "Open"}
                        </span>
                        <div className="flex gap-2">
                          <button
                            className="bg-blue-600 text-white px-2 py-1 rounded"
                            onClick={() =>
                              router.push(
                                `${tax.path}?from=${p.periodStart}&to=${p.periodEnd}`
                              )
                            }
                          >
                            View
                          </button>
                          {!p.locked && (tax.key === "vat" || tax.key === "cis") && (
                            <button
                              className={`px-2 py-1 rounded text-white ${
                                p.hmrcAuthorized
                                  ? "bg-green-600"
                                  : "bg-gray-400 cursor-not-allowed"
                              }`}
                              disabled={!p.hmrcAuthorized}
                              onClick={async () => {
                                if (!p.hmrcAuthorized) return;
                                if (!confirm(`Submit ${tax.name} period ${p.periodLabel} to HMRC?`))
                                  return;

                                try {
                                  const res = await fetch(`/api/${tax.key}/submit`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                      clientId: session.user.clientId,
                                      periodStart: p.periodStart,
                                      periodEnd: p.periodEnd,
                                    }),
                                  });
                                  const data = await res.json();

                                  if (data.success) {
                                    alert(
                                      `${tax.name} period submitted and locked successfully.`
                                    );
                                    fetchPeriods();
                                  } else {
                                    alert("Submission failed: " + data.error);
                                  }
                                } catch (err) {
                                  console.error(err);
                                  alert("Submission error: " + err.message);
                                }
                              }}
                            >
                              Submit
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No periods available.</p>
                )}
              </ResponsiveCard>
            ))}
          </div>
        )}
      </div>
    </ResponsiveLayout>
  );
}
