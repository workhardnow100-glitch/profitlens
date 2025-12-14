// pages/mtd-dashboard.js
import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";

export default function MTDDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [transactions, setTransactions] = useState([]);
  const [client, setClient] = useState(null);
  const [statusMap, setStatusMap] = useState({});
  const [locked, setLocked] = useState(false);
  const [stats, setStats] = useState([]);

  const vatPeriod = new Date().toISOString().slice(0, 7);
  const categories = ["vat", "income", "corp", "cis"];

  // 🔑 Access control
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

  // 🔹 Fetch client info
  useEffect(() => {
    async function fetchClient() {
      const res = await fetch("/api/clients");
      const data = await res.json();
      setClient(data || {});
    }
    fetchClient();
  }, []);

  // 🔹 Fetch transactions & VAT lock
  useEffect(() => {
    if (!session?.user) return;

    async function fetchTransactions() {
      const res = await fetch("/api/mtd-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fetchTransactions", clientId: session.user.clientId }),
      });
      const { data } = await res.json();
      setTransactions(data || []);
      generateStats(data || []);
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

  // 🔹 Generate top stats
  function generateStats(txList) {
    const vatTotal = txList.filter(t => t.category === "vat").reduce((a,r)=>a+(r.vat_amount||0),0);
    const incomeTotal = txList.filter(t => t.category === "income").reduce((a,r)=>a+r.amount,0);
    const corpTotal = txList.filter(t => t.category === "corp").reduce((a,r)=>a+r.amount,0);
    const cisTotal = txList.filter(t => t.category === "cis").reduce((a,r)=>a+r.amount,0);

    const newStats = [
      { label: "VAT Total", value: vatTotal.toFixed(2) },
      { label: "Income Total", value: incomeTotal.toFixed(2) },
      { label: "Corporation Tax Total", value: corpTotal.toFixed(2) },
    ];

    if (client?.cis_registered) newStats.push({ label: "CIS Deducted", value: cisTotal.toFixed(2) });
    setStats(newStats);
  }

  // 🔹 Update category (local only — matches original)
  function handleCategoryChange(rowId, category) {
    if (locked) return;
    const updatedTx = transactions.map(tx => tx.id === rowId ? { ...tx, category } : tx);
    setTransactions(updatedTx);
    generateStats(updatedTx);
  }

  // 🔹 Update VAT (local only — matches original)
  function handleVAT(rowId, rate) {
    if (locked) return;
    const updatedTx = transactions.map(tx =>
      tx.id === rowId
        ? { ...tx, vat_rate: rate, vat_amount: parseFloat((tx.amount*(rate/100)).toFixed(2)) }
        : tx
    );
    setTransactions(updatedTx);
    generateStats(updatedTx);
  }

  // 🔹 Verify CIS
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

  // 🔹 HMRC payload generator
  function generateHMRCJson() {
    const vat = transactions.filter(t => t.category === "vat");
    const income = transactions.filter(t => t.category === "income");
    const corp = transactions.filter(t => t.category === "corp");
    const cis = transactions.filter(t => t.category === "cis");

    return {
      vat: {
        period: vatPeriod,
        netSales: vat.reduce((a,r)=>a+Math.max(r.amount,0),0),
        netPurchases: vat.reduce((a,r)=>a+Math.abs(Math.min(r.amount,0)),0),
        vatDue: vat.reduce((a,r)=>a+(r.vat_amount||0),0)
      },
      income: { income: income.reduce((a,r)=>a+r.amount,0) },
      cis: { deducted: cis.reduce((a,r)=>a+r.amount,0) },
      corporationTax: { profit: corp.reduce((a,r)=>a+r.amount,0) },
      generatedAt: new Date().toISOString(),
    };
  }

  const payload = generateHMRCJson();

  // 🔹 Submit to HMRC
  async function submit(category) {
    const key = `${client?.id}-${category}-${vatPeriod}`;
    setStatusMap(prev => ({ ...prev, [category]: "Submitting..." }));

    const res = await fetch("/api/submit-mtd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: client?.id, category, payload, period: vatPeriod, idempotencyKey: key }),
    });

    const data = await res.json();
    setStatusMap(prev => ({ ...prev, [category]: data.success ? "Success" : "Failed" }));
    if (category === "vat" && data.success) setLocked(true);
  }

  // 🔹 Totals
  const totalRevenue = useMemo(
    () => transactions.reduce((sum, t) => sum + (t.category==="income"?t.amount:0), 0),
    [transactions]
  );
  const totalVAT = useMemo(
    () => transactions.reduce((sum, t) => sum + (t.vat_amount||0), 0),
    [transactions]
  );
  const totalCorp = useMemo(
    () => transactions.reduce((sum, t) => sum + (t.category==="corp"?t.amount:0), 0),
    [transactions]
  );
  const netProfit = totalRevenue - totalVAT - totalCorp;

  if (status === "loading") return <div>Loading…</div>;
  if (!session?.user) return null;

  return (
    <ResponsiveLayout currentPageName="MTD Dashboard">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">MTD Dashboard</h1>

        {/* Top Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <td>£{tx.amount.toFixed(2)}</td>
                <td>
                  {tx.category==="vat" ? (
                    <input
                      type="number"
                      value={tx.vat_rate || 0}
                      onChange={e => handleVAT(tx.id, +e.target.value)}
                      className="w-20 border rounded px-1 py-0.5 text-center"
                    />
                  ) : "-"}
                </td>
                <td>
                  <select
                    value={tx.category || ""}
                    onChange={e => handleCategoryChange(tx.id, e.target.value)}
                    className="border rounded px-1 py-0.5 w-full"
                  >
                    <option value="">Select</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </ResponsiveTable>

          {/* Totals */}
          <div className="mt-4 flex justify-end gap-6 text-right">
            <div>Total Income: £{totalRevenue.toFixed(2)}</div>
            <div>Total VAT: £{totalVAT.toFixed(2)}</div>
            <div>Total Corp: £{totalCorp.toFixed(2)}</div>
            <div>Net Profit: £{netProfit.toFixed(2)}</div>
          </div>
        </ResponsiveCard>

        {/* Submit to HMRC */}
        <ResponsiveCard title="Submit to HMRC">
          <div className="flex gap-3">
            {categories.map(c => (
              <button key={c} onClick={() => submit(c)} className="bg-blue-600 text-white px-4 py-2 rounded">
                Submit {c.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="mt-4">
            {Object.entries(statusMap).map(([k,v]) => <p key={k}>{k.toUpperCase()}: {v}</p>)}
          </div>
        </ResponsiveCard>

        {/* Payload Preview */}
        <ResponsiveCard title="HMRC Payload">
          <pre className="text-xs bg-gray-100 p-4">{JSON.stringify(payload, null, 2)}</pre>
        </ResponsiveCard>
      </div>
    </ResponsiveLayout>
  );
}