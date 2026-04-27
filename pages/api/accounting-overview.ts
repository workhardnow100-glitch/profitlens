import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

// BUILDER ENGINE (statutory, all years)
import { buildAccountsFormData } from "../../lib/accounting/builder-engine";

// JOURNAL ENGINE (YTD)
import {
  getUnifiedBalanceSheet,
  getUnifiedTrialBalance,
  getUnifiedProfitAndLoss,
  getUnifiedDirectorLoan,
  getUnifiedCashFlow,
} from "../../lib/accounting/balance-sheet-engine";

// Normalise every BSLine row so UI never receives undefined values
function normalizeLine(line: any) {
  return {
    account_code: String(line.account_code || ""),
    account_name: String(line.account_name || ""),
    account_type: line.account_type || null,
    hmrc_bucket: line.hmrc_bucket || null,
    debit: Number(line.debit || 0),
    credit: Number(line.credit || 0),
    balance: Number(line.balance || 0),
  };
}

type PeriodFilter = {
  from: Date;
  to: Date;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    const clientId = session?.user?.clientId;

    if (!clientId) {
      return res.status(200).json(emptyOverview());
    }

    // ------------------------------------------------------------
    // PERIODS
    // ------------------------------------------------------------
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const currentYear = today.getFullYear();

    const ytdPeriod: PeriodFilter = { from: startOfYear, to: today };

    // ------------------------------------------------------------
    // FULL BUSINESS — BUILDER ENGINE (ALL YEARS)
    // ------------------------------------------------------------
    const { overview: full } = await buildAccountsFormData(
      null,
      clientId,
      "1900-01-01",
      "2126-12-31",
      []
    );

    const fullSafe: any = full || {};

    // ------------------------------------------------------------
    // YTD — JOURNAL ENGINE
    // ------------------------------------------------------------
    const [ytdBS, ytdTB, ytdPL, ytdDL, ytdCF] = await Promise.all([
      getUnifiedBalanceSheet(clientId, currentYear),
      getUnifiedTrialBalance(clientId, ytdPeriod),
      getUnifiedProfitAndLoss(clientId, ytdPeriod),
      getUnifiedDirectorLoan(clientId, ytdPeriod),
      getUnifiedCashFlow(clientId, ytdPeriod),
    ]);

    // ------------------------------------------------------------
    // COA SUMMARY
    // ------------------------------------------------------------
    const { data: coa, error: coaError } = await supabaseAdmin
      .from("chart_of_accounts")
      .select("id")
      .eq("client_id", clientId)
      .single();

    let totalAccounts = 0;
    let activeAccounts = 0;
    let systemAccounts = 0;
    let uncategorisedAccounts = 0;
    let suspenseAccounts = 0;

    if (!coaError && coa) {
      const { data: coaEntries } = await supabaseAdmin
        .from("chart_of_account_entries")
        .select("account_code, account_type, is_system, has_activity")
        .eq("coa_id", coa.id);

      if (coaEntries) {
        totalAccounts = coaEntries.length;
        activeAccounts = coaEntries.filter((a) => a.has_activity).length;
        systemAccounts = coaEntries.filter((a) => a.is_system).length;
        uncategorisedAccounts = coaEntries.filter(
          (a) => a.account_code === "9020"
        ).length;
        suspenseAccounts = coaEntries.filter(
          (a) => a.account_code === "9999"
        ).length;
      }
    }

    // ------------------------------------------------------------
    // VAT + CT FROM TRANSACTION TOGGLES
    // ------------------------------------------------------------
    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .select("amount, debit, credit, vat_toggle, ct_toggle")
      .eq("client_id", clientId);

    type ControlLine = {
      account_code: string;
      account_name: string;
      debit: number;
      credit: number;
      balance: number;
    };

    const vat_control: ControlLine[] = [];
    const corporation_tax: ControlLine[] = [];

    if (tx && tx.length > 0) {
      const vatDebit = tx
        .filter((t) => t.vat_toggle === true)
        .reduce((sum, t) => sum + Number(t.debit || 0), 0);

      const vatCredit = tx
        .filter((t) => t.vat_toggle === true)
        .reduce((sum, t) => sum + Number(t.credit || 0), 0);

      vat_control.push({
        account_code: "VAT",
        account_name: "VAT Control",
        debit: vatDebit,
        credit: vatCredit,
        balance: vatDebit - vatCredit,
      });

      const ctDebit = tx
        .filter((t) => t.ct_toggle === true)
        .reduce((sum, t) => sum + Number(t.debit || 0), 0);

      const ctCredit = tx
        .filter((t) => t.ct_toggle === true)
        .reduce((sum, t) => sum + Number(t.credit || 0), 0);

      corporation_tax.push({
        account_code: "CT",
        account_name: "Corporation Tax",
        debit: ctDebit,
        credit: ctCredit,
        balance: ctDebit - ctCredit,
      });
    }

    // ------------------------------------------------------------
    // FULL BUSINESS — BUILDER MAPPING (DEFENSIVE)
    // ------------------------------------------------------------
    const bs = {
      total_assets: Number(fullSafe.totals?.total_assets || 0),
      total_liabilities: Number(fullSafe.totals?.total_liabilities || 0),
      total_equity: Number(fullSafe.totals?.total_equity || 0),
    };

    const pl = {
      revenue: Number(fullSafe.pnl?.revenue || 0),
      cost_of_sales: Number(fullSafe.pnl?.cost_of_sales || 0),
      gross_profit: Number(fullSafe.pnl?.gross_profit || 0),
      operating_expenses: Number(fullSafe.pnl?.operating_expenses || 0),
      net_profit: Number(fullSafe.pnl?.net_profit || 0),
    };

    const tb = {
      assets: Number(fullSafe.trial_balance?.assets || 0),
      liabilities: Number(fullSafe.trial_balance?.liabilities || 0),
      equity: Number(fullSafe.trial_balance?.equity || 0),
      income: Number(fullSafe.trial_balance?.income || 0),
      expenses: Number(fullSafe.trial_balance?.expenses || 0),
    };

    const trial_balance_full = Array.isArray(
      fullSafe.trial_balance?.lines
    )
      ? fullSafe.trial_balance.lines.map(normalizeLine)
      : [];

    const balance_sheet_full = Array.isArray(
      fullSafe.balance_sheet?.lines
    )
      ? fullSafe.balance_sheet.lines.map(normalizeLine)
      : [];

    const profit_and_loss_full = Array.isArray(fullSafe.pnl?.lines)
      ? fullSafe.pnl.lines.map(normalizeLine)
      : [];

    const director_loan_ledger = Array.isArray(
      fullSafe.director_loan?.lines
    )
      ? fullSafe.director_loan.lines.map(normalizeLine)
      : [];

    const fixed_assets = Array.isArray(fullSafe.fixed_assets?.lines)
      ? fullSafe.fixed_assets.lines.map(normalizeLine)
      : [];

    const fixed_assets_nbv = Number(fullSafe.fixed_assets?.nbv || 0);

    const liabilities_lines = Array.isArray(fullSafe.liabilities?.lines)
      ? fullSafe.liabilities.lines.map(normalizeLine)
      : [];

    const liabilities_total = Number(fullSafe.liabilities?.total || 0);

    const cash_flow_lines_full =
      fullSafe.cashflow && Array.isArray(fullSafe.cashflow.lines)
        ? fullSafe.cashflow.lines.map((l: any) => ({
            ...l,
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
          }))
        : [];

    // BANK ACCOUNTS FROM BUILDER BALANCE SHEET
    const bank_accounts = balance_sheet_full
      .filter((line: any) => {
        const type = (line.account_type || "").toUpperCase();
        return type === "BANK";
      })
      .map((line: any) => ({
        account_code: line.account_code,
        account_name: line.account_name,
        closing_balance: Number(line.balance || 0),
        money_in: Number(line.debit || 0),
        money_out: Number(line.credit || 0),
      }));

    // SUSPENSE + UNCATEGORISED FROM BUILDER TB
    const suspense_and_uncategorised = trial_balance_full
      .filter(
        (l: any) =>
          l.account_code === "9020" || l.account_code === "9999"
      )
      .map(normalizeLine);

    // ------------------------------------------------------------
    // YTD — JOURNAL MAPPING
    // ------------------------------------------------------------
    const ytdPl = ytdPL.summary;
    const ytdTb = ytdTB.summary;
    const ytdBs = ytdBS.totals;

    const ytd_balance_sheet_full = [
      ...ytdBS.assets.current,
      ...ytdBS.assets.non_current,
      ...ytdBS.liabilities.current,
      ...ytdBS.liabilities.non_current,
      ...ytdBS.equity,
    ].map(normalizeLine);

    const ytd_trial_balance_full = ytdTB.lines.map(normalizeLine);
    const ytd_profit_and_loss_full = ytdPL.lines.map(normalizeLine);
    const ytd_director_loan_ledger = ytdDL.lines.map(normalizeLine);

    const cash_flow_lines_ytd = ytdCF.lines.map((l: any) => ({
      ...l,
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0),
    }));

    // ------------------------------------------------------------
    // BUILD RESPONSE
    // ------------------------------------------------------------
    return res.status(200).json({
      // LEGACY FLAT SHAPE (builder-powered)
      financial_health: {
        assets: bs.total_assets,
        liabilities: bs.total_liabilities,
        equity: bs.total_equity,
        revenue_mtd: pl.revenue,
        revenue_ytd: pl.revenue,
        expenses_mtd: pl.operating_expenses,
        expenses_ytd: pl.operating_expenses,
        net_profit_mtd: pl.net_profit,
        net_profit_ytd: pl.net_profit,
      },

      trial_balance_summary: tb,
      profit_and_loss_summary: pl,

      balance_sheet_summary: {
        total_assets: bs.total_assets,
        total_liabilities: bs.total_liabilities,
        net_assets: bs.total_assets - bs.total_liabilities,
        equity: bs.total_equity,
      },

      trial_balance_full,
      balance_sheet_full,
      profit_and_loss_full,
      director_loan_ledger,

      bank_accounts,
      vat_control,
      paye_control: [],
      corporation_tax,
      fixed_assets,
      suspense_and_uncategorised,
      cash_flow: cash_flow_lines_full,

      coa_summary: {
        total_accounts: totalAccounts,
        active_accounts: activeAccounts,
        system_accounts: systemAccounts,
        uncategorised_accounts: uncategorisedAccounts,
        suspense_accounts: suspenseAccounts,
      },

      alerts: [],
      quick_actions: [
        { label: "Add Account", link: "/setting/chart-of-accounts" },
        { label: "Post Journal", link: "/journal/new" },
        { label: "View Transactions", link: "/transactions" },
        { label: "Reconcile Bank", link: "/bank-reconciliation" },
        { label: "Create Invoice", link: "/invoices/new" },
        { label: "Upload Statement", link: "/upload" },
        { label: "Run VAT Return", link: "/vat" },
      ],

      // FULL BUSINESS — BUILDER ENGINE
      full_business: {
        financial_health: {
          total_assets: bs.total_assets,
          total_liabilities: bs.total_liabilities,
          net_assets: bs.total_assets - bs.total_liabilities,
          equity: bs.total_equity,
        },
        balance_sheet: {
          summary: {
            total_assets: bs.total_assets,
            total_liabilities: bs.total_liabilities,
            net_assets: bs.total_assets - bs.total_liabilities,
            equity: bs.total_equity,
          },
          lines: balance_sheet_full,
        },
        trial_balance: {
          summary: tb,
          lines: trial_balance_full,
        },
        profit_and_loss: {
          summary: pl,
          lines: profit_and_loss_full,
        },
        fixed_assets: {
          lines: fixed_assets,
          nbv: fixed_assets_nbv,
        },
        liabilities: {
          lines: liabilities_lines,
          total: liabilities_total,
        },
        cash_flow: cash_flow_lines_full,
        director_loan: director_loan_ledger,
      },

      // YTD — JOURNAL ENGINE
      ytd: {
        financial_health: {
          revenue_mtd: ytdPl.revenue,
          revenue_ytd: ytdPl.revenue,
          expenses_mtd: ytdPl.operating_expenses,
          expenses_ytd: ytdPl.operating_expenses,
          net_profit_mtd: ytdPl.net_profit,
          net_profit_ytd: ytdPl.net_profit,
        },
        balance_sheet: {
          summary: {
            total_assets: ytdBs.total_assets,
            total_liabilities: ytdBs.total_liabilities,
            net_assets: ytdBs.total_assets - ytdBs.total_liabilities,
            equity: ytdBs.total_equity,
          },
          lines: ytd_balance_sheet_full,
        },
        trial_balance: {
          summary: ytdTb,
          lines: ytd_trial_balance_full,
        },
        profit_and_loss: {
          summary: ytdPl,
          lines: ytd_profit_and_loss_full,
        },
        cash_flow: cash_flow_lines_ytd,
        director_loan: ytd_director_loan_ledger,
      },
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
    trial_balance_summary: {
      assets: 0,
      liabilities: 0,
      equity: 0,
      income: 0,
      expenses: 0,
    },
    profit_and_loss_summary: {
      revenue: 0,
      cost_of_sales: 0,
      gross_profit: 0,
      operating_expenses: 0,
      net_profit: 0,
    },
    balance_sheet_summary: {
      total_assets: 0,
      total_liabilities: 0,
      net_assets: 0,
      equity: 0,
    },
    trial_balance_full: [],
    balance_sheet_full: [],
    profit_and_loss_full: [],
    director_loan_ledger: [],
    bank_accounts: [],
    vat_control: [],
    paye_control: [],
    corporation_tax: [],
    fixed_assets: [],
    suspense_and_uncategorised: [],
    cash_flow: [],
    coa_summary: {
      total_accounts: 0,
      active_accounts: 0,
      system_accounts: 0,
      uncategorised_accounts: 0,
      suspense_accounts: 0,
    },
    alerts: [],
    quick_actions: [],
    full_business: {
      financial_health: {
        total_assets: 0,
        total_liabilities: 0,
        net_assets: 0,
        equity: 0,
      },
      balance_sheet: {
        summary: {
          total_assets: 0,
          total_liabilities: 0,
          net_assets: 0,
          equity: 0,
        },
        lines: [],
      },
      trial_balance: {
        summary: {
          assets: 0,
          liabilities: 0,
          equity: 0,
          income: 0,
          expenses: 0,
        },
        lines: [],
      },
      profit_and_loss: {
        summary: {
          revenue: 0,
          cost_of_sales: 0,
          gross_profit: 0,
          operating_expenses: 0,
          net_profit: 0,
        },
        lines: [],
      },
      fixed_assets: {
        lines: [],
        nbv: 0,
      },
      liabilities: {
        lines: [],
        total: 0,
      },
      cash_flow: [],
      director_loan: [],
    },
    ytd: {
      financial_health: {
        revenue_mtd: 0,
        revenue_ytd: 0,
        expenses_mtd: 0,
        expenses_ytd: 0,
        net_profit_mtd: 0,
        net_profit_ytd: 0,
      },
      balance_sheet: {
        summary: {
          total_assets: 0,
          total_liabilities: 0,
          net_assets: 0,
          equity: 0,
        },
        lines: [],
      },
      trial_balance: {
        summary: {
          assets: 0,
          liabilities: 0,
          equity: 0,
          income: 0,
          expenses: 0,
        },
        lines: [],
      },
      profit_and_loss: {
        summary: {
          revenue: 0,
          cost_of_sales: 0,
          gross_profit: 0,
          operating_expenses: 0,
          net_profit: 0,
        },
        lines: [],
      },
      cash_flow: [],
      director_loan: [],
    },
  };
}
