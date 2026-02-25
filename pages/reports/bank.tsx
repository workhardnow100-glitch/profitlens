// pages/reports/bank.tsx
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type BankAccount = {
  account_code: string;
  account_name: string;
  opening_balance: number;
  closing_balance: number;
};

type BankTransaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance_after: number | null;
  category: string | null;
  is_reconciled: boolean;
  is_director_loan: boolean;
  source: "bank" | "ledger" | "both";
};

type BankReportResponse = {
  accounts: BankAccount[];
  transactions: BankTransaction[];
};

export default function BankReportPage() {
  const [data, setData] = useState<BankReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(false);
  const [showDirectorLoanOnly, setShowDirectorLoanOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/reports/bank");
        if (!res.ok) throw new Error("Failed to load bank report");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message ?? "Failed to load bank report");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredTransactions = useMemo(() => {
    if (!data) return [];

    return data.transactions.filter((t) => {
      if (selectedAccount !== "all" && t.id.split(":")[0] !== selectedAccount) {
        // assuming id is `${account_code}:${tx_id}` – adjust if needed
        return false;
      }

      if (showUnmatchedOnly && t.source === "both") return false;
      if (showDirectorLoanOnly && !t.is_director_loan) return false;

      if (dateFrom && t.date < dateFrom) return false;
      if (dateTo && t.date > dateTo) return false;

      return true;
    });
  }, [data, selectedAccount, showUnmatchedOnly, showDirectorLoanOnly, dateFrom, dateTo]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Bank Report</h1>
        <p>Loading bank activity…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Bank Report</h1>
        <p className="text-red-600">Error: {error ?? "Unknown error"}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Bank Report</h1>
        <p className="text-sm text-gray-500">
          Detailed, accountant-grade view of your bank activity, unmatched items, and reconciliation status.
        </p>
        <div className="mt-2 p-3 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-sm">
          <strong>About this report:</strong> This page shows bank transactions alongside their ledger status. 
          Use it to review unmatched items, director loan movements, and reconciliation differences between the bank feed and the ledger.
        </div>
        <Link href="/accounting-overview" className="text-xs text-blue-600 hover:underline">
          ← Back to Accounting Overview
        </Link>
      </header>

      {/* Account summary */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Bank & Cash Summary</h2>
        {data.accounts.length === 0 ? (
          <p className="text-sm text-gray-500">No bank accounts with activity yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.accounts.map((a) => (
              <div
                key={a.account_code}
                className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm text-sm"
              >
                <div className="flex justify-between">
                  <span className="font-semibold">
                    {a.account_code} · {a.account_name}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Opening: {formatCurrency(a.opening_balance)}</span>
                  <span>Closing: {formatCurrency(a.closing_balance)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Filters */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Filters</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col text-sm">
            <label className="text-gray-600 mb-1">Account</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              <option value="all">All accounts</option>
              {data.accounts.map((a) => (
                <option key={a.account_code} value={a.account_code}>
                  {a.account_code} · {a.account_name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col text-sm">
            <label className="text-gray-600 mb-1">From</label>
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          <div className="flex flex-col text-sm">
            <label className="text-gray-600 mb-1">To</label>
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={showUnmatchedOnly}
              onChange={(e) => setShowUnmatchedOnly(e.target.checked)}
            />
            Show unmatched (bank vs ledger) only
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={showDirectorLoanOnly}
              onChange={(e) => setShowDirectorLoanOnly(e.target.checked)}
            />
            Show director loan movements only
          </label>
        </div>
      </section>

      {/* Transactions table */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Bank Transactions</h2>
        {filteredTransactions.length === 0 ? (
          <p className="text-sm text-gray-500">No transactions match the current filters.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600">Date</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600">Description</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600">Amount</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600">Running Balance</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600">Category</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600">Source</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600">Reconciled</th>
                  <th className="px-2 py-2 text-left font-semibold text-gray-600">Director Loan</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100">
                    <td className="px-2 py-1 text-gray-700">{t.date}</td>
                    <td className="px-2 py-1 text-gray-700">{t.description}</td>
                    <td className="px-2 py-1 text-gray-700">
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="px-2 py-1 text-gray-700">
                      {t.balance_after === null ? "-" : formatCurrency(t.balance_after)}
                    </td>
                    <td className="px-2 py-1 text-gray-700">
                      {t.category ?? <span className="text-gray-400 italic">Uncategorised</span>}
                    </td>
                    <td className="px-2 py-1 text-gray-700">
                      {t.source === "both"
                        ? "Bank + Ledger"
                        : t.source === "bank"
                        ? "Bank only"
                        : "Ledger only"}
                    </td>
                    <td className="px-2 py-1 text-gray-700">
                      {t.is_reconciled ? (
                        <span className="text-green-600 font-semibold">Yes</span>
                      ) : (
                        <span className="text-amber-600 font-semibold">No</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-gray-700">
                      {t.is_director_loan ? (
                        <span className="text-purple-700 font-semibold">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function formatCurrency(value: number) {
  return `£${value.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
