///// page/recurring-invoices/[id]/index.tsx


import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "../../../hooks/useUser";

type FrequencyType = "daily" | "weekly" | "monthly" | "yearly" | "custom";

interface RecurringRecord {
  id: string;
  client_id: string;
  template_line_items: any[];
  template_payment_instructions: string;
  template_notes: string;
  frequency_type: FrequencyType;
  interval: number;
  day_of_week: number | null;
  day_of_month: number | null;
  custom_rule: string | null;
  start_date: string;
  next_run_date: string;
  end_date: string | null;
  active: boolean;
  last_run_date?: string | null;
  processing?: boolean;
}

export default function RecurringInvoiceDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading } = useUser();

  const [record, setRecord] = useState<RecurringRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const [clientId, setClientId] = useState("");
  const [externalClients, setExternalClients] = useState<any[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  const [frequencyType, setFrequencyType] = useState<FrequencyType>("monthly");
  const [interval, setInterval] = useState(1);
  const [dayOfWeek, setDayOfWeek] = useState<number | null>(null);
  const [dayOfMonth, setDayOfMonth] = useState<number | null>(1);
  const [customRule, setCustomRule] = useState("");

  const [startDate, setStartDate] = useState("");
  const [nextRunDate, setNextRunDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [lineItems, setLineItems] = useState<any[]>([]);
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [notesToClient, setNotesToClient] = useState("");
  const [active, setActive] = useState(true);

  // Run Now state
  const [runLoading, setRunLoading] = useState(false);
  const [runResult, setRunResult] = useState<any | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Load clients
 useEffect(() => {
  if (!user) return;
  if (!loadingClients) return;

  (async () => {
    const res = await fetch("/api/external-clients");
    const data = await res.json();
    setExternalClients(data.externalClients || []);
    setLoadingClients(false);
  })();
}, [user, loadingClients]);


// Load schedule
useEffect(() => {
  if (!user) return;
  if (!id || typeof id !== "string") return;

  async function load() {
    const res = await fetch(`/api/recurring-invoices/${id}`);
    const data = await res.json();

    if (!res.ok || !data.recurring) {
      setRecord(null);
      return;
    }

    const r: RecurringRecord = data.recurring;

    setRecord(r);
    setClientId(r.client_id);
    setFrequencyType(r.frequency_type);
    setInterval(r.interval || 1);
    setDayOfWeek(r.day_of_week);
    setDayOfMonth(r.day_of_month);
    setCustomRule(r.custom_rule || "");
    setStartDate(r.start_date?.slice(0, 10) || "");
    setNextRunDate(r.next_run_date?.slice(0, 10) || "");
    setEndDate(r.end_date?.slice(0, 10) || "");

    setLineItems(
      (r.template_line_items || []).map(li => ({
        ...li,
        unit_price: Number.isInteger(li.unit_price)
          ? li.unit_price / 100
          : li.unit_price,
      }))
    );

    setPaymentInstructions(r.template_payment_instructions || "");
    setNotesToClient(r.template_notes || "");
    setActive(r.active);
  }

  load();
}, [id]);   // ⭐ FIXED




  const nextRunPreview = useMemo(
    () => nextRunDate || startDate || "Not set",
    [nextRunDate, startDate]
  );

  const subtotal = lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unit_price,
    0
  );
  const vatTotal = lineItems.reduce(
    (sum, li) => sum + li.quantity * li.unit_price * (li.vat_rate / 100),
    0
  );
  const grossTotal = subtotal + vatTotal;

  const handleLineChange = (idx: number, field: string, value: any) => {
    setLineItems((items) =>
      items.map((li, i) =>
        i === idx
          ? {
              ...li,
              [field]: field === "description" ? value : Number(value),
            }
          : li
      )
    );
  };

  const addLine = () =>
    setLineItems((items) => [
      ...items,
      {
        description: "",
        quantity: 1,
        unit_price: 0,
        vat_rate: 20,
      },
    ]);

  const removeLine = (idx: number) =>
    setLineItems((items) => items.filter((_, i) => i !== idx));

 // Save schedule
const handleSave = async () => {
  if (!record) return;
  if (!clientId) {
    alert("Please select a client");
    return;
  }

  setSaving(true);
  try {
    const res = await fetch(`/api/recurring-invoices/${record.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,

        // ⭐ FIX: convert pounds → pence before saving
        templateLineItems: lineItems.map(li => ({
          ...li,
          unit_price: Math.round(li.unit_price * 100), // £ → pence
        })),

        templatePaymentInstructions: paymentInstructions,
        templateNotes: notesToClient,
        frequencyType,
        interval,
        dayOfWeek,
        dayOfMonth,
        customRule: customRule || null,
        startDate,
        nextRunDate,
        endDate: endDate || null,
        active,
      }),
    });

    if (!res.ok) {
      console.error("Failed to update recurring invoice");
      setSaving(false);
      return;
    }

    router.push("/recurring-invoices");
  } catch (err) {
    console.error(err);
    setSaving(false);
  }
};


  // Cancel schedule
  const handleCancelSchedule = async () => {
    if (!record) return;
    if (!confirm("Cancel this recurring schedule?")) return;

    try {
      const res = await fetch(`/api/recurring-invoices/${record.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        console.error("Failed to cancel recurring invoice");
        return;
      }

      router.push("/recurring-invoices");
    } catch (err) {
      console.error(err);
    }
  };

  // Run Now
  const handleRunNow = async () => {
    if (!record) return;
    setRunLoading(true);
    setRunError(null);
    setRunResult(null);

    try {
      const res = await fetch(`/api/recurring-invoices/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runNow: true }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setRunError(data.error || "Run failed");
        setRunLoading(false);
        return;
      }

      setRunResult(data);

      // Update schedule with new next_run_date
      if (data.schedule) {
        const s = data.schedule;
        setRecord((prev) => (prev ? { ...prev, ...s } : s));
        setNextRunDate(s.next_run_date?.slice(0, 10) || nextRunDate);
      }

      setRunLoading(false);
    } catch (err: any) {
      setRunError(err?.message || "Run failed");
      setRunLoading(false);
    }
  };

  if (loading || loadingClients)
    return <div className="p-6">Loading…</div>;

  if (!record)
    return <div className="p-6 text-red-500">Recurring schedule not found</div>;

  if (!user) return <div className="p-6">Please sign in</div>;

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Recurring Schedule #{record.id.slice(0, 8)}
          </h1>
          <p className="text-sm text-gray-500">
            Adjust the orbit, template, and status of this schedule.
          </p>
          <div className="mt-2 text-xs text-gray-500 space-x-4">
            <span>
              Last run:{" "}
              <span className="font-medium">
                {record.last_run_date
                  ? record.last_run_date.slice(0, 10)
                  : "Never"}
              </span>
            </span>
            <span>
              Next run:{" "}
              <span className="font-medium">
                {record.next_run_date
                  ? record.next_run_date.slice(0, 10)
                  : "Not set"}
              </span>
            </span>
            <span>
              Status:{" "}
              <span className="font-medium">
                {record.active ? "Active" : "Paused"}
              </span>
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCancelSchedule}
            className="rounded-md border border-red-500 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Cancel schedule
          </button>

          <button
            type="button"
            disabled={runLoading}
            onClick={handleRunNow}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {runLoading ? "Running…" : "Run now"}
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Run result panel */}
      {runError && (
        <div className="rounded-md border border-red-500 bg-red-50 p-4 text-sm text-red-700">
          <div className="font-semibold mb-1">Run failed</div>
          <div>{runError}</div>
        </div>
      )}

      {runResult && (
        <div className="rounded-md border border-emerald-500 bg-emerald-50 p-4 text-sm space-y-2">
          <div className="flex justify-between items-center">
            <div className="font-semibold text-emerald-800">
              Run completed successfully
            </div>
            <div className="text-xs text-emerald-700">
              Invoice ID: {runResult.invoice?.id?.slice(0, 8) || "—"}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div>
              <div className="font-medium text-gray-700">Invoice</div>
              <div className="text-gray-600">
                Total:{" "}
                {runResult.invoice?.gross_amount != null
  ? `£${(Number(runResult.invoice.gross_amount) / 100).toFixed(2)}`
  : "—"}

              </div>
              <div className="text-gray-600">
                Status: {runResult.invoice?.status || "—"}
              </div>
            </div>

            <div>
              <div className="font-medium text-gray-700">PDF</div>
              <div className="text-gray-600">
                {runResult.invoice ? "PDF generated and stored" : "No PDF record found"}
              </div>
            </div>

            <div>
              <div className="font-medium text-gray-700">Run log</div>
              <div className="text-gray-600">
                Status: {runResult.runLog?.status || "success"}
              </div>
              <div className="text-gray-600">
                Run at:{" "}
                {runResult.runLog?.run_at
                  ? runResult.runLog.run_at
                  : new Date().toISOString()}
              </div>
            </div>
          </div>

          {runResult.schedule && (
            <div className="text-xs text-gray-600">
              Next run updated to:{" "}
                <span className="font-medium">
                  {runResult.schedule.next_run_date?.slice(0, 10) || "—"}
                </span>
            </div>
          )}
        </div>
      )}

      {/* Main layout */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]">
        {/* Left: Recurrence designer */}
        <div className="space-y-6">
          {/* Recurrence card */}
          <div className="rounded-xl border bg-slate-950 text-slate-50 p-6 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none opacity-40">
              <div className="absolute -top-32 -right-32 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
              <div className="absolute -bottom-32 -left-32 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
            </div>

            <div className="relative flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                    Recurrence orbit
                  </h2>
                  <p className="text-xs text-slate-400">
                    Tune how this schedule moves through time.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Status:</span>
                  <button
                    type="button"
                    onClick={() => setActive((a) => !a)}
                    className={`rounded-full px-3 py-1 border text-[11px] ${
                      active
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                        : "border-slate-600 bg-slate-900 text-slate-300"
                    }`}
                  >
                    {active ? "Active" : "Paused"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-6 items-center">
                {/* Circular dial */}
                <div className="relative h-40 w-40 rounded-full border border-slate-700 bg-slate-900 flex items-center justify-center shadow-inner shadow-slate-900/80">
                  <div className="absolute inset-3 rounded-full bg-slate-950 flex items-center justify-center">
                    <span className="text-xs uppercase tracking-wide text-slate-400">
                      {frequencyType}
                    </span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
                      {(["daily", "weekly", "monthly", "yearly", "custom"] as FrequencyType[]).map(
                        (f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => setFrequencyType(f)}
                            className={`px-2 py-1 rounded-full border text-[10px] ${
                              frequencyType === f
                                ? "border-blue-400 bg-blue-500/20 text-blue-100"
                                : "border-slate-700/70 bg-slate-900/80 text-slate-300 hover:border-slate-500"
                            }`}
                          >
                            {f}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Interval + dates */}
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-200">
                      Interval
                    </label>
                    <div className="flex items-center gap-3 mt-1">
                      <input
                        type="range"
                        min={1}
                        max={12}
                        value={interval}
                        onChange={(e) => setInterval(Number(e.target.value))}
                        className="w-full"
                      />
                      <span className="text-xs text-slate-200 w-10 text-right">
                        x{interval}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Every{" "}
                      {interval}{" "}
                      {frequencyType === "daily"
                        ? "day(s)"
                        : frequencyType === "weekly"
                        ? "week(s)"
                        : frequencyType === "monthly"
                        ? "month(s)"
                        : frequencyType === "yearly"
                        ? "year(s)"
                        : "custom interval"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-200">
                        Start date
                      </label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-200">
                        Next run
                      </label>
                      <input
                        type="date"
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                        value={nextRunDate}
                        onChange={(e) => setNextRunDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-200">
                      End date (optional)
                    </label>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>

                  {frequencyType === "weekly" && (
                    <div>
                      <label className="text-xs font-medium text-slate-200">
                        Day of week
                      </label>
                      <select
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                        value={dayOfWeek ?? ""}
                        onChange={(e) =>
                          setDayOfWeek(
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                      >
                        <option value="">Any</option>
                        <option value={1}>Monday</option>
                        <option value={2}>Tuesday</option>
                        <option value={3}>Wednesday</option>
                        <option value={4}>Thursday</option>
                        <option value={5}>Friday</option>
                        <option value={6}>Saturday</option>
                        <option value={0}>Sunday</option>
                      </select>
                    </div>
                  )}

                  {frequencyType === "monthly" && (
                    <div>
                      <label className="text-xs font-medium text-slate-200">
                        Day of month
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                        value={dayOfMonth ?? ""}
                        onChange={(e) =>
                          setDayOfMonth(
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                  )}

                  {frequencyType === "custom" && (
                    <div>
                      <label className="text-xs font-medium text-slate-200">
                        Custom rule (description)
                      </label>
                      <input
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                        placeholder="e.g. Last business day of each quarter"
                        value={customRule}
                        onChange={(e) => setCustomRule(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Next run preview */}
              <div className="mt-4 rounded-lg border border-slate-700/70 bg-slate-900/80 px-4 py-3 text-xs flex items-center justify-between">
                <div>
                  <div className="text-slate-300 font-medium">
                    Next run projection
                  </div>
                  <div className="text-slate-400">
                    Next invoice will generate on{" "}
                    <span className="text-slate-100">{nextRunPreview}</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500">
                  Actual scheduling is handled by the recurring engine.
                </div>
              </div>
            </div>
          </div>

          {/* Client selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Client</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Select client…</option>
              {externalClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contact_name ||
                    c.business_name ||
                    c.trading_name ||
                    "Unnamed client"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Template builder */}
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold uppercase text-gray-500">
              Invoice template
            </h2>
            <p className="text-xs text-gray-500">
              These line items and instructions are used for each generated invoice.
            </p>
          </div>

          {/* Line items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase text-gray-500">
                Line items
              </h3>
              <button
                type="button"
                className="text-xs text-blue-600 hover:underline"
                onClick={addLine}
              >
                Add line
              </button>
            </div>

            <div className="overflow-hidden rounded-md border">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Unit</th>
                    <th className="px-3 py-2 text-right">VAT %</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lineItems.map((li, idx) => {
                    const lineTotal =
                      li.quantity * li.unit_price * (1 + li.vat_rate / 100);

                    return (
                      <tr key={idx}>
                        <td className="px-3 py-2">
                          <input
                            className="w-full rounded-md border px-2 py-1 text-xs"
                            value={li.description}
                            onChange={(e) =>
                              handleLineChange(idx, "description", e.target.value)
                            }
                            placeholder="Description"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            className="w-16 rounded-md border px-2 py-1 text-xs text-right"
                            value={li.quantity}
                            onChange={(e) =>
                              handleLineChange(idx, "quantity", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            className="w-20 rounded-md border px-2 py-1 text-xs text-right"
                            value={li.unit_price}
                            onChange={(e) =>
                              handleLineChange(idx, "unit_price", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            className="w-16 rounded-md border px-2 py-1 text-xs text-right"
                            value={li.vat_rate}
                            onChange={(e) =>
                              handleLineChange(idx, "vat_rate", e.target.value)
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          £{lineTotal.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {lineItems.length > 1 && (
                            <button
                              type="button"
                              className="text-[11px] text-red-600 hover:underline"
                              onClick={() => removeLine(idx)}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment instructions + notes */}
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment instructions</label>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={3}
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes to client</label>
              <textarea
                className="w-full rounded-md border px-3 py-2 text-sm"
                rows={3}
                value={notesToClient}
                onChange={(e) => setNotesToClient(e.target.value)}
              />
            </div>
          </div>

          {/* Summary + save */}
          <div className="space-y-3">
            <div className="rounded-md border p-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>£{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>VAT</span>
                <span>£{vatTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Per‑invoice total</span>
                <span>£{grossTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Force SSR so static export doesn’t break on API/session usage
export async function getServerSideProps() {
  return { props: {} };
}
