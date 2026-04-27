// lib/accounting/builder-engine.js
import { supabaseAdmin } from "../supabase-admin";

/* -------------------------------------------------------------------------- */
/*                        ACCOUNTS BUILDER (NUMERIC)                          */
/* -------------------------------------------------------------------------- */

export async function buildAccountsFormData(
  client,
  clientId,
  periodStart,
  periodEnd,
  customNotes = []
) {
  const { data: journals, error } = await supabaseAdmin
    .from("journal_entries")
    .select(
      `
      id,
      date,
      journal_lines (
        debit,
        credit,
        chart_of_account_entries (
          account_code,
          account_name,
          account_type,
          hmrc_bucket
        )
      )
    `
    )
    .eq("client_id", clientId)
    .gte("date", periodStart)
    .lte("date", periodEnd);

  if (error) {
    console.error("Error loading Accounts journals:", error);
    return { overview: { totals: {} }, overviewPrior: { totals: {} } };
  }

  function computeFromJournals(journals) {
    let totals = {
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      totalFixedAssets: 0,
      totalCurrentAssets: 0,
      totalCurrentLiabilities: 0,
      totalNonCurrentLiabilities: 0,
    };
    let accounts = {};
    let categories = {
      fixedAssets: 0,
      accumulatedDepreciation: 0,
      depreciationCharge: 0,
      bank: 0,
      receivables: 0,
      payables: 0,
      equity: 0,
      directorLoans: 0,
      directorLoansReceivable: 0,
      directorLoansPayable: 0,
    };

    (journals || []).forEach((j) => {
      (j.journal_lines || []).forEach((line) => {
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        const type =
          (line.chart_of_account_entries?.account_type || "").toUpperCase();
        const bucket =
          (line.chart_of_account_entries?.hmrc_bucket || "").toLowerCase();
        const code = line.chart_of_account_entries?.account_code;
        const name = (
          line.chart_of_account_entries?.account_name || ""
        ).toLowerCase();

        if (code)
          accounts[code] = (accounts[code] || 0) + (debit - credit);

        if (bucket === "fixed_asset")
          totals.totalFixedAssets += debit - credit;

        if (bucket === "fixed_asset_contra") {
          categories.accumulatedDepreciation += credit - debit;
        }

        if (
          bucket === "assets" ||
          type === "BANK" ||
          type === "ACCOUNTS_RECEIVABLE"
        ) {
          totals.totalCurrentAssets += debit - credit;
          if (type === "BANK") categories.bank += debit - credit;
          if (type === "ACCOUNTS_RECEIVABLE")
            categories.receivables += debit - credit;
        }

        if (
          bucket === "liabilities" ||
          type === "ACCOUNTS_PAYABLE" ||
          type === "LIABILITY"
        ) {
          totals.totalCurrentLiabilities += credit - debit;
          categories.payables += credit - debit;
        }

        if (bucket === "equity" || type === "EQUITY") {
          totals.totalEquity += credit - debit;
          categories.equity += credit - debit;
        }

        // Director Loan logic by NAME
        if (
          name.includes("director loan") ||
          name.includes("director payments") ||
          name.includes("director personal expenses") ||
          name.includes("cash withdrawals")
        ) {
          categories.directorLoansReceivable += debit - credit;
          totals.totalCurrentAssets += debit - credit;
        }

        if (
          name.includes("loan liability") ||
          name.includes("director loan payable")
        ) {
          categories.directorLoansPayable += credit - debit;
          totals.totalNonCurrentLiabilities += credit - debit;
        }

        if (name.includes("depreciation expense")) {
          categories.depreciationCharge += debit;
        }

        if (type === "ASSET") totals.totalAssets += debit - credit;
        if (type === "LIABILITY")
          totals.totalLiabilities += credit - debit;
      });
    });

    return { totals, accounts, categories };
  }

  function roundObjectValues(obj) {
    const rounded = {};
    for (const key in obj) rounded[key] = Math.round(obj[key] || 0);
    return rounded;
  }

  let currentMovements = computeFromJournals(journals);

  const priorYearStart = new Date(periodStart);
  priorYearStart.setFullYear(priorYearStart.getFullYear() - 1);
  const priorYearEnd = new Date(periodEnd);
  priorYearEnd.setFullYear(priorYearEnd.getFullYear() - 1);

  const { data: priorJournals } = await supabaseAdmin
    .from("journal_entries")
    .select(
      `
      id,
      date,
      journal_lines (
        debit,
        credit,
        chart_of_account_entries (
          account_code,
          account_name,
          account_type,
          hmrc_bucket
        )
      )
    `
    )
    .eq("client_id", clientId)
    .gte("date", priorYearStart.toISOString().split("T")[0])
    .lte("date", priorYearEnd.toISOString().split("T")[0]);

  let prior = computeFromJournals(priorJournals);

  const { data: priorSubmission } = await supabaseAdmin
    .from("accounts_submissions")
    .select("*")
    .eq("client_id", clientId)
    .eq("period_end", priorYearEnd.toISOString().split("T")[0])
    .maybeSingle();

  if (priorSubmission) {
    prior.totals.totalAssets =
      priorSubmission.total_assets || prior.totals.totalAssets;
    prior.totals.totalLiabilities =
      priorSubmission.total_liabilities ||
      prior.totals.totalLiabilities;
    prior.totals.totalEquity =
      priorSubmission.total_equity || prior.totals.totalEquity;
    prior.totals.totalFixedAssets =
      priorSubmission.fixed_assets || prior.totals.totalFixedAssets;
    prior.totals.totalCurrentAssets =
      priorSubmission.current_assets ||
      prior.totals.totalCurrentAssets;
    prior.totals.totalCurrentLiabilities =
      priorSubmission.current_liabilities ||
      prior.totals.totalCurrentLiabilities;
    prior.totals.totalNonCurrentLiabilities =
      priorSubmission.non_current_liabilities ||
      prior.totals.totalNonCurrentLiabilities;
    prior.accounts = priorSubmission.accounts || prior.accounts;
    prior.categories = priorSubmission.categories || prior.categories;
  } else {
    prior.totals.totalEquity =
      (prior.totals.totalAssets || 0) -
      (prior.totals.totalLiabilities || 0);
  }

  const priorCost = prior.totals.totalFixedAssets || 0;
  const priorDep = prior.categories.accumulatedDepreciation || 0;
  prior.categories.fixedAssets = priorCost - priorDep;
  prior.totals.non_current_assets = prior.categories.fixedAssets;

  function addCarryForward(prior, currentMovements) {
    const categories = {};
    const totals = {};
    const accounts = {};

    for (const key of Object.keys(prior.categories)) {
      if (
        ["fixedAssets", "accumulatedDepreciation", "depreciationCharge"].includes(
          key
        )
      ) {
        categories[key] = currentMovements.categories[key] || 0;
      } else {
        categories[key] =
          (prior.categories[key] || 0) +
          (currentMovements.categories[key] || 0);
      }
    }

    for (const key of Object.keys(prior.totals)) {
      totals[key] =
        (prior.totals[key] || 0) + (currentMovements.totals[key] || 0);
    }

    for (const code of new Set([
      ...Object.keys(prior.accounts),
      ...Object.keys(currentMovements.accounts),
    ])) {
      accounts[code] =
        (prior.accounts[code] || 0) +
        (currentMovements.accounts[code] || 0);
    }

    const cost = priorCost + (currentMovements.totals.totalFixedAssets || 0);
    const depreciation =
      priorDep + (currentMovements.categories.depreciationCharge || 0);

    categories.accumulatedDepreciation = depreciation;
    categories.fixedAssets = cost - depreciation;

    return { totals, accounts, categories };
  }

  let current = addCarryForward(prior, currentMovements);

  current.totals = roundObjectValues(current.totals);
  current.categories = roundObjectValues(current.categories);
  prior.totals = roundObjectValues(prior.totals);
  prior.categories = roundObjectValues(prior.categories);

  const netCurrentAssetsCurrent =
    current.totals.totalCurrentAssets -
    current.totals.totalCurrentLiabilities;
  current.totals.totalAssets =
    current.categories.fixedAssets + netCurrentAssetsCurrent;
  current.totals.totalEquity = current.totals.totalAssets;

  const netCurrentAssetsPrior =
    prior.totals.totalCurrentAssets -
    prior.totals.totalCurrentLiabilities;
  prior.totals.totalAssets =
    prior.categories.fixedAssets + netCurrentAssetsPrior;
  prior.totals.totalEquity = prior.totals.totalAssets;

  const payload = {
    overview: {
      totals: {
        non_current_assets: current.categories.fixedAssets,
        current_assets: current.totals.totalCurrentAssets,
        total_assets_less_current_liabilities:
          current.categories.fixedAssets +
          (current.totals.totalCurrentAssets -
            current.totals.totalCurrentLiabilities),
        current_liabilities: current.totals.totalCurrentLiabilities,
        non_current_liabilities: current.totals.totalNonCurrentLiabilities,
        total_liabilities: current.totals.totalLiabilities,
        total_equity: current.totals.totalEquity,
        capital_and_reserves: current.totals.totalEquity,
        net_current_assets:
          current.totals.totalCurrentAssets -
          current.totals.totalCurrentLiabilities,
      },
      accounts: current.accounts,
      categories: current.categories,
    },

    overviewPrior: {
      totals: {
        non_current_assets: prior.categories.fixedAssets,
        current_assets: prior.totals.totalCurrentAssets,
        total_assets_less_current_liabilities:
          prior.categories.fixedAssets +
          (prior.totals.totalCurrentAssets -
            prior.totals.totalCurrentLiabilities),
        current_liabilities: prior.totals.totalCurrentLiabilities,
        non_current_liabilities: prior.totals.totalNonCurrentLiabilities,
        total_liabilities: prior.totals.totalLiabilities,
        total_equity: prior.totals.totalEquity,
        capital_and_reserves: prior.totals.totalEquity,
        net_current_assets:
          prior.totals.totalCurrentAssets -
          prior.totals.totalCurrentLiabilities,
      },
      accounts: prior.accounts,
      categories: prior.categories,
    },

    notes: {
      accountingPolicies:
        "These accounts have been prepared in accordance with FRS 105.",
      employees: client?.employees_current_year || 0,
      taxation:
        "Corporation tax is provided at amounts expected to be paid using enacted rates.",
      debtors: client?.debtors_total || 0,
      creditors: client?.creditors_total || 0,
    },
    directorApproval: {
      approvedBy: client?.director_name || "Director",
      signature: client?.director_signature_name || "Signature",
      approvalDate: client?.accounts_approval_date
        ? client.accounts_approval_date.toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      statement:
        "The directors acknowledge their responsibilities under the Companies Act 2006.",
    },
  };

  return {
    ...payload,
    customNotes: customNotes || [],  
  };
}
