import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";

export default function MTDDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [clientId, setClientId] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [client, setClient] = useState(null);
  const [statusMap, setStatusMap] = useState({});
  const [locked, setLocked] = useState(false);

  const vatPeriod = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.replace("/login");
      return;
    }

    setClientId(session.user.default_client_id);
  }, [session, status, router]);

  useEffect(() => {
    if (!clientId) return;
    fetchClient();
    fetchTransactions();
    checkLock();
  }, [clientId]);

  async function fetchClient() {
    const res = await fetch("/api/mtd-dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fetchClient", clientId }),
    });
    const { data } = await res.json();
    setClient(data);
  }

  async function fetchTransactions() {
    const res = await fetch("/api/mtd-dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "fetchTransactions", clientId }),
    });
    const { data } = await res.json();
    setTransactions(data || []);
  }

  async function checkLock() {
    const res = await fetch("/api/mtd-dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "checkLock", clientId }),
    });
    const { locked } = await res.json();
    setLocked(locked);
  }

  async function handleCategoryChange(row, category) {
    if (locked) return;
    await fetch("/api/mtd-dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateCategory",
        clientId,
        rowId: row.id,
        category,
      }),
    });
    fetchTransactions();
  }

  async function handleVAT(row, rate) {
    if (locked) return;
    await fetch("/api/mtd-dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "updateVAT",
        clientId,
        rowId: row.id,
        vatRate: rate,
      }),
    });
    fetchTransactions();
  }

  async function verifyCIS(nino) {
    const res = await fetch("/api/verify-cis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, nino }),
    });
    const data = await res.json();
    setClient((p) => ({ ...p, cis_registered: data.registered }));
  }

  function generateHMRCJson() {
    const vat = transactions.filter((t) => t.category === "vat");
    const income = transactions.filter((t) => t.category === "income");
    const corp = transactions.filter((t) => t.category === "corp");
    const cis = transactions.filter((t) => t.category === "cis");

    return {
      vat: {
        period: vatPeriod,
        vatDue: vat.reduce((a, r) => a + (r.vat_amount || 0), 0),
      },
      income: {
        income: income.reduce((a, r) => a + r.amount, 0),
      },
      cis: {
        deducted: cis.reduce((a, r) => a + r.amount, 0),
      },
      corporationTax: {
        profit: corp.reduce((a, r) => a + r.amount, 0),
      },
    };
  }

  async function submit(category) {
    const key = `${clientId}-${category}-${vatPeriod}`;
    setStatusMap((p) => ({ ...p, [category]: "Submitting..." }));

    const res = await fetch("/api/submit-mtd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        category,
        payload: generateHMRCJson(),
        period: vatPeriod,
        idempotencyKey: key,
      }),
    });

    const data = await res.json();
    setStatusMap((p) => ({ ...p, [category]: data.success ? "Success" : "Failed" }));
    if (category === "vat" && data.success) setLocked(true);
  }

  if (status === "loading") return <div>Loading…</div>;
  if (!session?.user) return null;

  const categories = ["vat", "income", "corp"];
  if (client?.cis_registered) categories.push("cis");

  return (
    <ResponsiveLayout currentPageName="MTD Dashboard">
      <ResponsiveCard title="CIS Verification">
        <input
          defaultValue={client?.nino || ""}
          onBlur={(e) => verifyCIS(e.target.value)}
        />
        {client?.cis_registered ? "Registered" : "Not Registered"}
      </ResponsiveCard>

      <ResponsiveCard title="Transactions">
        <ResponsiveTable headers={["Date", "Desc", "Amount", "VAT %", "Cat"]}>
          {transactions.map((r) => (
            <tr key={r.id}>
              <td>{r.date}</td>
              <td>{r.description}</td>
              <td>{r.amount}</td>
              <td>
                {r.category === "vat" ? (
                  <input
                    type="number"
                    value={r.vat_rate || 0}
                    onChange={(e) => handleVAT(r, +e.target.value)}
                  />
                ) : "-"}
              </td>
              <td>
                <select
                  value={r.category || ""}
                  onChange={(e) => handleCategoryChange(r, e.target.value)}
                >
                  <option />
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </ResponsiveTable>
      </ResponsiveCard>

      <ResponsiveCard title="Submit to HMRC">
        {categories.map((c) => (
          <button key={c} onClick={() => submit(c)}>
            Submit {c.toUpperCase()}
          </button>
        ))}
      </ResponsiveCard>
    </ResponsiveLayout>
  );
}
