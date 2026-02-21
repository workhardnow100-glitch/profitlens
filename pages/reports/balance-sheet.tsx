// pages/reports/balance-sheet.tsx
import { useEffect, useState } from "react";

type BSLine = {
  id?: string;
  label: string;
  amount: number;
  isCustom?: boolean;
};

type BSSection = {
  current: BSLine[];
  non_current: BSLine[];
};

type BSData = {
  assets: BSSection;
  liabilities: BSSection;
  equity: BSLine[];
  totals: {
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
    total_liabilities_and_equity: number;
  };
};

export default function BalanceSheetPage() {
  const [yearCurrent, setYearCurrent] = useState<number | undefined>(undefined);
  const [yearCompare, setYearCompare] = useState<number | undefined>(undefined);
  const [dataCurrent, setDataCurrent] = useState<BSData | null>(null);
  const [dataCompare, setDataCompare] = useState<BSData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingLine, setEditingLine] = useState<BSLine | null>(null);
  const [editingMeta, setEditingMeta] = useState<{
    section: "assets" | "liabilities" | "equity";
    subsection?: "current" | "non_current";
    index: number;
    isCompare: boolean;
  } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLine, setNewLine] = useState({
    section: "assets",
    subsection: "non_current",
    label: "",
    amount: 0,
    year: undefined as number | undefined,
  });

  useEffect(() => {
    load();
  }, [yearCurrent, yearCompare]);

  async function load() {
    setLoading(true);

    const [curRes, compRes] = await Promise.all([
      fetch(
        `/api/reports/balance-sheet${
          yearCurrent ? `?year=${yearCurrent}` : ""
        }`
      ),
      yearCompare
        ? fetch(`/api/reports/balance-sheet?year=${yearCompare}`)
        : Promise.resolve(null),
    ]);

    const curJson = await curRes.json();
    setDataCurrent(curJson);

    if (compRes) {
      const compJson = await compRes.json();
      setDataCompare(compJson);
    } else {
      setDataCompare(null);
    }

    setLoading(false);
  }

  function startEdit(
    line: BSLine,
    section: "assets" | "liabilities" | "equity",
    subsection: "current" | "non_current" | undefined,
    index: number,
    isCompare: boolean
  ) {
    if (!line.isCustom) return; // only custom lines editable
    setEditingLine({ ...line });
    setEditingMeta({ section, subsection, index, isCompare });
  }

  async function saveEdit() {
    if (!editingLine || !editingMeta) return;
    if (!editingLine.id) return;

    await fetch("/api/reports/balance-sheet/custom-line", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingLine.id,
        section: editingMeta.section,
        subsection: editingMeta.subsection,
        label: editingLine.label,
        amount: editingLine.amount,
        sort_order: undefined, // keep existing
      }),
    });

    setEditingLine(null);
    setEditingMeta(null);
    load();
  }

  async function deleteLine(line: BSLine) {
    if (!line.id) return;
    await fetch("/api/reports/balance-sheet/custom-line", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: line.id }),
    });
    load();
  }

  async function moveLine(
    section: "assets" | "liabilities" | "equity",
    subsection: "current" | "non_current" | undefined,
    index: number,
    direction: "up" | "down"
  ) {
    if (!dataCurrent) return;

    const sectionData =
      section === "equity"
        ? [...dataCurrent.equity]
        : [...dataCurrent[section][subsection!]];

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sectionData.length) return;

    const temp = sectionData[index];
    sectionData[index] = sectionData[newIndex];
    sectionData[newIndex] = temp;

    // persist sort_order for custom lines only
    const updates = sectionData
      .filter((l) => l.isCustom && l.id)
      .map((l, i) =>
        fetch("/api/reports/balance-sheet/custom-line", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: l.id,
            section,
            subsection,
            label: l.label,
            amount: l.amount,
            sort_order: i,
          }),
        })
      );

    await Promise.all(updates);
    load();
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
      year: yearCurrent,
    });

    load();
  }

  function exportPDF() {
    window.print();
  }

  if (loading || !dataCurrent) {
    return <div className="p-6">Loading balance sheet…</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto print:p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Balance Sheet</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            Add Line
          </button>
          <button
            onClick={exportPDF}
            className="px-4 py-2 bg-gray-700 text-white rounded"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="flex gap-6 mb-6">
        <div>
          <label className="block text-sm mb-1">Current Year</label>
          <input
            type="number"
            className="border p-2 w-32"
            value={yearCurrent || ""}
            onChange={(e) =>
              setYearCurrent(
                e.target.value ? Number(e.target.value) : undefined
              )
            }
            placeholder="e.g. 2025"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Comparative Year</label>
          <input
            type="number"
            className="border p-2 w-32"
            value={yearCompare || ""}
            onChange={(e) =>
              setYearCompare(
                e.target.value ? Number(e.target.value) : undefined
              )
            }
            placeholder="e.g. 2024"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <BalanceSheetColumn
          title={yearCurrent ? `Year ${yearCurrent}` : "Current"}
          data={dataCurrent}
          isCompare={false}
          onEdit={startEdit}
          onDelete={deleteLine}
          onMove={moveLine}
          editingLine={editingLine}
          editingMeta={editingMeta}
          setEditingLine={setEditingLine}
          saveEdit={saveEdit}
        />

        {dataCompare && (
          <BalanceSheetColumn
            title={yearCompare ? `Year ${yearCompare}` : "Comparative"}
            data={dataCompare}
            isCompare={true}
            onEdit={startEdit}
            onDelete={deleteLine}
            onMove={moveLine}
            editingLine={editingLine}
            editingMeta={editingMeta}
            setEditingLine={setEditingLine}
            saveEdit={saveEdit}
          />
        )}
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

function BalanceSheetColumn({
  title,
  data,
  isCompare,
  onEdit,
  onDelete,
  onMove,
  editingLine,
  editingMeta,
  setEditingLine,
  saveEdit,
}: any) {
  const { assets, liabilities, equity, totals } = data;

  return (
    <div className="border rounded p-4">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>

      <Section title="Assets">
        <Subsection
          title="Non‑Current Assets"
          rows={assets.non_current}
          section="assets"
          subsection="non_current"
          isCompare={isCompare}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
          editingLine={editingLine}
          editingMeta={editingMeta}
          setEditingLine={setEditingLine}
          saveEdit={saveEdit}
        />
        <Subsection
          title="Current Assets"
          rows={assets.current}
          section="assets"
          subsection="current"
          isCompare={isCompare}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
          editingLine={editingLine}
          editingMeta={editingMeta}
          setEditingLine={setEditingLine}
          saveEdit={saveEdit}
        />
        <TotalRow label="Total Assets" value={totals.total_assets} />
      </Section>

      <Section title="Liabilities">
        <Subsection
          title="Non‑Current Liabilities"
          rows={liabilities.non_current}
          section="liabilities"
          subsection="non_current"
          isCompare={isCompare}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
          editingLine={editingLine}
          editingMeta={editingMeta}
          setEditingLine={setEditingLine}
          saveEdit={saveEdit}
        />
        <Subsection
          title="Current Liabilities"
          rows={liabilities.current}
          section="liabilities"
          subsection="current"
          isCompare={isCompare}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
          editingLine={editingLine}
          editingMeta={editingMeta}
          setEditingLine={setEditingLine}
          saveEdit={saveEdit}
        />
        <TotalRow label="Total Liabilities" value={totals.total_liabilities} />
      </Section>

      <Section title="Equity">
        <Subsection
          title="Equity"
          rows={equity}
          section="equity"
          subsection={undefined}
          isCompare={isCompare}
          onEdit={onEdit}
          onDelete={onDelete}
          onMove={onMove}
          editingLine={editingLine}
          editingMeta={editingMeta}
          setEditingLine={setEditingLine}
          saveEdit={saveEdit}
        />
        <TotalRow label="Total Equity" value={totals.total_equity} />
      </Section>

      <div className="mt-6 p-3 bg-gray-100 rounded">
        <div className="flex justify-between text-sm font-semibold">
          <span>Total Liabilities and Equity</span>
          <span>£{format(totals.total_liabilities_and_equity)}</span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Subsection({
  title,
  rows,
  section,
  subsection,
  isCompare,
  onEdit,
  onDelete,
  onMove,
  editingLine,
  editingMeta,
  setEditingLine,
  saveEdit,
}: any) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="mb-3">
      <h4 className="text-sm font-medium mb-1">{title}</h4>
      <table className="w-full mb-2">
        <tbody>
          {rows.map((row: BSLine, index: number) => {
            const isEditing =
              editingLine &&
              editingMeta &&
              editingMeta.section === section &&
              editingMeta.subsection === subsection &&
              editingMeta.index === index &&
              editingMeta.isCompare === isCompare;

            return (
              <tr key={row.id || `${row.label}-${index}`} className="border-b">
                <td className="py-1 text-gray-700">
                  {isEditing ? (
                    <input
                      className="border p-1 w-full"
                      value={editingLine.label}
                      onChange={(e) =>
                        setEditingLine({
                          ...editingLine,
                          label: e.target.value,
                        })
                      }
                    />
                  ) : (
                    row.label
                  )}
                </td>
                <td className="py-1 text-right font-medium">
                  {isEditing ? (
                    <input
                      type="number"
                      className="border p-1 w-24 text-right"
                      value={editingLine.amount}
                      onChange={(e) =>
                        setEditingLine({
                          ...editingLine,
                          amount: Number(e.target.value),
                        })
                      }
                    />
                  ) : (
                    <>£{format(row.amount)}</>
                  )}
                </td>
                <td className="py-1 pl-2 text-right whitespace-nowrap">
                  {row.isCustom && !isCompare && (
                    <div className="flex gap-1 justify-end">
                      {!isEditing && (
                        <>
                          <button
                            className="text-xs px-1 border rounded"
                            onClick={() =>
                              onMove(section, subsection, index, "up")
                            }
                          >
                            ↑
                          </button>
                          <button
                            className="text-xs px-1 border rounded"
                            onClick={() =>
                              onMove(section, subsection, index, "down")
                            }
                          >
                            ↓
                          </button>
                          <button
                            className="text-xs px-2 border rounded"
                            onClick={() =>
                              onEdit(
                                row,
                                section,
                                subsection,
                                index,
                                isCompare
                              )
                            }
                          >
                            Edit
                          </button>
                          <button
                            className="text-xs px-2 border rounded text-red-600"
                            onClick={() => onDelete(row)}
                          >
                            Del
                          </button>
                        </>
                      )}
                      {isEditing && (
                        <>
                          <button
                            className="text-xs px-2 border rounded bg-green-600 text-white"
                            onClick={saveEdit}
                          >
                            Save
                          </button>
                          <button
                            className="text-xs px-2 border rounded"
                            onClick={() => {
                              setEditingLine(null);
                            }}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TotalRow({ label, value }: any) {
  return (
    <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
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

        <label className="block mb-2 text-sm">Section</label>
        <select
          className="w-full border p-2 mb-3"
          value={newLine.section}
          onChange={(e) => setNewLine({ ...newLine, section: e.target.value })}
        >
          <option value="assets">Assets</option>
          <option value="liabilities">Liabilities</option>
          <option value="equity">Equity</option>
        </select>

        <label className="block mb-2 text-sm">Subsection</label>
        <select
          className="w-full border p-2 mb-3"
          value={newLine.subsection}
          onChange={(e) =>
            setNewLine({ ...newLine, subsection: e.target.value })
          }
          disabled={newLine.section === "equity"}
        >
          <option value="non_current">Non‑Current</option>
          <option value="current">Current</option>
        </select>

        <label className="block mb-2 text-sm">Label</label>
        <input
          className="w-full border p-2 mb-3"
          value={newLine.label}
          onChange={(e) => setNewLine({ ...newLine, label: e.target.value })}
        />

        <label className="block mb-2 text-sm">Amount</label>
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
