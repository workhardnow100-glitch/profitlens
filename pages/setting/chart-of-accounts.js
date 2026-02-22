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

  // Mobile guidance
  const [showHelp, setShowHelp] = useState(false);

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
        {/* Grid: left content + right guidance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: main COA content */}
          <div className="lg:col-span-2">
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
                  <option value="ACCOUNTS_RECEIVABLE">
                    Accounts Receivable
                  </option>
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

          {/* RIGHT: guidance panel (desktop) */}
          <aside className="hidden lg:block lg:col-span-1">
            <GuidancePanel />
          </aside>
        </div>
      </div>

      {/* Mobile help button */}
      <button
        className="lg:hidden fixed bottom-4 right-4 z-30 px-4 py-2 rounded-full bg-blue-600 text-white shadow-lg"
        onClick={() => setShowHelp(true)}
      >
        ?
      </button>

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
                Chart of Accounts guidance
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
   Guidance Panel
------------------------------ */
function GuidancePanel({ innerOnly }) {
  const Wrapper = ({ children }) =>
    innerOnly ? (
      <>{children}</>
    ) : (
      <div className="p-6 bg-white border rounded shadow-sm lg:sticky lg:top-6">
        {children}
      </div>
    );

  return (
    <Wrapper>
      <h2 className="text-xl font-semibold mb-4">Chart of Accounts</h2>

      <p className="text-sm text-slate-700 mb-3">
        Your Chart of Accounts (COA) is the backbone of your entire accounting
        system. Every journal, invoice, bank transaction, and report relies on
        the accounts defined here.
      </p>

      <h3 className="font-semibold mt-4 mb-2">What this page is for</h3>
      <p className="text-sm text-slate-700 mb-2">
        This page lets you:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>View all accounts in your ledger.</li>
        <li>Create new accounts.</li>
        <li>Edit existing accounts.</li>
        <li>Regenerate the COA to restore defaults.</li>
        <li>Export the COA to Excel.</li>
        <li>Control how accounts appear in reports.</li>
      </ul>
      <p className="text-sm text-slate-700 mb-3">
        It is one of the most important configuration pages in ProfitLens.
      </p>

      <h3 className="font-semibold mt-4 mb-2">
        How the Chart of Accounts works
      </h3>
      <p className="text-sm text-slate-700 mb-2">
        Each account has:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>Type (Asset, Liability, Equity, Income, Expense, etc.).</li>
        <li>Code (optional but recommended).</li>
        <li>Name.</li>
        <li>System flag (system accounts cannot be deleted).</li>
        <li>Reporting / HMRC bucket for grouping in reports.</li>
      </ul>
      <p className="text-sm text-slate-700 mb-3">
        These determine where the account appears in reports, whether it affects
        P&amp;L or Balance Sheet, and whether it can be posted to directly.
      </p>

      <h3 className="font-semibold mt-4 mb-2">Account types explained</h3>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>
          <strong>Assets</strong> – things the business owns or is owed (cash,
          debtors, equipment, prepayments).
        </li>
        <li>
          <strong>Liabilities</strong> – amounts the business owes (creditors,
          loans, VAT Control).
        </li>
        <li>
          <strong>Equity</strong> – owner value in the business (share capital,
          retained earnings).
        </li>
        <li>
          <strong>Income</strong> – money the business earns (sales, other
          income).
        </li>
        <li>
          <strong>Expenses</strong> – costs of running the business (rent,
          utilities, motor expenses).
        </li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">Creating new accounts</h3>
      <p className="text-sm text-slate-700 mb-2">
        Use <strong>Add Account</strong> when you need:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>A new expense category.</li>
        <li>A new income stream.</li>
        <li>A new loan or finance account.</li>
        <li>A new asset category.</li>
        <li>A new control account for advanced workflows.</li>
      </ul>
      <p className="text-sm text-slate-700 mb-2">
        When creating an account:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>Choose the correct type.</li>
        <li>Give it a clear, descriptive name.</li>
        <li>(Optional) Assign an account code.</li>
        <li>Select the correct reporting / HMRC bucket.</li>
      </ul>
      <p className="text-sm text-slate-700 mb-3">
        Best practice is to use code ranges:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-4">
        <li>1000–1999 Assets</li>
        <li>2000–2999 Liabilities</li>
        <li>3000–3999 Equity</li>
        <li>4000–4999 Income</li>
        <li>5000–9999 Expenses</li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">
        Regenerating the Chart of Accounts
      </h3>
      <p className="text-sm text-slate-700 mb-2">
        Regenerate CoA restores the default ProfitLens structure:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>It does not delete your custom accounts.</li>
        <li>It does not remove any posted journals.</li>
        <li>It recreates missing system accounts.</li>
        <li>It repairs broken or corrupted COA structures.</li>
        <li>It re-aligns reporting categories.</li>
      </ul>
      <p className="text-sm text-slate-700 mb-3">
        Use this if something looks wrong, a system account is missing, or
        you’ve imported data from another system.
      </p>

      <h3 className="font-semibold mt-4 mb-2">Exporting to Excel</h3>
      <p className="text-sm text-slate-700 mb-2">
        Export gives you a full spreadsheet of:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>Account codes and names.</li>
        <li>Types and HMRC buckets.</li>
        <li>System flags.</li>
        <li>Active / used status.</li>
      </ul>
      <p className="text-sm text-slate-700 mb-3">
        This is ideal for accountants, audits, migrations, and year‑end reviews.
      </p>

      <h3 className="font-semibold mt-4 mb-2">
        How the COA affects your reports
      </h3>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>
          <strong>Profit &amp; Loss</strong> – income and expense accounts drive
          your P&amp;L layout and net profit.
        </li>
        <li>
          <strong>Balance Sheet</strong> – assets, liabilities, and equity
          accounts define your financial position.
        </li>
        <li>
          <strong>Trial Balance</strong> – every account appears; debits and
          credits must balance.
        </li>
        <li>
          <strong>VAT / MTD</strong> – VAT Control and related accounts power
          your VAT workings.
        </li>
        <li>
          <strong>Journals</strong> – you can only post to accounts defined
          here; system accounts protect core logic.
        </li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">System accounts</h3>
      <p className="text-sm text-slate-700 mb-2">
        Some accounts are protected because they are essential:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>Retained Earnings.</li>
        <li>VAT Control.</li>
        <li>Bank accounts.</li>
        <li>Debtors / Creditors control.</li>
        <li>Accumulated Depreciation.</li>
        <li>Rounding / system control accounts.</li>
      </ul>
      <p className="text-sm text-slate-700 mb-3">
        You cannot delete these and should not rename them unless you know
        exactly why.
      </p>

      <h3 className="font-semibold mt-4 mb-2">
        When to add or not add accounts
      </h3>
      <p className="text-sm text-slate-700 mb-2">
        Add a new account when:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-2">
        <li>You want clearer reporting.</li>
        <li>You have a new revenue stream.</li>
        <li>You have a new type of expense.</li>
        <li>You take out a new loan.</li>
        <li>You acquire a new asset category.</li>
        <li>Your accountant requests it.</li>
      </ul>
      <p className="text-sm text-slate-700 mb-2">
        Avoid creating accounts when:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-4">
        <li>A suitable one already exists.</li>
        <li>You’re unsure which type it should be.</li>
        <li>You’re trying to fix a posting mistake (use a journal instead).</li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">
        Common mistakes to avoid
      </h3>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-4">
        <li>Creating duplicate or overlapping accounts.</li>
        <li>Using the wrong account type.</li>
        <li>Posting to system accounts incorrectly.</li>
        <li>Renaming key system accounts.</li>
        <li>Deleting accounts that have history.</li>
        <li>Using vague names like “Misc” or “General”.</li>
      </ul>

      <h3 className="font-semibold mt-4 mb-2">The goal</h3>
      <p className="text-sm text-slate-800 mb-2">
        The goal of this page is to maintain a clean, professional,
        accountant‑grade ledger that:
      </p>
      <ul className="list-disc list-inside text-sm text-slate-700 space-y-1 mb-3">
        <li>Makes reporting clear.</li>
        <li>Makes journals easy.</li>
        <li>Makes VAT and MTD accurate.</li>
        <li>Makes year‑end smooth.</li>
        <li>Makes your accountant love working with your data.</li>
      </ul>
      <p className="text-sm text-slate-800">
        This page is the foundation of your entire financial OS.
      </p>
    </Wrapper>
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
