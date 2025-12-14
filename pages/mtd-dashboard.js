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
  const [cisRegistered, setCisRegistered] = useState(false);

  const vatPeriod = new Date().toISOString().slice(0, 7);
  const categories = ["vat", "income", "corp", "cis"];
  const allowedVatRates = [0, 5, 20];

  // Access control
  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    const isAdmin = session?.user?.role === "admin";
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(session?.user?.subscriptionStatus);
    if (!(isAdmin || isSubscribedOrTrial)) {
      router.replace("/upgrade");
    }
  }, [session, status, router]);

  // Fetch client info (uses global /api/clients endpoint returning current client for session)
  useEffect(() => {
    async function fetchClient() {
      try {
        const res = await fetch("/api/clients");
        const data = await res.json();
        setClient(data || {});
        setCisRegistered(Boolean(data?.cis_registered));
      } catch (e) {
        console.error("fetchClient error:", e);
      }
    }
    fetchClient();
  }, []);

  // Fetch transactions & VAT lock
  useEffect(() => {
    const clientId = session?.user?.clientId || client?.id;
    if (!clientId) return;

    async function fetchTransactions() {
      try {
        const res = await fetch("/api/mtd-dashboards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "fetchTransactions", clientId }),
        });
        const json = await res.json();
        if (!res.ok) {
          console.error("Fetch transactions error:", json.error);
          return;
        }
        const rows = json.data || [];
        setTransactions(rows);
        generateStats(rows, cisRegistered);
      } catch (e) {
        console.error("fetchTransactions error:", e);
      }
    }

    async function checkLock() {
      try {
        const res = await fetch("/api/mtd-dashboards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "checkLock", clientId }),
        });
        const json = await res.json();
        if (!res.ok) {
          console.error("Check lock error:", json.error);
          return;
        }
        setLocked(Boolean(json.locked));
      } catch (e) {
        console.error("checkLock error:", e);
      }
    }

    fetchTransactions();
    checkLock();
  }, [session, client?.id, cisRegistered]);

  // Stats
  function generateStats(txList, cisFlag) {
    const vatTotal = txList
      .filter(t => t.category === "vat")
      .reduce((a, r) => a + (Number(r.vat_amount) || 0), 0);

    const incomeTotal = txList
      .filter(t => t.category === "income")
      .reduce((a, r) => a + Number(r.amount || 0), 0);

    const corpTotal = txList
      .filter(t => t.category === "corp")
      .reduce((a, r) => a + Number(r.amount || 0), 0);

    const cisTotal = txList
      .filter(t => t.category === "cis")
      .reduce((a, r) => a + Number(r.amount || 0), 0);

    const newStats = [
      { label: "VAT Total", value: vatTotal.toFixed(2) },
      { label: "Income Total", value: incomeTotal.toFixed(2) },
      { label: "Corporation Tax Total", value: corpTotal.toFixed(2) },
    ];
    if (cisFlag) newStats.push({ label: "CIS Deducted", value: cisTotal.toFixed(2) });

    setStats(newStats);
  }

  // Update category (persist via API, optimistic UI)
  async function handleCategoryChange(rowId, category) {
    if (locked) return;
    const clientId = session?.user?.clientId || client?.id;
    if (!clientId) return;

    const prev = transactions;
    const optimistic = prev.map(tx => (tx.id === rowId ? { ...tx, category } : tx));
    setTransactions(optimistic);
    generateStats(optimistic, cisRegistered);

    try {
      const res = await fetch("/api/mtd-dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateCategory", clientId, rowId, category }),
      });
      const json = await res.json();
      if (!res.ok) {
        console.error("updateCategory error:", json.error);
        setTransactions(prev); // rollback
        generateStats(prev, cisRegistered);
      } else {
        // If moved off VAT, ensure vat fields are cleared in UI to match server logic
        if (category !== "vat") {
          setTransactions(curr =>
            curr.map(tx => (tx.id === rowId ? { ...tx, vat_rate: null, vat_amount: null } : tx))
          );
        }
      }
    } catch (e) {
      console.error("updateCategory exception:", e);
      setTransactions(prev); // rollback
      generateStats(prev, cisRegistered);
    }
  }

  // Update VAT (validate, persist via API, optimistic UI)
  async function handleVAT(rowId, rateInput) {
    if (locked) return;
    const clientId = session?.user?.clientId || client?.id;
    if (!clientId) return;

    const rate = Number(rateInput);
    if (!allowedVatRates.includes(rate)) {
      setStatusMap(p => ({ ...p, vat: "Invalid VAT rate. Use 0, 5, or 20." }));
      return;
    }

    // Read current amount for row to compute optimistic vat_amount
    const row = transactions.find(tx => tx.id === rowId);
    if (!row) return;
    const computedVatAmount = Math.abs(Number(row.amount || 0)) * (rate / 100);

    const prev = transactions;
    const optimistic = prev.map(tx =>
      tx.id === rowId ? { ...tx, category: "vat", vat_rate: rate, vat_amount: Number(computedVatAmount.toFixed(2)) } : tx
    );
    setTransactions(optimistic);
    generateStats(optimistic, cisRegistered);

    try {
      const res = await fetch("/api/mtd-dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateVAT", clientId, rowId, vatRate: rate }),
      });
      const json = await res.json();
      if (!res.ok) {
        console.error("updateVAT error:", json.error);
        setTransactions(prev); // rollback
        generateStats(prev, cisRegistered);
      } else {
        // Sync with server returned vat_amount if provided
        if (typeof json.vat_amount === "number") {
          setTransactions(curr =>
            curr.map(tx => (tx.id === rowId ? { ...tx, vat_amount: json.vat_amount } : tx))
          );
        }
      }
    } catch (e) {
      console.error("updateVAT exception:", e);
      setTransactions(prev); // rollback
      generateStats(prev, cisRegistered);
    }
  }

  // Verify CIS
  async function verifyCIS(nino) {
    const clientId = session?.user?.clientId || client?.id;
    if (!clientId) return;

    try {
      const res = await fetch("/api/mtd-dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verifyCIS", clientId, nino }),
      });
      const json = await res.json();
      if (!res.ok) {
        console.error("verifyCIS error:", json.error);
        return;
      }
      setCisRegistered(Boolean(json.registered));
      generateStats(transactions, Boolean(json.registered));
      setClient(prev => ({ ...prev, cis_registered: Boolean(json.registered) }));
    } catch (e) {
      console.error("verifyCIS exception:", e);
    }
  }

  // HMRC payload
  function generateHMRCJson() {
    const vat = transactions.filter(t => t.category === "vat");
    const income = transactions.filter(t => t.category === "income");
    const corp = transactions.filter(t => t.category === "corp");
    const cis = transactions.filter(t => t.category === "cis");

    return {
      vat: {
        period: vatPeriod,
        netSales: vat.reduce((a, r) => a + Math.max(Number(r.amount || 0), 0), 0),
        netPurchases: vat.reduce((a, r) => a + Math.abs(Math.min(Number(r.amount || 0), 0)), 0),
        vatDue: vat.reduce((a, r) => a + (Number(r.vat_amount) || 0), 0),
      },
      income: { income: income.reduce((a, r) => a + Number(r.amount || 0), 0) },
      cis: { deducted: cis.reduce((a, r) => a + Number(r.amount || 0), 0) },
      corporationTax: { profit: corp.reduce((a, r) => a + Number(r.amount || 0), 0) },
      generatedAt: new Date().toISOString(),
    };
  }

  const payload = generateHMRCJson();

  // Submit to HMRC
  async function submit(category) {
    const clientId = session?.user?.clientId || client?.id;
    if (!clientId) return;
    const key = `${clientId}-${category}-${vatPeriod}`;
    setStatusMap(prev => ({ ...prev, [category]: "Submitting..." }));

    try {
      const res = await fetch("/api/submit-mtd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, category, payload, period: vatPeriod, idempotencyKey: key }),
      });
      const json = await res.json();
      const ok = res.ok && json?.success;
      setStatusMap(prev => ({ ...prev, [category]: ok ? "Success" : "Failed" }));
      if (category === "vat" && ok) setLocked(true);
    } catch (e) {
      console.error("submitMTD error:", e);
      setStatusMap(prev => ({ ...prev, [category]: "Failed" }));
    }
  }

  // Totals
  const totalRevenue = useMemo(
    () => transactions.reduce((sum, t) => sum + (t.category === "income" ? Number(t.amount || 0) : 0), 0),
    [transactions]
  );
  const totalVAT = useMemo(
    () => transactions.reduce((sum, t) => sum + (Number(t.vat_amount) || 0), 0),
    [transactions]
  );
  const totalCorp = useMemo(
    () => transactions.reduce((sum, t) => sum + (t.category === "corp" ? Number(t.amount || 0) : 0), 0),
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
          {cisRegistered ? "Registered ✅" : "Not Registered ❌"}
        </ResponsiveCard>

        {/* Transactions Table */}
        <ResponsiveCard title="Transactions">
          <ResponsiveTable headers={["Date", "Desc", "Amount", "VAT %", "Category"]}>
            {transactions.map(tx => (
              <tr key={tx.id}>
                <td>{tx.date}</td>
                <td>{tx.description}</td>
                <td>£{Number(tx.amount || 0).toFixed(2)}</td>
                <td>
                  {tx.category === "vat" ? (
                    <input
                      type="number"
                      value={tx.vat_rate ?? 0}
                      onChange={e => handleVAT(tx.id, e.target.value)}
                      className="w-20 border rounded px-1 py-0.5 text-center"
                    />
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  <select
                    value={tx.category || ""}
                    onChange={e => handleCategoryChange(tx.id, e.target.value)}
                    className="border rounded px-1 py-0.5 w-full"
                  >
                    <option value="">Select</option>
                    {categories.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
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
            {Object.entries(statusMap).map(([k, v]) => (
              <p key={k}>
                {k.toUpperCase()}: {v}
              </p>
            ))}
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
