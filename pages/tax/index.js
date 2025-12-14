// pages/tax/index.js
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import ResponsiveLayout from "../../components/ResponsiveLayout";
import ResponsiveCard from "../../components/ResponsiveCard";
import ResponsiveTable from "../../components/ResponsiveTable";

export default function TaxPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [taxType, setTaxType] = useState("vat");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) router.replace("/login");
  }, [session, status, router]);

  async function runCalculation() {
    setLoading(true);
    const res = await fetch("/api/tax", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: session.user.clientId,
        taxType,
        from,
        to,
      }),
    });

    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  if (!session?.user) return null;

  return (
    <ResponsiveLayout currentPageName="Making Tax Digital">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">Making Tax Digital</h1>

        {/* Controls */}
        <ResponsiveCard title="Tax Period">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <select value={taxType} onChange={e => setTaxType(e.target.value)} className="border p-2 rounded">
              <option value="vat">VAT</option>
              <option value="cis">CIS</option>
              <option value="corp">Corporation Tax</option>
            </select>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border p-2 rounded" />
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border p-2 rounded" />
            <button onClick={runCalculation} className="bg-blue-600 text-white rounded px-4 py-2">
              {loading ? "Calculating…" : "Calculate"}
            </button>
          </div>
        </ResponsiveCard>

        {/* Results */}
        {result && (
          <>
            {/* VAT */}
            {taxType === "vat" && (
              <ResponsiveCard title="VAT Return (HMRC Boxes)">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {Object.entries(result.calculations.vat).map(([box, value]) => (
                    <div key={box} className="border p-4 rounded">
                      <p className="text-sm text-slate-500">{box.toUpperCase()}</p>
                      <p className="text-xl font-bold">£{value.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </ResponsiveCard>
            )}

            {/* CIS */}
            {taxType === "cis" && (
              <ResponsiveCard title="CIS Summary">
                <p className="text-xl font-bold">Deducted: £{result.calculations.cis.deducted.toFixed(2)}</p>
              </ResponsiveCard>
            )}

            {/* Corporation Tax */}
            {taxType === "corp" && (
              <ResponsiveCard title="Corporation Tax">
                <p>Profit: £{result.calculations.corporationTax.profit.toFixed(2)}</p>
                <p className="font-bold">Estimated Tax (25%): £{result.calculations.corporationTax.estimatedTax.toFixed(2)}</p>
              </ResponsiveCard>
            )}

            {/* Transactions */}
            <ResponsiveCard title="Transactions Used">
              <ResponsiveTable headers={["Date", "Description", "Amount"]}>
                {result.transactions.map(t => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>{t.description}</td>
                    <td>£{Number(t.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </ResponsiveTable>
            </ResponsiveCard>
          </>
        )}
      </div>
    </ResponsiveLayout>
  );
}
