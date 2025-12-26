// pages/clients.js
// ❗ dynamic flag does nothing in pages router, but harmless to keep
export const dynamic = "force-dynamic";

// ❗ THIS is the real fix — forces SSR and disables static generation
export async function getServerSideProps() {
  return { props: {} };
}


import { useState, useMemo } from "react";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [name, setName] = useState("");
  const [revenue, setRevenue] = useState("");
  const [expenses, setExpenses] = useState("");
  const [tag, setTag] = useState("");

  const handleAddClient = () => {
    if (!name || !revenue || !expenses) return;

    const newClient = {
      id: `c_${clients.length + 1}`,
      name,
      revenue: parseFloat(revenue),
      expenses: parseFloat(expenses),
      tag,
    };

    setClients(prev => [...prev, newClient]);

    setName("");
    setRevenue("");
    setExpenses("");
    setTag("");
  };

  const handleClearAll = () => {
    setClients([]);
  };

  const totalRevenue = useMemo(() => clients.reduce((sum, c) => sum + c.revenue, 0), [clients]);
  const totalExpenses = useMemo(() => clients.reduce((sum, c) => sum + c.expenses, 0), [clients]);
  const netProfit = totalRevenue - totalExpenses;

  return (
    <ResponsiveLayout>
      <div className="p-8 space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-slate-900">Manual Clients</h1>
          <div className="flex gap-4">
            <button
              onClick={() => console.log("TODO: Export CSV")}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Export CSV
            </button>
            <button
              onClick={handleClearAll}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Add Client Form */}
        <ResponsiveCard title="Add Client">
          <div className="grid grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-sm text-slate-600">Client name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="border px-3 py-2 rounded w-full"
                placeholder="Acme Co."
              />
            </div>
            <div>
              <label className="text-sm text-slate-600">Revenue in</label>
              <input
                type="number"
                value={revenue}
                onChange={e => setRevenue(e.target.value)}
                className="border px-3 py-2 rounded w-full"
                placeholder="1000.00"
              />
            </div>
            <div>
              <label className="text-sm text-slate-600">Expenses out</label>
              <input
                type="number"
                value={expenses}
                onChange={e => setExpenses(e.target.value)}
                className="border px-3 py-2 rounded w-full"
                placeholder="250.00"
              />
            </div>
            <div>
              <label className="text-sm text-slate-600">Tag (optional)</label>
              <input
                type="text"
                value={tag}
                onChange={e => setTag(e.target.value)}
                className="border px-3 py-2 rounded w-full"
                placeholder="Retainer / One-off / VIP"
              />
            </div>
          </div>
          <button
            onClick={handleAddClient}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Add Client
          </button>
        </ResponsiveCard>

        {/* Client List */}
        {clients.length > 0 && (
          <ResponsiveCard title="Client Entries">
            <ul className="space-y-2">
              {clients.map(c => (
                <li key={c.id} className="border-b pb-2 flex justify-between items-center">
                  <div>
                    <p className="font-medium text-slate-800">{c.name}</p>
                    <p className="text-sm text-slate-500">
                      Revenue: £{c.revenue.toFixed(2)} • Expenses: £{c.expenses.toFixed(2)} • Tag: {c.tag || "—"}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-green-50 text-green-700">
                    Profit: £{(c.revenue - c.expenses).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </ResponsiveCard>
        )}

        {/* Quick Stats */}
        <ResponsiveCard title="Quick Stats">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded shadow border">
              <p className="text-sm text-slate-500">Total revenue</p>
              <p className="text-xl font-bold text-slate-800">£{totalRevenue.toFixed(2)}</p>
            </div>
            <div className="bg-white p-4 rounded shadow border">
              <p className="text-sm text-slate-500">Total expenses</p>
              <p className="text-xl font-bold text-slate-800">£{totalExpenses.toFixed(2)}</p>
            </div>
            <div className="bg-white p-4 rounded shadow border">
              <p className="text-sm text-slate-500">Net profit</p>
              <p className="text-xl font-bold text-slate-800">£{netProfit.toFixed(2)}</p>
            </div>
          </div>
        </ResponsiveCard>
      </div>
    </ResponsiveLayout>
  );
}
