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
function toRate(val) {
  const n = Number(val);
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

  const vatPeriod = new Date().toISOString().slice(0, 7);
  const categories = ["income", "corp", "cis", "other"];
  const allowedVatRates = [0, 5, 20];

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
        vat_rate: tx.vat_rate != null ? toRate(tx.vat_rate) : undefined,
        vat_amount: tx.vat_amount != null ? toNumber(tx.vat_amount) : undefined,
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
    const vatTotal = txList.filter(t => t.category === "vat").reduce((a,r)=>a+(toNumber(r.vat_amount)||0),0);
    const incomeTotal = txList.filter(t => t.category === "income").reduce((a,r)=>a+toNumber(r.amount),0);
    const corpTotal = txList.filter(t => t.category === "corp").reduce((a,r)=>a+toNumber(r.amount),0);
    const cisTotal = txList.filter(t => t.category === "cis").reduce((a,r)=>a+toNumber(r.amount),0);

    const newStats = [
      { label: "VAT Total", value: vatTotal.toFixed(2) },
      { label: "Income Total", value: incomeTotal.toFixed(2) },
      { label: "Corporation Tax Total", value: corpTotal.toFixed(2) },
    ];
    if (client?.cis_registered) newStats.push({ label: "CIS Deducted", value: cisTotal.toFixed(2) });
    setStats(newStats);
  }

  // Update category
  function handleCategoryChange(rowId, category) {
    if (locked) return;
    const updatedTx = transactions.map(tx => tx.id === rowId ? { ...tx, category } : tx);
    setTransactions(updatedTx);
    generateStats(updatedTx);
  }

  // Update VAT
  function handleVAT(rowId, rate) {
    if (locked) return;
    const numericRate = toRate(rate);
    if (!allowedVatRates.includes(numericRate)) {
      alert("Invalid VAT rate. Allowed: 0, 5, 20");
      return;
    }
    const updatedTx = transactions.map(tx => {
      if (tx.id !== rowId) return tx;
      const amt = toNumber(tx.amount);
      const vatAmt = parseFloat((Math.abs(amt) * (numericRate / 100)).toFixed(2));
      return { ...tx, vat_rate: numericRate, vat_amount: vatAmt, category: "vat" };
    });
    setTransactions(updatedTx);
    generateStats(updatedTx);
  }

  // Verify CIS
  async function verifyCIS(nino) {
    const res = await fetch("/api/mtd-dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verifyCIS", clientId: session.user.clientId, nino }),
    });
    const data = await res.json();
    setClient(prev => ({ ...prev, cis_registered: data.registered }));
    generateStats(transactions);
  }

  // HMRC payload generator
  function generateHMRCJson() {
    const vat = transactions.filter(t => t.category === "vat");
    const income = transactions.filter(t => t.category === "income");
    const corp = transactions.filter(t => t.category === "corp");
    const cis = transactions.filter(t => t.category === "cis");

    const netSales = vat.reduce((a,r)=>a+Math.max(toNumber(r.amount),0),0);
    const netPurchases = vat.reduce((a,r)=>a+Math.abs(Math.min(toNumber(r.amount),0)),0);
    const vatDue = vat.reduce((a,r)=>a+(toNumber(r.vat_amount)||0),0);

    return {
      vat: { period: vatPeriod, netSales, netPurchases, vatDue },
      income: { income: income.reduce((a,r)=>a+toNumber(r.amount),0) },
      cis: { deducted: cis.reduce((a,r)=>a+toNumber(r.amount),0) },
      corporationTax: { profit: corp.reduce((a,r)=>a+toNumber(r.amount),0) },
      generatedAt: new Date().toISOString(),
    };
  }

  const payload = generateHMRCJson();

  // Totals
  const totalRevenue = useMemo(() => transactions.filter(t=>t.category==="income").reduce((sum,t)=>sum+toNumber(t.amount),0), [transactions]);
  const totalVAT = useMemo(() => transactions.reduce((sum,t)=>sum+(toNumber(t.vat_amount)||0),0), [transactions]);
  const totalCorp = useMemo(() => transactions.filter(t=>t.category==="corp").reduce((sum,t)=>sum+toNumber(t.amount),0), [transactions]);
  const totalCIS = useMemo(() => transactions.filter(t=>t.category==="cis").reduce((sum,t)=>sum+toNumber(t.amount),0), [transactions]);
  const netProfit = totalRevenue - totalVAT - totalCorp;

  if (status === "loading") return <div>Loading…</div>;
  if (!session?.user) return null;

  return (
    <ResponsiveLayout currentPageName="MTD Dashboard">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">MTD Dashboard</h1>

        {/* Top Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {stats.map(s => (
            <ResponsiveCard key={s.label}>
              <div className="text-slate-500">{s.label}</div>
              <div className="text-2xl font-bold">£{s.value}</div>
            </ResponsiveCard>
          ))}
        </div>

        {/* CIS Verification */}
        <ResponsiveCard title="CIS Verification">
          <input
            defaultValue={client?.nino || ""}
            onBlur={e => verifyCIS(e.target.value)}
            className="border p-1 mr-2"
          />
                    {client?.cis_registered ? "Registered ✅" : "Not Registered ❌"}
        </ResponsiveCard>

        {/* Transactions Table */}
        <ResponsiveCard title="Transactions">
          <ResponsiveTable headers={["Date", "Desc", "Amount", "VAT %", "Category"]}>
            {transactions.map(tx => (
              <tr key={tx.id}>
                <td>{tx.date}</td>
                <td>{tx.description}</td>
                <td>£{toNumber(tx.amount).toFixed(2)}</td>
                <td>
                  <select
                    value={tx.vat_rate ?? ""}
                    onChange={e => handleVAT(tx.id, e.target.value)}
                    disabled={tx.category !== "vat"}
                    className="border rounded px-1 py-0.5 w-full"
                  >
                    <option value="">-</option>
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="20">20%</option>
                  </select>
                </td>
                <td>
                  <select
                    value={tx.category || ""}
                    onChange={e => handleCategoryChange(tx.id, e.target.value)}
                    className="border rounded px-1 py-0.5 w-full"
                  >
                    <option value="">Select</option>
                    <option value="income">Income</option>
                    <option value="corp">Corporation Tax</option>
                    <option value="cis">CIS</option>
                    <option value="other">Other</option>
                  </select>
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
                onClick={() => submit(c)}
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
