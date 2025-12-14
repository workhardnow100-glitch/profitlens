// pages/mtd-dashboard.js
import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";

// --- Numeric sanitizers ---
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
  const [client, setClient] = useState(null);
  const [statusMap, setStatusMap] = useState({});
  const [locked, setLocked] = useState(false);
  const [stats, setStats] = useState([]);
  const [periodType, setPeriodType] = useState("monthly");
  const [vatNumber, setVatNumber] = useState("");

  const vatPeriod =
    periodType === "monthly"
      ? new Date().toISOString().slice(0, 7) // YYYY-MM
      : `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`;

  // Access control
  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    const isAdmin = session.user.role === "admin";
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(session.user.subscriptionStatus);
    if (!(isAdmin || isSubscribedOrTrial)) router.replace("/upgrade");
  }, [session, status, router]);

  // Fetch client info
  useEffect(() => {
    async function fetchClient() {
      const res = await fetch("/api/clients");
      const data = await res.json();
      setClient(data || {});
      setVatNumber(data?.vatNumber || "");
    }
    fetchClient();
  }, []);

  // Fetch transactions & VAT lock
  useEffect(() => {
    if (!session?.user) return;

    async function fetchTransactions() {
      const res = await fetch("/api/mtd-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetchTransactions", clientId: session.user.clientId }),
      });
      const { data } = await res.json();
      const rows = (data || []).map(tx => ({
        ...tx,
        amount: toNumber(tx.amount),
        vat_amount: tx.vat_amount != null ? toNumber(tx.vat_amount) : 0,
      }));
      setTransactions(rows);
      generateStats(rows);
    }

    async function checkLock() {
      const res = await fetch("/api/mtd-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkLock", clientId: session.user.clientId }),
      });
      const { locked } = await res.json();
      setLocked(locked);
    }

    fetchTransactions();
    checkLock();
  }, [session]);

  // Generate top stats
  function generateStats(txList) {
    const vatTotal = txList.reduce((a, r) => a + (r.vat_amount || 0), 0);
    const incomeTotal = txList.filter(t => t.category === "income").reduce((a, r) => a + toNumber(r.amount), 0);
    const corpTotal = txList.filter(t => t.category === "corp").reduce((a, r) => a + toNumber(r.amount), 0);
    const cisTotal = txList.filter(t => t.category === "cis").reduce((a, r) => a + toNumber(r.amount), 0);

    const newStats = [
      { label: "VAT Total", value: vatTotal.toFixed(2) },
      { label: "Income Total", value: incomeTotal.toFixed(2) },
      { label: "Corporation Tax Total", value: corpTotal.toFixed(2) },
      { label: "CIS Deducted", value: cisTotal.toFixed(2) },
    ];
    setStats(newStats);
  }

  // HMRC payload generator
  function generateHMRCJson() {
    const income = transactions.filter(t => t.category === "income");
    const corp = transactions.filter(t => t.category === "corp");
    const cis = transactions.filter(t => t.category === "cis");

    return {
      vat: {
        period: vatPeriod,
        vatDue: transactions.reduce((a, r) => a + (r.vat_amount || 0), 0),
      },
      income: { income: income.reduce((a, r) => a + toNumber(r.amount), 0) },
      cis: { deducted: cis.reduce((a, r) => a + toNumber(r.amount), 0) },
      corporationTax: { profit: income.reduce((a, r) => a + toNumber(r.amount), 0) + corp.reduce((a, r) => a + toNumber(r.amount), 0) },
      vatNumber,
      generatedAt: new Date().toISOString(),
    };
  }

  const payload = generateHMRCJson();

  // Totals
  const totalRevenue = useMemo(() => transactions.filter(t => t.category === "income").reduce((sum, t) => sum + toNumber(t.amount), 0), [transactions]);
  const totalVAT = useMemo(() => transactions.reduce((sum, t) => sum + (toNumber(t.vat_amount) || 0), 0), [transactions]);
  const totalCorp = useMemo(() => transactions.filter(t => t.category === "corp").reduce((sum, t) => sum + toNumber(t.amount), 0), [transactions]);
  const totalCIS = useMemo(() => transactions.filter(t => t.category === "cis").reduce((sum, t) => sum + toNumber(t.amount), 0), [transactions]);
  const netProfit = totalRevenue - totalVAT - totalCorp;

  if (status === "loading") return <div>Loading…</div>;
  if (!session?.user) return null;

  return (
    <ResponsiveLayout currentPageName="MTD Dashboard">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">MTD Dashboard</h1>

        {/* Period Selection */}
        <ResponsiveCard title="Period Selection">
          <select value={periodType} onChange={e => setPeriodType(e.target.value)} className="border rounded px-2 py-1">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </ResponsiveCard>

        {/* VAT Number */}
        <ResponsiveCard title="VAT Number">
          <input
            type="text"
            value={vatNumber}
            onChange={e => setVatNumber(e.target.value)}
            className="border p-1 mr-2"
            placeholder="Enter VAT Number"
          />
          <button
            onClick={async () => {
              await fetch("/api/clients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientId: client?.id, vatNumber }),
              });
              alert("VAT number saved");
            }}
            className="bg-green-600 text-white px-3 py-1 rounded"
          >
            Save VAT Number
          </button>
        </ResponsiveCard>

        {/* Top Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {stats.map(s => (
            <ResponsiveCard key={s.label}>
              <div className="text-slate-500">{s.label}</div>
              <div className="text-2xl font-bold">£{s.value}</div>
            </ResponsiveCard>
          ))}
        </div>

        {/* Transactions Table */}
        <ResponsiveCard title="Transactions">
          <ResponsiveTable headers={["Date", "Desc", "Amount", "VAT", "Category", "CIS"]}>
            {transactions.map(tx => (
              <tr key={tx.id}>
                <td>{tx.date}</td>
                <td>{tx.description}</td>
                <td>£{toNumber(tx.amount).toFixed(2)}</td>
                <td>{tx.vat_rate ? `${tx.vat_rate}% (£${(tx.vat_amount || 0).toFixed(2)})` : "-"}</td>
                <td>{tx.category?.toUpperCase() || "Other"}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={tx.category === "cis"}
                    onChange={e => {
                      const updatedTx = transactions.map(t =>
                        t.id === tx.id ? { ...t, category: e.target.checked ? "cis" : t.category } : t
                      );
                      setTransactions(updatedTx);
                      generateStats(updatedTx);
                    }}
                  />
                </td>
              </tr>
            ))}
            {/* Footer row with subtotals */}
            <tr className="font-bold bg-gray-50">
              <td colSpan={2}>Totals</td>
              <td>£{(totalRevenue + totalCorp + totalCIS).toFixed(2)}</td>
              <td>£{totalVAT.toFixed(2)}</td>
              <td>
                Income £{totalRevenue.toFixed(2)} | Corp £{totalCorp.toFixed(2)} | CIS £{totalCIS.toFixed(2)} | Net £{netProfit.toFixed(2)}
              </td>
            </tr>
          </ResponsiveTable>

          {/* Totals summary */}
          <div className="mt-4 flex flex-wrap justify-end gap-6 text-right">
            <div>Total Income: £{totalRevenue.toFixed(2)}</div>
            <div>Total VAT: £{totalVAT.toFixed(2)}</div>
            <div>Total Corp: £{totalCorp.toFixed(2)}</div>
            <div>Total CIS: £{totalCIS.toFixed(2)}</div>
            <div>Net Profit: £{netProfit.toFixed(2)}</div>
          </div>
        </ResponsiveCard>

        {/* Submit to HMRC */}
        <ResponsiveCard title="Submit to HMRC">
          <div className="flex gap-3 flex-wrap">
            {["vat","income","corp","cis"].map(c => (
              <button
                key={c}
                onClick={async () => {
                  const key = `${client?.id}-${c}-${vatPeriod}`;
                  setStatusMap(prev => ({ ...prev, [c]: "Submitting..." }));
                  const res = await fetch("/api/submit-mtd", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ clientId: client?.id, category: c, payload, period: vatPeriod, idempotencyKey: key }),
                  });
                  const data = await res.json();
                  setStatusMap(prev => ({ ...prev, [c]: data.success ? "Success" : "Failed" }));
                  if (c === "vat" && data.success) setLocked(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded"
              >
                Submit {c.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="mt-4">
            {Object.entries(statusMap).map(([k,v]) => (
              <p key={k}>{k.toUpperCase()}: {v}</p>
            ))}
          </div>
        </ResponsiveCard>

        {/* Payload Preview */}
        <ResponsiveCard title="HMRC Payload">
          <pre className="text-xs bg-gray-100 p-4 overflow-x-auto">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </ResponsiveCard>
      </div>
    </ResponsiveLayout>
  );
}
