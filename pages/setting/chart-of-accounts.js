// pages/settings/chart-of-accounts.js

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

export default function ChartOfAccounts() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useUser();

  const [filterType, setFilterType] = useState("ALL");
  const [filterBucket, setFilterBucket] = useState("ALL");

  // NEW: dynamic CoA toggle
  const [usedOnly, setUsedOnly] = useState(true);

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

  // NEW: fetch with usedOnly flag
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
          Your accounting structure. These accounts classify transactions
          and feed your tax working papers. You can regenerate the CoA at
          any time or export it to Excel.
        </p>

        {/* Action buttons */}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={handleGenerate}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Generate Chart of Accounts
          </button>

          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Export to Excel
          </button>
        </div>

        {/* NEW: Used Only toggle */}
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

        {/* NEW: Add missing accounts (placeholder for now) */}
        {!usedOnly && (
          <button
            className="mt-2 text-blue-600 underline text-sm"
            onClick={() => alert("Coming soon: Add missing accounts")}
          >
            Add all missing accounts
          </button>
        )}

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
              <option value="income">Income</option>
              <option value="allowable">Allowable</option>
              <option value="disallowable">Disallowable</option>
              <option value="ignore">Ignore</option>
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
            ]}
          >
            {error && (
              <tr>
                <td colSpan={7} className="px-4 py-2 text-red-500">
                  Failed to load chart of accounts
                </td>
              </tr>
            )}

            {!data && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-2 text-slate-500">
                  Loading accounts...
                </td>
              </tr>
            )}

            {data && filteredAccounts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-2 text-slate-500">
                  No accounts match your filters.
                </td>
              </tr>
            )}

            {filteredAccounts.map((acc) => (
              <tr key={acc.id} className="border-t">
                <td>{acc.account_code}</td>
                <td>{acc.account_name}</td>
                <td>{acc.account_type}</td>
                <td>{acc.hmrc_bucket}</td>
                <td>{acc.description || "—"}</td>
                <td>{acc.is_system ? "Yes" : "No"}</td>
                <td>
                  {acc.has_activity ? (
                    <span className="text-green-600 font-medium">Yes</span>
                  ) : (
                    <span className="text-slate-400">No</span>
                  )}
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </ResponsiveCard>

        {/* Disclaimer */}
        <p className="text-xs text-slate-500 mt-8 text-center max-w-2xl mx-auto">
          ProfitLens provides estimates only. Always verify classifications
          with a qualified accountant. Nothing displayed here constitutes
          tax, accounting, or legal advice.
        </p>
      </div>
    </ResponsiveLayout>
  );
}
