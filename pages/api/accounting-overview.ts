// pages/api/accounting-overview.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { CT_MAP } from "../../lib/constants/ctMap";
import { ALLOWED_BUSINESS_CATEGORIES } from "../../lib/category/Engine";

// --- COA HELPERS (aligned with your CoA API) ---
const INCOME_TYPES = new Set(CT_MAP.income.map((c) => c.toLowerCase()));
const ALLOWABLE_TYPES = new Set(CT_MAP.allowable.map((c) => c.toLowerCase()));
const DISALLOWABLE_TYPES = new Set(CT_MAP.disallowable.map((c) => c.toLowerCase()));
const IGNORE_TYPES = new Set(CT_MAP.ignore.map((c) => c.toLowerCase()));

function classifyBucket(name: string) {
  const key = (name || "").toLowerCase();
  if (INCOME_TYPES.has(key)) return "income";
  if (ALLOWABLE_TYPES.has(key)) return "allowable";
  if (DISALLOWABLE_TYPES.has(key)) return "disallowable";
  if (IGNORE_TYPES.has(key)) return "ignore";
  return "ignore";
}

function classifyAccountType(bucket: string) {
  switch (bucket) {
    case "income":
      return "INCOME";
    case "allowable":
    case "disallowable":
      return "expense".toUpperCase(); // "EXPENSE"
    default:
      return "SYSTEM";
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const clientId = session?.user?.clientId;

    if (!clientId) {
      return res.status(200).json(emptyOverview());
    }

    // 🔹 Fetch COA header
    const { data: coa, error: coaError } = await supabaseAdmin
      .from("chart_of_accounts")
      .select("id")
      .eq("client_id", clientId)
      .single();

    if (coaError || !coa) {
      return res.status(200).json(emptyOverview());
    }

    // 🔹 Fetch COA entries (full row, needed for auto‑sync)
    const { data: coaEntries, error: coaEntriesError } = await supabaseAdmin
      .from("chart_of_account_entries")
      .select("*")
      .eq("coa_id", coa.id);

    if (coaEntriesError) {
      console.error("CoA entries fetch error:", coaEntriesError.message);
      return res.status(200).json(emptyOverview());
    }

    // 🔹 Fetch transactions
    const { data: transactions, error } = await supabaseAdmin
      .from("transactions")
      .select("id, date, amount, business_category, balance")
      .eq("client_id", clientId);

    if (error || !transactions) {
      return res.status(200).json(emptyOverview());
    }

    // =====================================================================================
    // ⭐ AUTO‑SYNC COA FROM TRANSACTIONS (Option A)
    // =====================================================================================

    const usedCategories = new Set(
      transactions
        .map((t: any) => t.business_category as string | null)
        .filter((c): c is string => !!c && ALLOWED_BUSINESS_CATEGORIES.has(c))
    );

    const existingMap = new Map<string, any>(
      (coaEntries || []).map((e: any) => [String(e.account_name).toLowerCase(), e])
    );

    const newEntries: any[] = [];
    const updates: { id: string; has_activity: boolean; is_system: boolean }[] = [];

    for (const category of Array.from(usedCategories)) {

  const key = category.toLowerCase();
  const existing = existingMap.get(key);

  if (!existing) {
    const bucket = classifyBucket(category);
    const accountType = classifyAccountType(bucket);

    newEntries.push({
      coa_id: coa.id,
      account_code: null,
      account_name: category,
      account_type: accountType,
      hmrc_bucket: bucket,
      description: null,
      is_system: false,
      has_activity: true,
    });
  } else {
    if (!existing.has_activity || existing.is_system) {
      updates.push({
        id: existing.id,
        has_activity: true,
        is_system: false,
      });
    }
  }
}

    // Insert missing entries
    if (newEntries.length > 0) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("chart_of_account_entries")
        .insert(newEntries)
        .select("*");

      if (insertError) {
        console.error("CoA insert error:", insertError.message);
      } else {
        for (const e of inserted || []) {
          existingMap.set(String(e.account_name).toLowerCase(), e);
        }
      }
    }

    // Update existing entries
    for (const u of updates) {
      const { error: updateError } = await supabaseAdmin
        .from("chart_of_account_entries")
        .update({
          has_activity: true,
          is_system: false,
        })
        .eq("id", u.id);

      if (updateError) {
        console.error("CoA update error:", updateError.message);
      }
    }

    // Assign account codes to any entries missing them
    const allEntries: any[] = Array.from(existingMap.values());
    let incomeCode = 4000;
    let expenseCode = 5000;
    let systemCode = 9000;

    for (const entry of allEntries) {
      if (!entry.account_code) {
        if (entry.account_type === "INCOME") {
          entry.account_code = String(incomeCode++);
        } else if (entry.account_type === "EXPENSE") {
          entry.account_code = String(expenseCode++);
        } else {
          entry.account_code = String(systemCode++);
        }

        const { error: codeError } = await supabaseAdmin
          .from("chart_of_account_entries")
          .update({ account_code: entry.account_code })
          .eq("id", entry.id);

        if (codeError) {
          console.error("CoA code update error:", codeError.message);
        }
      }
    }

    // Recompute COA summary after sync
    const totalAccounts = allEntries.length;
    const activeAccounts = allEntries.filter((a) => !a.is_system).length;
    const systemAccounts = allEntries.filter((a) => a.is_system).length;
    const uncategorisedAccounts = allEntries.filter((a) => a.account_code === "9020").length;
    const suspenseAccounts = allEntries.filter((a) => a.account_code === "9999").length;

    // =====================================================================================
    // ⭐ P&L + TB + BALANCE SHEET ENGINE
    // =====================================================================================

    const incomeSet = new Set(CT_MAP.income);
    const allowableSet = new Set(CT_MAP.allowable);
    const disallowableSet = new Set(CT_MAP.disallowable);
    const ignoreSet = new Set(CT_MAP.ignore);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let incomeTotal = 0;
    let expenseTotal = 0;

    let revenueMtd = 0;
    let revenueYtd = 0;
    let expensesMtd = 0;
    let expensesYtd = 0;

    let uncategorisedCount = 0;
    let negativeBalanceCount = 0;

    let vatLiability = 0;
    let cisLiability = 0;
    let ctLiability = 0;
    let saLiability = 0;

    for (const tx of transactions as any[]) {
      const date = tx.date ? new Date(tx.date) : null;
      const category: string = tx.business_category ?? "";
      const amount = Number(tx.amount ?? 0);

      if (tx.balance !== null && tx.balance !== undefined && Number(tx.balance) < 0) {
        negativeBalanceCount += 1;
      }

      // Tax buckets
      switch (category) {
        case "VAT Collected":
          vatLiability += amount;
          break;
        case "VAT Paid":
        case "VAT Adjustment":
          vatLiability -= Math.abs(amount);
          break;
        case "CIS Deducted":
          cisLiability += amount;
          break;
        case "CIS Suffered":
          cisLiability -= Math.abs(amount);
          break;
        case "Corporation Tax Payment":
          ctLiability -= Math.abs(amount);
          break;
        case "Corporation Tax Refund":
          ctLiability += amount;
          break;
        case "SA Payment":
          saLiability -= Math.abs(amount);
          break;
        case "SA Refund":
          saLiability += amount;
          break;
      }

      if (!category || !ALLOWED_BUSINESS_CATEGORIES.has(category)) {
        uncategorisedCount += 1;
        continue;
      }

      if (ignoreSet.has(category)) continue;

      const isIncome = incomeSet.has(category);
      const isAllowable = allowableSet.has(category);
      const isDisallowable = disallowableSet.has(category);

      if (isIncome) {
        incomeTotal += amount;
        if (date) {
          if (date >= startOfMonth) revenueMtd += amount;
          if (date >= startOfYear) revenueYtd += amount;
        }
        continue;
      }

      if (isAllowable || isDisallowable) {
        const absAmount = Math.abs(amount);
        expenseTotal += absAmount;
        if (date) {
          if (date >= startOfMonth) expensesMtd += absAmount;
          if (date >= startOfYear) expensesYtd += absAmount;
        }
        continue;
      }
    }

    const netProfitMtd = revenueMtd - expensesMtd;
    const netProfitYtd = revenueYtd - expensesYtd;
    const netProfit = incomeTotal - expenseTotal;

    // Single‑bank balance sheet
    let bankAssets = 0;
    const withBalance = (transactions as any[]).filter(
      (t) => t.balance !== null && t.balance !== undefined
    );

    if (withBalance.length > 0) {
      withBalance.sort(
        (a, b) =>
          new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      );
      bankAssets = Number(withBalance[0].balance) || 0;
    }

    const totalTaxLiabilities =
      vatLiability + cisLiability + ctLiability + saLiability;

    const totalAssets = bankAssets;
    const totalLiabilities = totalTaxLiabilities;
    const netAssets = totalAssets - totalLiabilities;
    const equity = netAssets;

    return res.status(200).json({
      financial_health: {
        assets: totalAssets,
        liabilities: totalLiabilities,
        equity: equity,
        revenue_mtd: revenueMtd,
        revenue_ytd: revenueYtd,
        expenses_mtd: expensesMtd,
        expenses_ytd: expensesYtd,
        net_profit_mtd: netProfitMtd,
        net_profit_ytd: netProfitYtd,
      },
      trial_balance: {
        assets: totalAssets,
        liabilities: totalLiabilities,
        equity: equity,
        income: incomeTotal,
        expenses: expenseTotal,
      },
      profit_and_loss: {
        revenue: incomeTotal,
        cost_of_sales: 0,
        gross_profit: incomeTotal,
        operating_expenses: expenseTotal,
        net_profit: netProfit,
      },
      balance_sheet: {
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        net_assets: netAssets,
        equity: equity,
      },
      coa_summary: {
        total_accounts: totalAccounts,
        active_accounts: activeAccounts,
        system_accounts: systemAccounts,
        uncategorised_accounts: uncategorisedAccounts,
        suspense_accounts: suspenseAccounts,
      },
      alerts: [
        {
          type: "uncategorised_transactions",
          count: uncategorisedCount,
          severity: uncategorisedCount > 0 ? "high" : "low",
          link: "/transactions?filter=uncategorised",
        },
        {
          type: "negative_balance",
          count: negativeBalanceCount,
          severity: negativeBalanceCount > 0 ? "medium" : "low",
          link: "/transactions?filter=negative_balance",
        },
        {
          type: "tax_liabilities",
          count:
            (vatLiability !== 0 ? 1 : 0) +
            (cisLiability !== 0 ? 1 : 0) +
            (ctLiability !== 0 ? 1 : 0) +
            (saLiability !== 0 ? 1 : 0),
          severity: totalTaxLiabilities > 0 ? "high" : "low",
          link: "/tax",
        },
      ],
      quick_actions: [
        { label: "Add Account", link: "/settings/chart-of-accounts?mode=add" },
        { label: "Post Journal", link: "/journal/new" },
        { label: "View Transactions", link: "/transactions" },
        { label: "Reconcile Bank", link: "/bank-reconciliation" },
        { label: "Create Invoice", link: "/invoices/new" },
        { label: "Upload Statement", link: "/upload" },
        { label: "Run VAT Return", link: "/vat" },
      ],
    });
  } catch (err) {
    console.error("Accounting overview handler error:", err);
    return res.status(200).json(emptyOverview());
  }
}

function emptyOverview() {
  return {
    financial_health: {
      assets: 0,
      liabilities: 0,
      equity: 0,
      revenue_mtd: 0,
      revenue_ytd: 0,
      expenses_mtd: 0,
      expenses_ytd: 0,
      net_profit_mtd: 0,
      net_profit_ytd: 0,
    },
    trial_balance: {
      assets: 0,
      liabilities: 0,
      equity: 0,
      income: 0,
      expenses: 0,
    },
    profit_and_loss: {
      revenue: 0,
      cost_of_sales: 0,
      gross_profit: 0,
      operating_expenses: 0,
      net_profit: 0,
    },
    balance_sheet: {
      total_assets: 0,
      total_liabilities: 0,
      net_assets: 0,
      equity: 0,
    },
    coa_summary: {
      total_accounts: 0,
      active_accounts: 0,
      system_accounts: 0,
      uncategorised_accounts: 0,
      suspense_accounts: 0,
    },
    alerts: [],
    quick_actions: [],
  };
}
