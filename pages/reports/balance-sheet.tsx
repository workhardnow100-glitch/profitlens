import { useEffect, useState } from "react";

export default function BalanceSheetPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLine, setNewLine] = useState({
    section: "assets",
    subsection: "non_current",
    label: "",
    amount: 0,
  });

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/reports/balance-sheet");
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  async function saveNewLine() {
    await fetch("/api/reports/balance-sheet/custom-line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newLine),
    });

    setShowAddModal(false);
    setNewLine({
      section: "assets",
      subsection: "non_current",
      label: "",
      amount: 0,
    });

    load();
  }

  if (loading) return <div className="p-6">Loading balance sheet…</div>;
  if (!data) return <div className="p-6">No data available.</div>;

  const { assets, liabilities, equity, totals } = data;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Balance Sheet</h1>

      <button
        onClick={() => setShowAddModal(true)}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Add Line
      </button>

      <Section title="Assets">
        <Subsection title="Non‑Current Assets" rows={assets.non_current} />
        <Subsection title="Current Assets" rows={assets.current} />
        <TotalRow label="Total Assets" value={totals.total_assets} />
      </Section>

      <Section title="Liabilities">
        <Subsection title="Non‑Current Liabilities" rows={liabilities.non_current} />
        <Subsection title="Current Liabilities" rows={liabilities.current} />
        <TotalRow label="Total Liabilities" value={totals.total_liabilities} />
      </Section>

      <Section title="Equity">
        <Subsection title="Equity" rows={equity} />
        <TotalRow label="Total Equity" value={totals.total_equity} />
      </Section>

      <div className="mt-10 p-4 bg-gray-100 rounded">
        <div className="flex justify-between text-lg font-semibold">
          <span>Total Liabilities and Equity</span>
          <span>£{format(totals.total_liabilities_and_equity)}</span>
        </div>
      </div>

      {showAddModal && (
        <AddModal
          newLine={newLine}
          setNewLine={setNewLine}
          onSave={saveNewLine}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="mb-10">
      <h2 className="text-2xl font-semibold mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Subsection({ title, rows }: any) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="mb-4">
      <h3 className="text-lg font-medium mb-2">{title}</h3>

      <table className="w-full mb-4">
        <tbody>
          {rows.map((row: any, i: number) => (
            <tr key={i} className="border-b">
              <td className="py-2 text-gray-700">{row.label}</td>
              <td className="py-2 text-right font-medium">
                £{format(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TotalRow({ label, value }: any) {
  return (
    <div className="flex justify-between text-lg font-semibold border-t pt-3 mt-3">
      <span>{label}</span>
      <span>£{format(value)}</span>
    </div>
  );
}

function AddModal({ newLine, setNewLine, onSave, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center">
      <div className="bg-white p-6 rounded shadow-lg w-96">
        <h2 className="text-xl font-semibold mb-4">Add Balance Sheet Line</h2>

        <label className="block mb-2">Section</label>
        <select
          className="w-full border p-2 mb-4"
          value={newLine.section}
          onChange={(e) => setNewLine({ ...newLine, section: e.target.value })}
        >
          <option value="assets">Assets</option>
          <option value="liabilities">Liabilities</option>
          <option value="equity">Equity</option>
        </select>

        <label className="block mb-2">Subsection</label>
        <select
          className="w-full border p-2 mb-4"
          value={newLine.subsection}
          onChange={(e) =>
            setNewLine({ ...newLine, subsection: e.target.value })
          }
        >
          <option value="non_current">Non‑Current</option>
          <option value="current">Current</option>
        </select>

        <label className="block mb-2">Label</label>
        <input
          className="w-full border p-2 mb-4"
          value={newLine.label}
          onChange={(e) => setNewLine({ ...newLine, label: e.target.value })}
        />

        <label className="block mb-2">Amount</label>
        <input
          type="number"
          className="w-full border p-2 mb-4"
          value={newLine.amount}
          onChange={(e) =>
            setNewLine({ ...newLine, amount: Number(e.target.value) })
          }
        />

        <div className="flex justify-end gap-2">
          <button className="px-4 py-2" onClick={onClose}>
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded"
            onClick={onSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function format(num: number) {
  return Number(num || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
