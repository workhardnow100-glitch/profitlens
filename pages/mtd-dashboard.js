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
  const [totals, setTotals] = useState({ vatDue: 0, income: 0, corp: 0 });
  const [locked, setLocked] = useState(false);
  const [statusMap, setStatusMap] = useState({});

  const vatPeriod = new Date().toISOString().slice(0, 7);

  // 🔐 Access control
  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) return router.replace("/login");

    const allowed =
      session.user.role === "admin" ||
      ["basic", "pro", "trialing"].includes(session.user.subscriptionStatus);

    if (!allowed) router.replace("/upgrade");
  }, [session, status, router]);

  // 📥 Fetch data
  useEffect(() => {
    if (!session?.user) return;

    async function load() {
      const res = await fetch("/api/mtd-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fetchTransactions",
          clientId: session.user.clientId
        })
      });

      const { data, totals } = await res.json();
      setTransactions(data || []);
      setTotals(totals || { vatDue: 0, income: 0, corp: 0 });

      const lockRes = await fetch("/api/mtd-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkLock",
          clientId: session.user.clientId
        })
      });

      const { locked } = await lockRes.json();
      setLocked(locked);
    }

    load();
  }, [session]);

  // 🧮 HMRC payload (now uses API totals)
  const hmrcPayload = {
    vat: {
      period: vatPeriod,
      vatDue: totals.vatDue,
    },
    income: { income: totals.income },
    corporationTax: { profit: totals.corp },
    generatedAt: new Date().toISOString()
  };

  // 🔁 Category change
  async function updateCategory(id, category) {
    if (locked) return;

    await fetch("/api/mtd-dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateCategory",
        clientId: session.user.clientId,
        rowId: id,
        category
      })
    });

    setTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, category } : t))
    );
  }

  // 🚀 Submit VAT
  async function submitVAT() {
    setStatusMap({ vat: "Submitting…" });

    await fetch("/api/mtd-dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "lockVat",
        clientId: session.user.clientId
      })
    });

    setLocked(true);
    setStatusMap({ vat: "Submitted" });
  }

  if (!session?.user) return null;

  return (
    <ResponsiveLayout currentPageName="MTD Dashboard">
      <div className="p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <ResponsiveCard label="VAT Due">£{totals.vatDue.toFixed(2)}</ResponsiveCard>
          <ResponsiveCard label="Income">£{totals.income.toFixed(2)}</ResponsiveCard>
          <ResponsiveCard label="Corp Profit">£{totals.corp.toFixed(2)}</ResponsiveCard>
        </div>

        {/* Transactions */}
        <ResponsiveCard title="Transactions">
          <ResponsiveTable headers={["Date","Description","Amount","VAT","Category"]}>
            {transactions.map(tx => (
              <tr key={tx.id}>
                <td>{tx.date}</td>
                <td className="truncate max-w-md">{tx.description}</td>
                <td className="text-right">£{tx.amount.toFixed(2)}</td>
                <td className="text-right">
                  {tx.category === "vat" ? `£${tx.vat_amount.toFixed(2)}` : "—"}
                </td>
                <td>
                  <select
                    disabled={locked}
                    className="border rounded px-2 py-1"
                    value={tx.category || ""}
                    onChange={e => updateCategory(tx.id, e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="income">Income</option>
                    <option value="vat">VAT</option>
                    <option value="corp">Corp</option>
                  </select>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </ResponsiveCard>

        {/* Submit */}
        <ResponsiveCard title="Submit VAT">
          <button
            disabled={locked}
            onClick={submitVAT}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Submit VAT
          </button>
          {statusMap.vat && <p className="mt-2">{statusMap.vat}</p>}
        </ResponsiveCard>

        {/* Payload */}
        <ResponsiveCard title="HMRC Payload">
          <pre className="text-xs bg-gray-100 p-4">
            {JSON.stringify(hmrcPayload, null, 2)}
          </pre>
        </ResponsiveCard>

      </div>
    </ResponsiveLayout>
  );
}
