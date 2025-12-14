// pages/mtd-dashboard.js
import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";

const API = {
  DASH: "/api/mtd-dashboards",
  SUBMIT: "/api/submit-mtd", // Stub or real HMRC submission route(s)
  CLIENT: "/api/clients",
};

// Numeric sanitiser
function toNumber(val) {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

export default function MTDDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [transactions, setTransactions] = useState([]);
  const [statusMap, setStatusMap] = useState({});
  const [locked, setLocked] = useState(false);

  // UI state
  const [periodType, setPeriodType] = useState("monthly");
  const [vatNumber, setVatNumber] = useState("");

  // Period label (drives payloads, not the query)
  const vatPeriod =
    periodType === "monthly"
      ? new Date().toISOString().slice(0, 7) // YYYY-MM
      : `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`;

  // Guard: require auth
  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.replace("/login");
      return;
    }
  }, [session, status, router]);

  // Fetch existing VAT number from your client profile (optional; non-blocking)
  useEffect(() => {
    async function fetchClientVatNumber() {
      try {
        const res = await fetch(API.CLIENT);
        const data = await res.json();
        // Expecting shape { vat_number: "GB..." } — adjust if your API differs
        if (data?.vat_number) setVatNumber(data.vat_number);
      } catch {
        // Non-blocking; ignore errors here
      }
    }
    fetchClientVatNumber();
  }, []);

  // Fetch transactions and lock status
  useEffect(() => {
    if (!session?.user?.clientId) return;

    async function fetchTransactions() {
      try {
        const res = await fetch(API.DASH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "fetchTransactions", clientId: session.user.clientId }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);

        const rows = (json.data || []).map(tx => ({
          ...tx,
          amount: toNumber(tx.amount),
          vat_amount: tx.vat_amount != null ? toNumber(tx.vat_amount) : 0,
        }));
        setTransactions(rows);
      } catch (err) {
        console.error("MTD Dashboard fetchTransactions error:", err);
      }
    }

    async function checkLock() {
      try {
        const res = await fetch(API.DASH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "checkLock", clientId: session.user.clientId }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setLocked(Boolean(json.locked));
      } catch (err) {
        console.error("MTD Dashboard checkLock error:", err);
      }
    }

    fetchTransactions();
    checkLock();
  }, [session?.user?.clientId]);

  // Totals
  const totalIncome = useMemo(
    () => transactions.filter(t => t.category === "income").reduce((sum, t) => sum + toNumber(t.amount), 0),
    [transactions]
  );
  const totalCorp = useMemo(
    () => transactions.filter(t => t.category === "corp").reduce((sum, t) => sum + toNumber(t.amount), 0),
    [transactions]
  );
  const totalCIS = useMemo(
    () => transactions.filter(t => t.category === "cis").reduce((sum, t) => sum + toNumber(t.amount), 0),
    [transactions]
  );
  const totalVAT = useMemo(
    () => transactions.reduce((sum, t) => sum + (toNumber(t.vat_amount) || 0), 0),
    [transactions]
  );

  // Profit (dashboard view, not statutory)
  const profit = useMemo(() => totalIncome + totalCorp, [totalIncome, totalCorp]);

  // Net profit view (income minus VAT and corp)
  const netProfit = useMemo(() => totalIncome - totalVAT - totalCorp, [totalIncome, totalVAT, totalCorp]);

  // Payloads per tax stream (separate filing flows)
  const payloads = useMemo(() => {
    return {
      vat: {
        period: vatPeriod,
        vatNumber,
        vatDue: Number(totalVAT.toFixed(2)),
      },
      cis: {
        period: vatPeriod,
        deducted: Number(totalCIS.toFixed(2)),
      },
      corporationTax: {
        period: vatPeriod,
        profit: Number(profit.toFixed(2)),
      },
      selfAssessment: {
        period: vatPeriod,
        income: Number(totalIncome.toFixed(2)),
        profit: Number(profit.toFixed(2)),
      },
      generatedAt: new Date().toISOString(),
    };
  }, [vatPeriod, vatNumber, totalVAT, totalCIS, totalIncome, profit]);

  if (status === "loading") return <div>Loading…</div>;
  if (!session?.user) return null;

  return (
    <ResponsiveLayout currentPageName="MTD Dashboard">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">MTD Dashboard</h1>

        {/* Period selection (drives payload period; not changing DB filter here) */}
        <ResponsiveCard title="Period selection">
          <select
            value={periodType}
            onChange={e => setPeriodType(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </ResponsiveCard>

        {/* VAT number persistence */}
        <ResponsiveCard title="VAT number">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={vatNumber}
              onChange={e => setVatNumber(e.target.value)}
              className="border p-2 w-full max-w-xs"
              placeholder="GB123456789"
            />
            <button
              onClick={async () => {
                try {
                  const res = await fetch(API.DASH, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "updateVATNumber",
                      clientId: session.user.clientId,
                      vatNumber,
                    }),
                  });
                  const json = await res.json();
                  if (!json.success) throw new Error(json.error || "Failed to save VAT number");
                  // Optional toast
                  alert("VAT number saved");
                } catch (err) {
                  alert("Error saving VAT number");
                }
              }}
              className="bg-green-600 text-white px-3 py-2 rounded"
            >
              Save
            </button>
          </div>
        </ResponsiveCard>

        {/* Top stats (mirrors established apps: VAT, Income, Profit, CIS) */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <ResponsiveCard>
            <div className="text-slate-500">VAT total</div>
            <div className="text-2xl font-bold">£{totalVAT.toFixed(2)}</div>
          </ResponsiveCard>
          <ResponsiveCard>
            <div className="text-slate-500">Income total</div>
            <div className="text-2xl font-bold">£{totalIncome.toFixed(2)}</div>
          </ResponsiveCard>
          <ResponsiveCard>
            <div className="text-slate-500">Corporation Tax profit</div>
            <div className="text-2xl font-bold">£{profit.toFixed(2)}</div>
          </ResponsiveCard>
          <ResponsiveCard>
            <div className="text-slate-500">CIS deducted</div>
            <div className="text-2xl font-bold">£{totalCIS.toFixed(2)}</div>
          </ResponsiveCard>
        </div>

        {/* Transactions table with CIS flagging */}
        <ResponsiveCard title="Transactions">
          <ResponsiveTable headers={["Date", "Description", "Amount", "VAT", "Category", "CIS"]}>
            {transactions.map(tx => (
              <tr key={tx.id}>
                <td>{tx.date}</td>
                <td>{tx.description}</td>
                <td>£{toNumber(tx.amount).toFixed(2)}</td>
                <td>
                  {tx.vat_rate ? `${tx.vat_rate}% (£${(tx.vat_amount || 0).toFixed(2)})` : "-"}
                </td>
                <td>{tx.category?.toUpperCase() || "OTHER"}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={tx.category === "cis"}
                    disabled={locked}
                    onChange={async e => {
                      const nextCategory = e.target.checked ? "cis" : (tx.category === "cis" ? "other" : tx.category);
                      try {
                        const res = await fetch(API.DASH, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "updateCategory",
                            clientId: session.user.clientId,
                            rowId: tx.id,
                            category: nextCategory,
                          }),
                        });
                        const json = await res.json();
                        if (!json.success) throw new Error(json.error || "Update failed");
                        const updated = transactions.map(t =>
                          t.id === tx.id ? { ...t, category: nextCategory } : t
                        );
                        setTransactions(updated);
                      } catch (err) {
                        alert("Failed to update CIS flag");
                      }
                    }}
                  />
                </td>
              </tr>
            ))}
            {/* Footer subtotals (visible, audit-friendly) */}
            <tr className="font-bold bg-gray-50">
              <td colSpan={2}>Totals</td>
              <td>£{(totalIncome + totalCorp + totalCIS).toFixed(2)}</td>
              <td>£{totalVAT.toFixed(2)}</td>
              <td>
                Income £{totalIncome.toFixed(2)} | Corp £{totalCorp.toFixed(2)} | CIS £{totalCIS.toFixed(2)} | Net £{netProfit.toFixed(2)}
              </td>
              <td />
            </tr>
          </ResponsiveTable>

          {/* Totals summary line */}
          <div className="mt-4 flex flex-wrap justify-end gap-6 text-right">
            <div>Total Income: £{totalIncome.toFixed(2)}</div>
            <div>Total VAT: £{totalVAT.toFixed(2)}</div>
            <div>Total Corp: £{totalCorp.toFixed(2)}</div>
            <div>Total CIS: £{totalCIS.toFixed(2)}</div>
            <div>Net Profit: £{netProfit.toFixed(2)}</div>
          </div>
        </ResponsiveCard>

        {/* Separate submission buttons per tax stream (standard MTD UX) */}
        <ResponsiveCard title="Submit to HMRC">
          <div className="flex gap-3 flex-wrap">
            {["vat", "cis", "corporationTax", "selfAssessment"].map(stream => (
              <button
                key={stream}
                disabled={!session?.user?.clientId}
                onClick={async () => {
                  const key = `${session.user.clientId}-${stream}-${vatPeriod}`;
                  setStatusMap(prev => ({ ...prev, [stream]: "Submitting..." }));
                  try {
                    const res = await fetch(API.SUBMIT, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        clientId: session.user.clientId,
                        category: stream,
                        payload: payloads[stream],
                        period: vatPeriod,
                        idempotencyKey: key,
                      }),
                    });
                    const json = await res.json();
                    const success = Boolean(json?.success);
                    setStatusMap(prev => ({ ...prev, [stream]: success ? "Success" : "Failed" }));
                    if (stream === "vat" && success) setLocked(true);
                  } catch {
                    setStatusMap(prev => ({ ...prev, [stream]: "Failed" }));
                  }
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Submit {stream.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-1">
            {Object.entries(statusMap).map(([k, v]) => (
              <p key={k}>{k.toUpperCase()}: {v}</p>
            ))}
          </div>
        </ResponsiveCard>

        {/* Payload preview (standard in many apps for transparency/audit) */}
        <ResponsiveCard title="HMRC payloads">
          <pre className="text-xs bg-gray-100 p-4 overflow-x-auto">
            {JSON.stringify(payloads, null, 2)}
          </pre>
        </ResponsiveCard>
      </div>
    </ResponsiveLayout>
  );
}
