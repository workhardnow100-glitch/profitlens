// pages/setting/chart-of-accounts.js

// Force SSR
export async function getServerSideProps() {
  return { props: {} };
}

import React, { useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import { useRouter } from "next/router";

import ResponsiveLayout from "../../components/ResponsiveLayout";
import ResponsiveCard from "../../components/ResponsiveCard";
import ResponsiveTable from "../../components/ResponsiveTable";

import { useUser } from "../../hooks/useUser";

const fetcher = (url) => fetch(url).then((res) => res.json());

// Optional: label helpers so the UI looks nicer than raw enum values
const ACCOUNT_TYPE_LABELS = {
  INCOME: "Income",
  EXPENSE: "Expense",
  SYSTEM: "System",
  ASSET: "Asset",
  LIABILITY: "Liability",
  EQUITY: "Equity",
  BANK: "Bank",
  ACCOUNTS_RECEIVABLE: "Accounts Receivable",
  ACCOUNTS_PAYABLE: "Accounts Payable",
  VAT_CONTROL: "VAT Control",
  CONTROL: "Control",
};

const HMRC_BUCKET_LABELS = {
  income: "Income",
  allowable: "Allowable (P&L)",
  disallowable: "Disallowable (P&L)",
  ignore: "Ignore",
  system: "System",
  balance_sheet: "Balance Sheet",
  assets: "Assets",
  liabilities: "Liabilities",
  equity: "Equity",
  vat: "VAT",
  control: "Control",
};

export default function ChartOfAccounts() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useUser();

  const [filterType, setFilterType] = useState("ALL");
  const [filterBucket, setFilterBucket] = useState("ALL");
  const [usedOnly, setUsedOnly] = useState(true);

  // Modal state
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editAccount, setEditAccount] = useState(null);

  // Access guard
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }

    const isAdmin = user.role === "admin";
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
      user.subscriptionStatus
    );

    if (!(isAdmin || isSubscribedOrTrial)) {
      router.replace("/upgrade");
    }
  }, [isLoading, isAuthenticated, user, router]);

  // Fetch accounts
  const { data, error, mutate } = useSWR(
    `/api/chart-of-accounts?usedOnly=${usedOnly}`,
    fetcher
  );

  const accounts = data?.accounts || [];

  // Filters
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const typeMatch =
        filterType === "ALL" || acc.account_type === filterType;

      const bucketMatch =
        filterBucket === "ALL" || acc.hmrc_bucket === filterBucket;

      return typeMatch && bucketMatch;
    });
  }, [accounts, filterType, filterBucket]);

  // Generate CoA
  async function handleGenerate() {
    const res = await fetch("/api/chart-of-accounts", {
      method: "POST",
    });

    if (res.ok) {
      await mutate();
    } else {
      console.error("Failed to generate CoA");
    }
  }

  // Export CoA
  async function handleExport() {
    const res = await fetch("/api/chart-of-accounts/export", {
      method: "POST",
    });

    if (!res.ok) {
      console.error("Export failed");
      return;
    }

    const { url } = await res.json();
    if (url) {
      window.open(url, "_blank");
    }
  }

  // Delete account
  async function handleDelete(id) {
    if (!confirm("Are you sure you want to delete this account?")) return;

    const res = await fetch("/api/chart-of-accounts/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete",
        payload: { id },
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      alert(json.error || "Failed to delete account");
      return;
    }

    mutate();
  }

  if (isLoading || !isAuthenticated || !user) {
    return (
      <ResponsiveLayout>
        <div className="p-8">
          <p className="text-slate-500">Loading chart of accounts…</p>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="p-8">
        <h2 className="text-2xl font-bold text-slate-800">
          Chart of Accounts
        </h2>
        <p className="text-slate-600 mt-2 max-w-2xl">
          Your accounting structure. These accounts classify transactions,
          journals, and feed your tax working papers and balance sheet.
        </p>

        {/* Action buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Add Account
          </button>

          <button
            onClick={handleGenerate}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Regenerate CoA
          </button>

          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Export to Excel
          </button>
        </div>

        {/* Used Only toggle */}
        <div className="mt-6 flex items-center gap-2">
          <input
            type="checkbox"
            checked={usedOnly}
            onChange={(e) => setUsedOnly(e.target.checked)}
          />
          <label className="text-sm text-slate-700">
            Show only used accounts
          </label>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              Account Type
            </label>
            <select
              className="border p-2 rounded text-sm"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
              <option value="ASSET">Asset</option>
              <option value="LIABILITY">Liability</option>
              <option value="EQUITY">Equity</option>
              <option value="BANK">Bank</option>
              <option value="ACCOUNTS_RECEIVABLE">Accounts Receivable</option>
              <option value="ACCOUNTS_PAYABLE">Accounts Payable</option>
              <option value="VAT_CONTROL">VAT Control</option>
              <option value="CONTROL">Control</option>
              <option value="SYSTEM">System</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">
              HMRC Bucket
            </label>
            <select
              className="border p-2 rounded text-sm"
              value={filterBucket}
              onChange={(e) => setFilterBucket(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="income">Income (P&L)</option>
              <option value="allowable">Allowable (P&L)</option>
              <option value="disallowable">Disallowable (P&L)</option>
              <option value="ignore">Ignore</option>
              <option value="balance_sheet">Balance Sheet</option>
              <option value="assets">Assets</option>
              <option value="liabilities">Liabilities</option>
              <option value="equity">Equity</option>
              <option value="vat">VAT</option>
              <option value="control">Control</option>
              <option value="system">System</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <ResponsiveCard title="Accounts">
          <ResponsiveTable
            headers={[
              "Code",
              "Name",
              "Type",
              "HMRC Bucket",
              "Description",
              "System",
              "Used",
              "Actions",
            ]}
          >
            {error && (
              <tr>
                <td colSpan={8} className="px-4 py-2 text-red-500">
                  Failed to load chart of accounts
                </td>
              </tr>
            )}

            {!data && !error && (
              <tr>
                <td colSpan={8} className="px-4 py-2 text-slate-500">
                  Loading accounts...
                </td>
              </tr>
            )}

            {data && filteredAccounts.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-2 text-slate-500">
                  No accounts match your filters.
                </td>
              </tr>
            )}

            {filteredAccounts.map((acc) => (
              <tr key={acc.id} className="border-t">
                <td>{acc.account_code}</td>
                <td>{acc.account_name}</td>
                <td>
                  {ACCOUNT_TYPE_LABELS[acc.account_type] ||
                    acc.account_type ||
                    "—"}
                </td>
                <td>
                  {HMRC_BUCKET_LABELS[acc.hmrc_bucket] ||
                    acc.hmrc_bucket ||
                    "—"}
                </td>
                <td>{acc.description || "—"}</td>
                <td>
                  {acc.is_system ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      System
                    </span>
                  ) : (
                    "No"
                  )}
                </td>
                <td>
                  {acc.has_activity ? (
                    <span className="text-green-600 font-medium">Yes</span>
                  ) : (
                    <span className="text-slate-400">No</span>
                  )}
                </td>
                <td className="space-x-3">
                  <button
                    className="text-blue-600 underline text-sm"
                    onClick={() => {
                      setEditAccount(acc);
                      setShowEdit(true);
                    }}
                  >
                    Edit
                  </button>

                  {!acc.is_system && !acc.has_activity && (
                    <button
                      className="text-red-600 underline text-sm"
                      onClick={() => handleDelete(acc.id)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </ResponsiveCard>

        {/* Disclaimer */}
        <p className="text-xs text-slate-500 mt-8 text-center max-w-2xl mx-auto">
          ProfitLens provides estimates only. Always verify classifications
          and account structures with a qualified accountant.
        </p>
      </div>

      {/* ADD MODAL */}
      {showAdd && (
        <Modal title="Add Account" onClose={() => setShowAdd(false)}>
          <AccountForm
            mode="add"
            onSuccess={() => {
              mutate();
              setShowAdd(false);
            }}
          />
        </Modal>
      )}

      {/* EDIT MODAL */}
      {showEdit && editAccount && (
        <Modal title="Edit Account" onClose={() => setShowEdit(false)}>
          <AccountForm
            mode="edit"
            account={editAccount}
            onSuccess={() => {
              mutate();
              setShowEdit(false);
            }}
          />
        </Modal>
      )}
    </ResponsiveLayout>
  );
}

/* -----------------------------
   Modal Component
------------------------------ */
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {children}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* -----------------------------
   Account Form (Add + Edit)
------------------------------ */
function AccountForm({ mode, account, onSuccess }) {
  const [name, setName] = useState(account?.account_name || "");
  const [type, setType] = useState(account?.account_type || "EXPENSE");
  const [bucket, setBucket] = useState(account?.hmrc_bucket || "allowable");
  const [description, setDescription] = useState(account?.description || "");
  const [loading, setLoading] = useState(false);

  const isSystem = account?.is_system || false;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/chart-of-accounts/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: mode === "add" ? "add" : "update",
        payload: {
          id: account?.id,
          name,
          type,
          bucket,
          description,
        },
      }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      alert(json.error || "Failed to save account");
      return;
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Account Name</label>
        <input
          className="border p-2 rounded w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Account Type</label>
        <select
          className="border p-2 rounded w-full"
          value={type}
          onChange={(e) => setType(e.target.value)}
          disabled={isSystem}
        >
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
          <option value="ASSET">Asset</option>
          <option value="LIABILITY">Liability</option>
          <option value="EQUITY">Equity</option>
          <option value="BANK">Bank</option>
          <option value="ACCOUNTS_RECEIVABLE">Accounts Receivable</option>
          <option value="ACCOUNTS_PAYABLE">Accounts Payable</option>
          <option value="VAT_CONTROL">VAT Control</option>
          <option value="CONTROL">Control</option>
          <option value="SYSTEM">System</option>
        </select>
        {isSystem && (
          <p className="mt-1 text-xs text-slate-500">
            System accounts cannot change type.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">HMRC Bucket</label>
        <select
          className="border p-2 rounded w-full"
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
          disabled={isSystem}
        >
          <option value="income">Income (P&L)</option>
          <option value="allowable">Allowable (P&L)</option>
          <option value="disallowable">Disallowable (P&L)</option>
          <option value="ignore">Ignore</option>
          <option value="balance_sheet">Balance Sheet</option>
          <option value="assets">Assets</option>
          <option value="liabilities">Liabilities</option>
          <option value="equity">Equity</option>
          <option value="vat">VAT</option>
          <option value="control">Control</option>
          <option value="system">System</option>
        </select>
        {isSystem && (
          <p className="mt-1 text-xs text-slate-500">
            System accounts cannot change HMRC bucket.
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea
          className="border p-2 rounded w-full"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {loading ? "Saving…" : mode === "add" ? "Add Account" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
