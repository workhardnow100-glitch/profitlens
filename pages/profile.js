// pages/profile.js
import React, { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useReactToPrint } from "react-to-print";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [transactions, setTransactions] = useState([]);
  const [hmrcCategories, setHmrcCategories] = useState([]);
  const [account, setAccount] = useState(null);
  const [totalsByType, setTotalsByType] = useState({ sole_trader: {}, limited_company: {} });
  const [soleTraderTotal, setSoleTraderTotal] = useState(0);
  const [companyTotal] = useState(0); // still fetched but not used
  const [byMonth, setByMonth] = useState({});
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpenses: 0, netProfit: 0 });

  const reportRef = useRef();

  // 🔑 Access control
  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    const isAdmin = session.user.role === "admin";
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
      session.user.subscriptionStatus
    );
    if (!(isAdmin || isSubscribedOrTrial)) {
      router.replace("/upgrade");
    }
  }, [session, status, router]);

  // 📊 Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/profile", { credentials: "include" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load profile");

        setTransactions(json.transactions || []);
        setHmrcCategories(json.hmrcCategories || []);
        setAccount(json.account || null);
        setTotalsByType(json.totalsByType || { sole_trader: {}, limited_company: {} });
        setSoleTraderTotal(json.summary?.liabilities?.sole_trader || 0);
        setByMonth(json.byMonth || {});
        setSummary(json.summary || { totalIncome: 0, totalExpenses: 0, netProfit: 0 });
      } catch (err) {
        setError(err.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [session, status, router]);

  const handlePrint = useReactToPrint({
    content: () => reportRef.current,
    documentTitle: "HMRC Profile Report",
  });

  const handleExportCSV = () => {
    const rows = [
      ["Date", "Description", "Category", "Business Type", "Amount", "Account Number", "Sort Code"],
    ];
    transactions.forEach(tx => {
      const cat = hmrcCategories.find(c => c.id === tx.hmrc_category_id);
      rows.push([
        tx.date || "",
        tx.description || "",
        cat?.category_name || "Uncategorised",
        cat?.business_type || "",
        Number(tx.amount || 0).toFixed(2),
        tx.account_number || account?.account_number || "",
        tx.sort_code || account?.sort_code || "",
      ]);
    });
    const csvContent =
      "data:text/csv;charset=utf-8," + rows.map(r => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "hmrc_profile_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (status === "loading" || loading) return <p className="p-8">Loading...</p>;
  if (!session?.user) return null;

  return (
    <ResponsiveLayout>
      <div className="p-8" ref={reportRef}>
        <h2 className="text-2xl font-bold text-slate-800">Your Profile</h2>
        <p className="text-slate-600 mt-2">
          Account details, HMRC categories, and transaction summaries.
        </p>

        {/* Account info */}
        <ResponsiveCard title="Account details">
          <p><span className="font-medium">Account number:</span> {account?.account_number || "—"}</p>
          <p><span className="font-medium">Sort code:</span> {account?.sort_code || "—"}</p>
        </ResponsiveCard>

        {/* Export buttons */}
        <div className="flex gap-4 mt-6">
          <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition">
            Download PDF
          </button>
          <button onClick={handleExportCSV} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition">
            Export CSV
          </button>
        </div>

        {error && <p className="text-red-500 mt-6">Error: {error}</p>}

        {/* Summary */}
        <ResponsiveCard title="Summary">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <div className="border border-slate-200 rounded p-3">
              <p className="text-sm text-slate-600">Total Income</p>
              <p className="text-slate-800 font-semibold">£{Number(summary.totalIncome).toFixed(2)}</p>
            </div>
            <div className="border border-slate-200 rounded p-3">
              <p className="text-sm text-slate-600">Total Expenses</p>
              <p className="text-slate-800 font-semibold">£{Number(summary.totalExpenses).toFixed(2)}</p>
            </div>
            <div className="border border-slate-200 rounded p-3">
              <p className="text-sm text-slate-600">Net Profit</p>
              <p className="text-slate-800 font-semibold">£{Number(summary.netProfit).toFixed(2)}</p>
            </div>
          </div>
        </ResponsiveCard>

        {/* Sole Trader HMRC Block */}
        <ResponsiveCard title="HMRC – Sole Trader">
          <p className="text-slate-600 mt-1">Total Owed: £{soleTraderTotal.toFixed(2)}</p>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {hmrcCategories
              .filter(c => c.business_type === "sole_trader")
              .map(cat => (
                <div key={cat.id} className="border border-slate-200 rounded p-3">
                  <p className="text-sm text-slate-600">{cat.category_name}</p>
                  <p className="text-slate-800 font-semibold">
                    £{(totalsByType.sole_trader[cat.category_name] || 0).toFixed(2)}
                  </p>
                </div>
              ))}
          </div>

          <h4 className="text-md font-semibold mt-6 text-slate-700">Transactions</h4>
          <ResponsiveTable headers={["Date", "Description", "Category", "Amount"]}>
            {transactions
              .filter(tx => {
                const cat = hmrcCategories.find(c => c.id === tx.hmrc_category_id);
                return cat?.business_type === "sole_trader";
              })
              .map(tx => {
                const cat = hmrcCategories.find(c => c.id === tx.hmrc_category_id);
                return (
                  <tr key={tx.id} className="border-t">
                    <td>{tx.date}</td>
                    <td>{tx.description}</td>
                    <td>
                      <select
                        value={cat?.id || ""}
                        onChange={async (e) => {
                          const newCategoryId = e.target.value;
                          try {
                            await fetch("/api/profile", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                transactionId: tx.id,
                                newCategoryId,
                              }),
                            });
                            router.reload();
                          } catch (err) {
                            console.error("Failed to update category", err);
                          }
                        }}
                        className="border rounded px-2 py-1 text-sm"
                      >
                                               <option value="">Uncategorised</option>
                        {hmrcCategories
                          .filter(c => c.business_type === "sole_trader")
                          .map(option => (
                            <option key={option.id} value={option.id}>
                              {option.category_name}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td>£{Number(tx.amount).toFixed(2)}</td>
                  </tr>
                );
              })}
          </ResponsiveTable>
        </ResponsiveCard>

        {/* Monthly breakdown */}
        <ResponsiveCard title="By month">
          <div className="mt-3 space-y-2">
            {Object.entries(byMonth).map(([month, vals]) => (
              <div
                key={month}
                className="border border-slate-200 rounded p-3 flex justify-between"
              >
                <span className="text-sm text-slate-600">{month}</span>
                <span className="text-slate-800 font-semibold">
                  Income £{Number(vals.income).toFixed(2)} | Expenses £{Number(vals.expenses).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </ResponsiveCard>
      </div>
    </ResponsiveLayout>
  );
}

