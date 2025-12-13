// pages/transactions.js
import React, { useEffect, useState, useMemo } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

import ResponsiveLayout from "../components/ResponsiveLayout";
import ResponsiveCard from "../components/ResponsiveCard";
import ResponsiveTable from "../components/ResponsiveTable";
import ResponsiveHighchart from "../components/ResponsiveHighchart";

// ⬇️ Inference logic (UK-specific categories)
function inferCategory(description = "") {
  const desc = description.toLowerCase();
  if (desc.includes("salary") || desc.includes("payroll") || desc.includes("wages")) return "Salary";
  if (desc.includes("dividend")) return "Dividends";
  if (desc.includes("interest")) return "Interest Income";
  if (desc.includes("rental")) return "Rental Income";
  if (desc.includes("grant")) return "Grant";
  if (desc.includes("refund")) return "Refund";
  if (desc.includes("rebate")) return "Rebate";
  if (desc.includes("pension")) return "Pension";
  if (desc.includes("benefit")) return "Benefits";
  if (desc.includes("loan received") || desc.includes("drafty") || desc.includes("loan disbursement")) return "Loan Received";
  if (desc.includes("hmrc") || desc.includes("tax")) return "Tax Payment";
  if (desc.includes("savethechange")) return "Savings Deposit";
  if (desc.includes("transfer")) return "Transfer Between Accounts";
  if (desc.includes("standing order")) return "Standing Order";
  if (desc.includes("direct debit") || desc.includes("dd")) return "Direct Debit";
  if (desc.includes("returned dd") || desc.includes("rddp")) return "Returned Direct Debit";
  if (desc.includes("jaja") || desc.includes("zable") || desc.includes("credit")) return "Credit Card Payment";
  if (desc.includes("loan repayment") || desc.includes("zopa") || desc.includes("drafty repayment")) return "Loan Repayment";
  if (desc.includes("overdraft")) return "Overdraft Repayment";
  if (desc.includes("car finance") || desc.includes("vehicle loan")) return "Car Loan Repayment";
  if (desc.includes("council") || desc.includes("local authority")) return "Council Tax";
  if (desc.includes("insurance")) return "Insurance Premium";
  if (desc.includes("mortgage")) return "Mortgage";
  if (desc.includes("rent")) return "Rent";
  if (desc.includes("utilities") || desc.includes("gas") || desc.includes("electric") || desc.includes("severn trent")) return "Utilities";
  if (desc.includes("mobile") || desc.includes("vodafone") || desc.includes("o2") || desc.includes("giffgaff") || desc.includes("internet")) return "Mobile & Internet";
  if (desc.includes("amazon") || desc.includes("argos") || desc.includes("shopping")) return "Shopping";
  if (desc.includes("spotify") || desc.includes("netflix") || desc.includes("prime") || desc.includes("disney") || desc.includes("apple")) return "Subscriptions";
  if (desc.includes("tesco") || desc.includes("sainsbury") || desc.includes("aldi") || desc.includes("asda") || desc.includes("lidl")) return "Groceries";
  if (desc.includes("uber") || desc.includes("trainline") || desc.includes("tfl") || desc.includes("stagecoach") || desc.includes("national express")) return "Transport";
  if (desc.includes("fuel") || desc.includes("shell") || desc.includes("bp") || desc.includes("esso")) return "Fuel";
  if (desc.includes("restaurant") || desc.includes("takeaway") || desc.includes("just eat") || desc.includes("deliveroo") || desc.includes("ubereats")) return "Dining & Takeaway";
  if (desc.includes("nhs") || desc.includes("clinic") || desc.includes("dentist") || desc.includes("optical") || desc.includes("boots")) return "Healthcare";
  if (desc.includes("school") || desc.includes("tuition") || desc.includes("course") || desc.includes("exam")) return "Education";
  if (desc.includes("childcare") || desc.includes("nursery") || desc.includes("kids club")) return "Childcare";
  if (desc.includes("charity") || desc.includes("donation")) return "Charity";
  if (desc.includes("gift")) return "Gift";
  if (desc.includes("notemachine") || desc.includes("atm")) return "Cash Withdrawal";
  if (desc.includes("bingo") || desc.includes("casino") || desc.includes("bet")) return "Gambling";
  if (desc.includes("easyjet") || desc.includes("ryanair") || desc.includes("jet2") || desc.includes("airbnb") || desc.includes("booking.com")) return "Travel";
  if (desc.includes("ig.com") || desc.includes("trading") || desc.includes("etoro") || desc.includes("shares")) return "Investment Purchase";
  if (desc.includes("sheehy")) return "Family";
  return "Uncategorised";
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

const HighchartsReact = dynamic(() => import("highcharts-react-official"), { ssr: false });
const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Transactions() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [period, setPeriod] = useState("month");
  const [Highcharts, setHighcharts] = useState(null);
  const [hcReady, setHcReady] = useState(false);

  // 🔑 Access control
  useEffect(() => {
    if (status === "loading") return;
    if (session?.user) {
      const isAdmin = session.user.role === "admin";
      const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(session.user.subscriptionStatus);
      if (!(isAdmin || isSubscribedOrTrial)) router.replace("/upgrade");
    } else {
      router.replace("/login");
    }
  }, [session, status, router]);

  // Highcharts module loading
  useEffect(() => {
    let mounted = true;
    if (typeof window === "undefined") return;

    import("highcharts").then((HC) => {
      const H = HC.default || HC;
      Promise.all([
        import("highcharts/highcharts-3d"),
        import("highcharts/modules/drilldown"),
        import("highcharts/modules/exporting"),
      ]).then(([hc3d, drilldown, exporting]) => {
        if (typeof hc3d === "function") hc3d(H);
        if (typeof drilldown === "function") drilldown(H);
        if (typeof exporting === "function") exporting(H);
        if (mounted) {
          setHighcharts(H);
          setHcReady(true);
        }
      });
    });

    return () => { mounted = false; };
  }, []);

  const { data, error } = useSWR("/api/transactions", fetcher);

  // ⬇️ Filtered transactions (FIXED)
  const filtered = useMemo(() => {
    if (!data?.transactions) return [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return data.transactions.filter((tx) => {
      const date = safeDate(tx.date);
      if (!date) return false;

      const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      if (period === "week") {
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);
        return d >= weekAgo && d <= today;
      }

      if (period === "month") {
        return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
      }

      if (period === "quarter") {
        const currentQuarter = Math.floor(today.getMonth() / 3);
        return Math.floor(d.getMonth() / 3) === currentQuarter && d.getFullYear() === today.getFullYear();
      }

      if (period === "year") return d.getFullYear() === today.getFullYear();

      if (period === "last7") {
        const start = new Date(today);
        start.setDate(today.getDate() - 6);
        return d >= start && d <= today;
      }

      if (period === "last30") {
        const start = new Date(today);
        start.setDate(today.getDate() - 29);
        return d >= start && d <= today;
      }

      if (period === "last90") {
        const start = new Date(today);
        start.setDate(today.getDate() - 89);
        return d >= start && d <= today;
      }

      return true;
    });
  }, [data, period]);

  // ⬇️ Aggregation logic (UNCHANGED)
  const {
    totalIncome,
    totalExpenses,
    categoryExpensesEntries,
    drilldownSeries,
    topIncomePayers,
    topExpenseMerchants,
  } = useMemo(() => {
    const isIncome = (amt) => Number(amt) >= 0;
    let incomeSum = 0, expenseSum = 0;
    const categoryExpenses = {}, merchantsByCategory = {}, incomeByPayer = {}, expenseByMerchant = {};

    const excludedCategories = new Set([
      "Asset Disposal",
      "Insurance Payout",
      "Internal Transfer",
      "Returned Direct Debit",
      "Transfer Between Accounts",
      "Refund",
    ]);

    filtered.forEach((tx) => {
      const amount = parseFloat(tx.amount) || 0;
      const category = (tx.category && tx.category.trim()) || inferCategory(tx.description);
      const merchant = (tx.description && tx.description.trim()) || "Unknown";

      if (isIncome(amount)) {
        if (!excludedCategories.has(category)) {
          incomeSum += amount;
          incomeByPayer[merchant] = (incomeByPayer[merchant] || 0) + amount;
        }
      } else {
        if (!excludedCategories.has(category)) {
          const out = Math.abs(amount);
          expenseSum += out;
          categoryExpenses[category] = (categoryExpenses[category] || 0) + out;

          if (!merchantsByCategory[category]) merchantsByCategory[category] = {};
          merchantsByCategory[category][merchant] = (merchantsByCategory[category][merchant] || 0) + out;

          expenseByMerchant[merchant] = (expenseByMerchant[merchant] || 0) + out;
        }
      }
    });

    return {
      totalIncome: incomeSum,
      totalExpenses: expenseSum,
      categoryExpensesEntries: Object.entries(categoryExpenses).sort((a, b) => b[1] - a[1]),
      drilldownSeries: Object.entries(merchantsByCategory).map(([category, merchants]) => ({
        id: category,
        name: category,
        data: Object.entries(merchants).sort((a, b) => b[1] - a[1]),
      })),
      topIncomePayers: Object.entries(incomeByPayer).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount]) => ({ name, amount })),
      topExpenseMerchants: Object.entries(expenseByMerchant).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amount]) => ({ name, amount })),
    };
  }, [filtered]);

  return (
    <ResponsiveLayout>
      {/* JSX BELOW IS UNCHANGED FROM YOUR ORIGINAL */}
    </ResponsiveLayout>
  );
}
