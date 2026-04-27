// pages/reports/balance-sheet.tsx
import { useEffect, useState } from "react";

type BSLine = {
  id?: string;
  label?: string;
  amount?: number;
  // custom line field
  account_code?: string;
  account_name?: string;
  balance?: number;
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
  const [showHelp, setShowHelp] = useState(false);
  const [newLine, setNewLine] = useState({
    section: "assets",
    subsection: "non_current",
    label: "",
    amount: 0,
    year: undefined as number | undefined,
  });

 useEffect(() => {
  if (yearCurrent) {
    load();
  }
}, [yearCurrent]);


  // ⭐ FIXED LOAD FUNCTION — only ONE API call, TS-safe
  async function load() {
    // If no current year selected, do nothing
    if (!yearCurrent) {
      setDataCurrent(null);
      setDataCompare(null);
      return;
    }

    setLoading(true);

    const res = await fetch(`/api/reports/balance-sheet?year=${yearCurrent}`);
    const json = await res.json();

    // current = overview(yearCurrent)
    setDataCurrent(json.current);

    // prior = overviewPrior(yearCurrent)
    setDataCompare(json.prior);

    setLoading(false);
  }



  function startEdit(
    line: BSLine,
    section: "assets" | "liabilities" | "equity",
    subsection: "current" | "non_current" | undefined,
    index: number,
    isCompare: boolean
  ) {
    if (!line.isCustom) return;
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
        sort_order: undefined,
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
    <div className="p-8 max-w-6xl mx-auto print:p-4 relative">
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

      {/* Main layout: left = balance sheet, right = guidance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-4">
        {/* LEFT: existing balance sheet columns */}
        <div className="lg:col-span-2">
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
        title={`Year ${(yearCurrent ?? 0) - 1}`}


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
        </div>

        {/* RIGHT: guidance panel (desktop) */}
        <aside className="hidden lg:block lg:col-span-1">
          <GuidancePanel />
        </aside>
      </div>

      {/* Mobile slide-out guidance panel */}
      {showHelp && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black bg-opacity-40"
            onClick={() => setShowHelp(false)}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-xl p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                How to Complete Your Balance Sheet
              </h2>
              <button
                className="text-sm px-3 py-1 border rounded"
                onClick={() => setShowHelp(false)}
              >
                Close
              </button>
            </div>
            <GuidancePanel innerOnly />
          </div>
        </div>
      )}

      {showAddModal && (
        <AddModal
          newLine={newLine}
          setNewLine={setNewLine}
          onSave={saveNewLine}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Mobile help button */}
      <button
        className="lg:hidden fixed bottom-4 right-4 z-30 px-4 py-2 rounded-full bg-blue-600 text-white shadow-lg"
        onClick={() => setShowHelp(true)}
      >
        ?
      </button>
    </div>
  );
}

function GuidancePanel({ innerOnly }: { innerOnly?: boolean }) {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    innerOnly ? (
      <>{children}</>
    ) : (
      <div className="p-6 bg-white border rounded shadow-sm lg:sticky lg:top-6">
        {children}
      </div>
    );

  return (
    <Wrapper>
      <h2 className="text-xl font-semibold mb-4">
        How to Complete Your Balance Sheet
      </h2>

      <p className="text-sm text-slate-700 mb-3">
        Your balance sheet is a snapshot of what the business{" "}
        <strong>owns</strong>, what it <strong>owes</strong>, and what’s{" "}
        <strong>left for the owners</strong> at a point in time. It must always
        balance:
      </p>

      <p className="text-sm font-medium text-slate-900 mb-4">
        Assets = Liabilities + Equity
      </p>

      <h3 className="font-semibold mt-4 mb-2">What to do on this page</h3>
      <ol className="list-decimal list-inside text-sm text-slate-700 space-y-2 mb-4">
        <li>
          <strong>Set your reporting years</strong>
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>
              Enter the <strong>Current Year</strong> (e.g. 2025).
            </li>
            <li>
              Enter the <strong>Comparative Year</strong> (e.g. 2024).
            </li>
            <li>
              ProfitLens pulls balances up to your chosen year‑end dates.
            </li>
          </ul>
        </li>
        <li>
          <strong>Build your sections and subsections</strong>
          <p className="mt-1">
            The balance sheet is split into three main sections:
          </p>
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>
              <strong>Assets</strong> – what the business owns or is owed.
            </li>
            <li>
              <strong>Liabilities</strong> – what the business owes to others.
            </li>
            <li>
              <strong>Equity</strong> – what belongs to the owners after
              liabilities.
            </li>
          </ul>
          <p className="mt-1">Within each section, you can create subsections:</p>
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>Assets: Current, Non‑Current</li>
            <li>Liabilities: Current, Non‑Current</li>
            <li>Equity: Share Capital, Retained Earnings, Other Reserves</li>
          </ul>
        </li>
        <li>
          <strong>Add lines that match how you talk about the business</strong>
          <p className="mt-1">
            Use <strong>Add Line</strong> to create rows such as:
          </p>
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>Cash at bank</li>
            <li>Trade debtors</li>
            <li>VAT receivable</li>
            <li>Bank loan</li>
            <li>Director’s loan</li>
            <li>Retained earnings</li>
            <li>Accumulated depreciation (negative balance under Non‑Current Assets)</li>
          </ul>
          <p className="mt-1">
            Each line should represent a group of accounts or a single key
            account you want to show separately.
          </p>
        </li>
        <li>
          <strong>Check that the totals make sense</strong>
          <p className="mt-1">
            <strong>Total Assets</strong> should equal{" "}
            <strong>Total Liabilities + Total Equity</strong>.
          </p>
          <p className="mt-1">If they don’t, it usually means:</p>
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>A journal is missing or misposted.</li>
            <li>An account hasn’t been included in the right section.</li>
            <li>
              A balance is sitting in a suspense or uncategorised account.
            </li>
          </ul>
        </li>
      </ol>

      <h3 className="font-semibold mt-4 mb-2">
        How journal entries feed into this balance sheet
      </h3>
      <p className="text-sm text-slate-700 mb-2">
        Every journal hits at least two accounts. When you post a journal, you
        debit one account and credit another. If those accounts are in your{" "}
        <strong>Assets</strong>, <strong>Liabilities</strong>, or{" "}
        <strong>Equity</strong> categories, their balances roll up into the
        totals shown here.
      </p>

      <p className="text-sm font-semibold mt-2 mb-1">Examples</p>
      <ul className="text-sm text-slate-700 space-y-2 mb-4">
        <li>
          <strong>Buy a digger for £20,000 on finance:</strong>
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>Debit Non‑Current Asset – Plant &amp; Machinery £20,000</li>
            <li>Credit Liability – HP/Loan £20,000</li>
          </ul>
          <p className="mt-1">
            → Assets up £20,000, Liabilities up £20,000, and the balance sheet
            still balances.
          </p>
        </li>
        <li>
          <strong>Owner injects £5,000 cash:</strong>
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>Debit Cash at bank £5,000</li>
            <li>Credit Equity – Owner’s capital £5,000</li>
          </ul>
          <p className="mt-1">
            → Assets up £5,000, Equity up £5,000.
          </p>
        </li>
        <li>
          <strong>Pay down £1,000 of a loan from the bank:</strong>
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>Credit Cash at bank £1,000</li>
            <li>Debit Loan liability £1,000</li>
          </ul>
          <p className="mt-1">
            → Assets down £1,000, Liabilities down £1,000.
          </p>
        </li>
        <li>
          <strong>Post £3,000 depreciation on plant &amp; machinery:</strong>
          <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
            <li>Debit Depreciation Expense £3,000</li>
            <li>Credit Accumulated Depreciation £3,000</li>
          </ul>
          <p className="mt-1">
            → Net book value of assets down £3,000, Equity down £3,000 via the
            P&amp;L.
          </p>
        </li>
      </ul>

      <p className="text-sm text-slate-700 mb-4">
        You don’t type the maths here. You post journals in the Journals area.
        This balance sheet then reads those balances and presents them in the
        structure you define on this page.
      </p>

      <h3 className="font-semibold mt-4 mb-2">
        When to edit the balance sheet layout
      </h3>
      <ul className="text-sm text-slate-700 space-y-1 mb-3">
        <li>• When you add new major asset types (vehicles, machinery, property).</li>
        <li>• When you take on new loans or finance that deserve their own line.</li>
        <li>• When you want clearer separation between short‑term and long‑term items.</li>
        <li>• When your accountant asks for specific headings to match statutory accounts.</li>
      </ul>

      <p className="text-sm text-slate-800 mt-2">
        The goal is simple: make this page read like a clean, professional UK
        balance sheet that an accountant could sign off and a non‑accountant
        could understand.
      </p>
    </Wrapper>
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
             <tr key={row.id || `${row.account_code || row.label}-${index}`} className="border-b">
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
      // Unified engine uses account_name; custom lines use label
      row.label || row.account_name
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
      // Unified engine uses balance; custom lines use amount
      <>£{format(row.amount ?? row.balance ?? 0)}</>
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
  // Quick templates including depreciation
  const templates = (() => {
    if (newLine.section === "assets" && newLine.subsection === "non_current") {
      return [
        "",
        "Property, plant and equipment",
        "Motor vehicles",
        "Computer equipment",
        "Accumulated depreciation",
        "Net book value of fixed assets",
      ];
    }
    if (newLine.section === "assets" && newLine.subsection === "current") {
      return [
        "",
        "Cash at bank",
        "Trade debtors",
        "VAT receivable",
        "Prepayments",
        "Stock",
      ];
    }
    if (newLine.section === "liabilities" && newLine.subsection === "non_current") {
      return [
        "",
        "Bank loan",
        "HP / finance agreements",
        "Director’s loan (long‑term)",
      ];
    }
    if (newLine.section === "liabilities" && newLine.subsection === "current") {
      return [
        "",
        "Trade creditors",
        "VAT payable",
        "Accruals",
        "Short‑term loans",
      ];
    }
    if (newLine.section === "equity") {
      return [
        "",
        "Share capital",
        "Retained earnings",
        "Other reserves",
        "Depreciation charge (via P&L)",
      ];
    }
    return [""];
  })();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded shadow-lg w-96">
        <h2 className="text-xl font-semibold mb-4">Add Balance Sheet Line</h2>

        <label className="block mb-2 text-sm">Section</label>
        <select
          className="w-full border p-2 mb-3"
          value={newLine.section}
          onChange={(e) =>
            setNewLine({
              ...newLine,
              section: e.target.value,
              // reset subsection sensibly when switching to equity
              subsection:
                e.target.value === "equity"
                  ? undefined
                  : newLine.subsection || "non_current",
            })
          }
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

        <label className="block mb-2 text-sm">Quick template (optional)</label>
        <select
          className="w-full border p-2 mb-3 text-sm"
          value={templates.includes(newLine.label) ? newLine.label : ""}
          onChange={(e) =>
            setNewLine({
              ...newLine,
              label: e.target.value,
            })
          }
        >
          {templates.map((t) => (
            <option key={t || "blank"} value={t}>
              {t === "" ? "— Select a template —" : t}
            </option>
          ))}
        </select>

        <label className="block mb-2 text-sm">Label</label>
        <input
          className="w-full border p-2 mb-3"
          value={newLine.label}
          onChange={(e) => setNewLine({ ...newLine, label: e.target.value })}
          placeholder={
            newLine.section === "assets" &&
            newLine.subsection === "non_current"
              ? "e.g. Accumulated depreciation"
              : "e.g. Cash at bank"
          }
        />

        <label className="block mb-2 text-sm">Amount</label>
        <input
          type="number"
          className="w-full border p-2 mb-4"
          value={newLine.amount}
          onChange={(e) =>
            setNewLine({ ...newLine, amount: Number(e.target.value) })
          }
          placeholder={
            newLine.label.toLowerCase().includes("accumulated depreciation")
              ? "Enter as a negative balance (e.g. -3000)"
              : "e.g. 20000"
          }
        />

        <p className="text-xs text-slate-500 mb-4">
          For <strong>Accumulated depreciation</strong>, enter the balance as a{" "}
          <strong>negative number</strong> so it reduces the net book value of
          your fixed assets.
        </p>

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
