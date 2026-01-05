import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  Search,
  ArrowUpCircle,
  ArrowDownCircle,
  X,
  FileText,
  User,
  Calendar,
  PoundSterling,
  Wallet,
} from "lucide-react";

type Transaction = {
  id: string;
  type: "charge" | "payout";
  amount: number; // positive = money in, negative = money out
  currency: string;
  clientName?: string | null;
  clientEmail?: string | null;
  clientAddress?: string | null;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  invoiceStatus?: string | null;
  confidence?: number | null;
  createdAt: string;
  payoutItems?: any[];
  metadata?: Record<string, any>;
};

type Invoice = {
  id: string;
  number: string;
  status: string;
  issueDate?: string;
  dueDate?: string;
  clientName?: string;
  clientEmail?: string;
  clientAddress?: string;
  lineItems?: {
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
  subtotal?: number;
  vat?: number;
  total?: number;
  currency?: string;
  payments?: {
    date: string;
    amount: number;
  }[];
};

type ApiResponse = {
  transactions: Transaction[];
};

export default function TransactionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/payments/transactions");
        const json: ApiResponse | { error?: string } = await res.json();

        if (!res.ok) {
          setError((json as any)?.error || "Failed to load transactions");
          setLoading(false);
          return;
        }

        setTransactions((json as ApiResponse).transactions || []);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Failed to load transactions");
        setLoading(false);
      }
    }

    load();
  }, []);

  const summary = useMemo(() => {
    if (!transactions.length) {
      return {
        count: 0,
        totalIn: 0,
        totalOut: 0,
        payoutTotal: 0,
        matchedCount: 0,
        unmatchedCount: 0,
      };
    }

    let totalIn = 0;
    let totalOut = 0;
    let payoutTotal = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const t of transactions) {
      if (t.type === "payout") {
        payoutTotal += Math.abs(t.amount);
      } else {
        if (t.amount > 0) totalIn += t.amount;
        if (t.amount < 0) totalOut += Math.abs(t.amount);
      }
      if (t.invoiceId) matchedCount++;
      else unmatchedCount++;
    }

    return {
      count: transactions.length,
      totalIn,
      totalOut,
      payoutTotal,
      matchedCount,
      unmatchedCount,
    };
  }, [transactions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;

    const q = search.toLowerCase();

    return transactions.filter((t) => {
      const fields: (string | number | undefined | null)[] = [
        t.id,
        t.type,
        t.clientName,
        t.clientEmail,
        t.clientAddress,
        t.invoiceNumber,
        t.invoiceId,
        t.amount,
        t.currency,
        t.createdAt,
      ];

      if (t.metadata) {
        Object.values(t.metadata).forEach((v) => fields.push(v as any));
      }

      return fields.some(
        (f) => f !== undefined && f !== null && String(f).toLowerCase().includes(q)
      );
    });
  }, [transactions, search]);

  const handleRowClick = (t: Transaction) => {
    if (!t.invoiceId && !t.invoiceNumber) {
      setSelectedInvoice(null);
      return;
    }

    const invoice: Invoice = {
      id: t.invoiceId || "unknown",
      number: t.invoiceNumber || "Unknown",
      status: t.invoiceStatus || "unknown",
      clientName: t.clientName || undefined,
      clientEmail: t.clientEmail || undefined,
      clientAddress: t.clientAddress || undefined,
      currency: t.currency || "GBP",
      total: Math.abs(t.amount),
    };

    setSelectedInvoice(invoice);
  };

  const formatCurrency = (amount: number, currency = "GBP") => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return <div className="p-6">Loading transactions…</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2">
              <PoundSterling size={26} />
              Transactions Ledger
            </h1>
            <p className="text-slate-500">
              Unified view of Stripe charges, fees, payouts, and invoice matches for the active client.
            </p>
          </div>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Entries"
            value={summary.count.toString()}
          />
          <SummaryCard
            label="Money In (Net Charges)"
            value={formatCurrency(summary.totalIn)}
            tone="green"
          />
          <SummaryCard
            label="Money Out (Fees/Refunds)"
            value={formatCurrency(summary.totalOut)}
            tone="red"
          />
          <SummaryCard
            label="Payouts"
            value={formatCurrency(summary.payoutTotal)}
          />
        </div>

        {/* Match summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <SummaryCard
            label="Matched Invoices"
            value={summary.matchedCount.toString()}
          />
          <SummaryCard
            label="Unmatched Transactions"
            value={summary.unmatchedCount.toString()}
          />
        </div>

        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by type, name, email, invoice, amount, date, reference, etc."
              className="w-full pl-9 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Ledger */}
        <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-3 text-left">Type</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Client</th>
                <th className="p-3 text-left">Invoice</th>
                <th className="p-3 text-left">Confidence</th>
                <th className="p-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-4 text-center text-slate-500 text-sm"
                  >
                    No transactions match your search.
                  </td>
                </tr>
              )}

              {filtered.map((t) => {
                const isPayout = t.type === "payout";
                const isCredit = !isPayout && t.amount > 0;
                const directionLabel = isPayout
                  ? "Payout"
                  : isCredit
                  ? "Charge (Net In)"
                  : "Charge (Net Out)";
                const DirectionIcon = isPayout
                  ? Wallet
                  : isCredit
                  ? ArrowUpCircle
                  : ArrowDownCircle;
                const directionColor = isPayout
                  ? "text-slate-700"
                  : isCredit
                  ? "text-emerald-600"
                  : "text-red-600";

                return (
                  <tr
                    key={t.id}
                    className="border-b hover:bg-slate-50 cursor-pointer"
                    onClick={() => handleRowClick(t)}
                  >
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${directionColor}`}
                      >
                        <DirectionIcon size={14} />
                        {directionLabel}
                      </span>
                    </td>
                    <td className="p-3 font-semibold">
                      <span className={directionColor}>
                        {formatCurrency(Math.abs(t.amount), t.currency)}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1">
                          <User size={12} className="text-slate-400" />
                          <span>{t.clientName || "—"}</span>
                        </span>
                        {t.clientEmail && (
                          <span className="text-xs text-slate-500">
                            {t.clientEmail}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      {t.invoiceNumber ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700">
                          <FileText size={12} />
                          {t.invoiceNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      {t.invoiceId ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                          {t.confidence !== undefined && t.confidence !== null
                            ? `${t.confidence}%`
                            : "Matched"}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">
                          Unmatched
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="flex items-center gap-1 text-xs text-slate-600">
                        <Calendar size={12} />
                        {new Date(t.createdAt).toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice side panel */}
      {selectedInvoice && (
        <div className="w-full max-w-md border-l bg-white h-full shadow-xl flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div>
              <div className="text-xs uppercase text-slate-400">
                Invoice Preview
              </div>
              <div className="font-semibold text-slate-800">
                {selectedInvoice.number}
              </div>
            </div>
            <button
              onClick={() => setSelectedInvoice(null)}
              className="p-1 rounded hover:bg-slate-100"
            >
              <X size={16} className="text-slate-500" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4 text-sm">
            <div>
              <div className="text-xs text-slate-400 mb-1">Status</div>
              <div className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-700">
                {selectedInvoice.status}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-1">Client</div>
              <div className="space-y-0.5">
                <div className="font-medium">
                  {selectedInvoice.clientName || "—"}
                </div>
                {selectedInvoice.clientEmail && (
                  <div className="text-slate-500">
                    {selectedInvoice.clientEmail}
                  </div>
                )}
                {selectedInvoice.clientAddress && (
                  <div className="text-slate-500">
                    {selectedInvoice.clientAddress}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-slate-400 mb-1">Issue Date</div>
                <div>
                  {selectedInvoice.issueDate
                    ? new Date(selectedInvoice.issueDate).toLocaleDateString()
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Due Date</div>
                <div>
                  {selectedInvoice.dueDate
                    ? new Date(selectedInvoice.dueDate).toLocaleDateString()
                    : "—"}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-400 mb-1">Total</div>
              <div className="text-lg font-semibold">
                {selectedInvoice.total !== undefined
                  ? formatCurrency(
                      selectedInvoice.total,
                      selectedInvoice.currency || "GBP"
                    )
                  : "—"}
              </div>
            </div>

            {selectedInvoice.lineItems &&
              selectedInvoice.lineItems.length > 0 && (
                <div>
                  <div className="text-xs text-slate-400 mb-1">Line Items</div>
                  <div className="border rounded-md divide-y">
                    {selectedInvoice.lineItems.map((li, idx) => (
                      <div key={idx} className="p-2 flex justify-between">
                        <div>
                          <div className="font-medium">{li.description}</div>
                          <div className="text-xs text-slate-500">
                            Qty {li.quantity}
                          </div>
                        </div>
                        <div className="text-sm font-semibold">
                          {formatCurrency(li.unitPrice * li.quantity)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {selectedInvoice.payments &&
              selectedInvoice.payments.length > 0 && (
                <div>
                  <div className="text-xs text-slate-400 mb-1">
                    Payment History
                  </div>
                  <div className="border rounded-md divide-y">
                    {selectedInvoice.payments.map((p, idx) => (
                      <div key={idx} className="p-2 flex justify-between">
                        <div className="text-xs text-slate-600">
                          {new Date(p.date).toLocaleString()}
                        </div>
                        <div className="text-xs font-semibold text-emerald-700">
                          {formatCurrency(p.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          <div className="p-3 border-t flex justify-end">
            <button
              onClick={() => {
                if (selectedInvoice?.id) {
                  router.push(`/invoices/${selectedInvoice.id}`);
                }
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Open full invoice
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "red";
}) {
  const color =
    tone === "green"
      ? "text-emerald-700"
      : tone === "red"
      ? "text-red-700"
      : "text-slate-800";

  return (
    <div className="border rounded-lg bg-white p-3 shadow-sm">
      <div className="text-xs uppercase text-slate-400 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
