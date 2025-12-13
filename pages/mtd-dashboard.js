import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function MTDDashboard({ clientId }) {
  const [transactions, setTransactions] = useState([]);
  const [client, setClient] = useState(null);
  const [status, setStatus] = useState({});
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  // Current VAT period (YYYY-MM)
  const vatPeriod = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    fetchClient();
    fetchTransactions();
    checkLock();
  }, []);

  async function fetchClient() {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();
    setClient(data);
  }

  async function fetchTransactions() {
    const { data } = await supabase
      .from("transactions")
      .select("*")
      .eq("client_id", clientId)
      .order("date", { ascending: false });
    setTransactions(data || []);
  }

  async function checkLock() {
    // Find VAT period row for this client and month
    const { data } = await supabase
      .from("vat_periods")
      .select("id, locked, submitted")
      .eq("client_id", clientId)
      .eq("period_start", `${vatPeriod}-01`)
      .maybeSingle();

    if (data) {
      setLocked(data.locked || data.submitted);
    }
  }

  async function handleCSVUpload(e) {
    if (locked) return;
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);

    const Papa = await import("papaparse"); // ✅ dynamic import
    Papa.parse(file, {
      header: true,
      complete: async ({ data }) => {
        const rows = data
          .filter((r) => r.amount)
          .map((r) => ({
            client_id: clientId,
            date: r.date,
            description: r.description,
            amount: parseFloat(r.amount),
            vat_rate: null,
            vat_amount: null,
            category: null,
          }));

        await supabase.from("transactions").insert(rows);
        await fetchTransactions();
        setLoading(false);
      },
    });
  }

  async function handleCategoryChange(row, category) {
    if (locked) return;

    const update = { category };
    if (category !== "vat") {
      update.vat_rate = null;
      update.vat_amount = null;
    }

    await supabase.from("transactions").update(update).eq("id", row.id);
    fetchTransactions();
  }

  async function handleVAT(row, rate) {
    if (locked) return;

    await supabase
      .from("transactions")
      .update({
        vat_rate: rate,
        vat_amount: row.amount * (rate / 100),
      })
      .eq("id", row.id);

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
        netSales: vat.reduce((a, r) => a + Math.max(r.amount, 0), 0),
        netPurchases: vat.reduce((a, r) => a + Math.abs(Math.min(r.amount, 0)), 0),
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
      generatedAt: new Date().toISOString(),
    };
  }

  const payload = generateHMRCJson();
  const categories = ["vat", "income", "corp"];
  if (client?.cis_registered) categories.push("cis");

  async function submit(category) {
    const key = `${clientId}-${category}-${vatPeriod}`;

    setStatus((p) => ({ ...p, [category]: "Submitting..." }));

    const res = await fetch("/api/submit-mtd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        category,
        payload,
        period: vatPeriod,
        idempotencyKey: key,
      }),
    });

    const data = await res.json();
    setStatus((p) => ({ ...p, [category]: data.success ? "Success" : "Failed" }));
    if (category === "vat" && data.success) setLocked(true);
  }

  if (loading) return <div>Loading…</div>;

  return (
    <ResponsiveLayout currentPageName="MTD Dashboard">
      <div className="p-6 space-y-6">
        <h1 className="text-3xl font-bold">MTD Dashboard</h1>

        <ResponsiveCard title="CIS Verification">
          <input
            defaultValue={client?.nino || ""}
            onBlur={(e) => verifyCIS(e.target.value)}
            className="border p-1 mr-2"
          />
          {client?.cis_registered ? "Registered ✅" : "Not Registered ❌"}
        </ResponsiveCard>

        <ResponsiveCard title="Upload CSV">
          <input type="file" accept=".csv" disabled={locked} onChange={handleCSVUpload} />
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
                      className="w-16 border"
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
          <div className="flex gap-3">
            {categories.map((c) => (
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
            {Object.entries(status).map(([k, v]) => (
              <p key={k}>
                {k.toUpperCase()}: {v}
              </p>
            ))}
          </div>
        </ResponsiveCard>

        <ResponsiveCard title="HMRC Payload">
          <pre className="text-xs bg-gray-100 p-4">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </ResponsiveCard>
      </div>
    </ResponsiveLayout>
  );
}
