import { useEffect, useState } from "react";
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

  const vatPeriod = new Date().toISOString().slice(0, 7);

  // 🔑 Access control
  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.replace("/login");
      return;
    }

    const isAdmin = session.user.role === "admin";
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(session.user.subscriptionStatus);
    if (!(isAdmin || isSubscribedOrTrial)) {
      router.replace("/upgrade");
      return;
    }
  }, [session, status, router]);

  // 🔹 Fetch client info
  useEffect(() => {
    async function fetchClient() {
      const res = await fetch("/api/clients", { // or your existing clients API
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
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
        body: JSON.stringify({ action: "fetchTransactions" }),
      });
      const { data } = await res.json();
      setTransactions(data || []);
    }

    async function checkLock() {
      const res = await fetch("/api/mtd-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkLock" }),
      });
      const { locked } = await res.json();
      setLocked(locked);
    }

    fetchTransactions();
    checkLock();
  }, [session]);

  // 🔹 Update category
  async function handleCategoryChange(row, category) {
    if (locked) return;
    await fetch("/api/mtd-dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateCategory", rowId: row.id, category }),
    });
    setTransactions(prev => prev.map(tx => tx.id === row.id ? { ...tx, category } : tx));
  }

  // 🔹 Update VAT
  async function handleVAT(row, rate) {
    if (locked) return;
    await fetch("/api/mtd-dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "updateVAT", rowId: row.id, vatRate: rate }),
    });
    setTransactions(prev => prev.map(tx => tx.id === row.id ? { ...tx, vat_rate: rate, vat_amount: tx.amount * (rate/100) } : tx));
  }

  // 🔹 Verify CIS
  async function verifyCIS(nino) {
    const res = await fetch("/api/mtd-dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verifyCIS", nino }),
    });
    const data = await res.json();
    setClient(prev => ({ ...prev, cis_registered: data.registered }));
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
        netSales: vat.reduce((a, r) => a + Math.max(r.amount, 0), 0),
        netPurchases: vat.reduce((a, r) => a + Math.abs(Math.min(r.amount, 0)), 0),
        vatDue: vat.reduce((a, r) => a + (r.vat_amount || 0), 0),
      },
      income: { income: income.reduce((a, r) => a + r.amount, 0) },
      cis: { deducted: cis.reduce((a, r) => a + r.amount, 0) },
      corporationTax: { profit: corp.reduce((a, r) => a + r.amount, 0) },
      generatedAt: new Date().toISOString(),
    };
  }

  const payload = generateHMRCJson();
  const categories = ["vat", "income", "corp"];
  if (client?.cis_registered) categories.push("cis");

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

  if (status === "loading") return <div>Loading…</div>;
  if (!session?.user) return null;

  return (
    <ResponsiveLayout currentPageName="MTD Dashboard">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">MTD Dashboard</h1>

        <ResponsiveCard title="CIS Verification">
          <input
            defaultValue={client?.nino || ""}
            onBlur={e => verifyCIS(e.target.value)}
            className="border p-1 mr-2"
          />
          {client?.cis_registered ? "Registered ✅" : "Not Registered ❌"}
        </ResponsiveCard>

        <ResponsiveCard title="Transactions">
          <ResponsiveTable headers={["Date", "Desc", "Amount", "VAT %", "Cat"]}>
            {transactions.map(r => (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>{r.description}</td>
                <td>{r.amount}</td>
                <td>
                  {r.category === "vat" ? (
                    <input type="number" value={r.vat_rate || 0} onChange={e => handleVAT(r, +e.target.value)} className="w-16 border"/>
                  ) : "-"}
                </td>
                <td>
                  <select value={r.category || ""} onChange={e => handleCategoryChange(r, e.target.value)}>
                    <option />
                    {categories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </ResponsiveCard>

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

        <ResponsiveCard title="HMRC Payload">
          <pre className="text-xs bg-gray-100 p-4">{JSON.stringify(payload, null, 2)}</pre>
        </ResponsiveCard>
      </div>
    </ResponsiveLayout>
  );
}
