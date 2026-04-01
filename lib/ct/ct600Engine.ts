// lib/ct/ct600Engine.ts

import { supabaseAdmin } from "../supabase-admin";
import { CT_MAP } from "../constants/ctMap";

/* -------------------------------------------------------------------------- */
/*                     INLINE HELPERS (your project needs these)              */
/* -------------------------------------------------------------------------- */

// Extract signed amount from a journal line
function amountFromLine(line: any): number {
  const debit = Number(line.debit || 0);
  const credit = Number(line.credit || 0);
  return debit - credit;
}

// Sum array by field
function sumBy(arr: any[], field: string): number {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((total, item) => {
    const value = Number(item?.[field] || 0);
    return total + value;
  }, 0);
}

// Load CT journals directly from Supabase
async function loadCTJournals(
  clientId: string,
  periodStart: string,
  periodEnd: string
) {
  const { data, error } = await supabaseAdmin
    .from("journal_entries")
    .select(`
      id,
      date,
      client_id,
      lines:journal_lines (
        debit,
        credit,
        account:chart_of_account_entries (
          account_code,
          account_name
        )
      )
    `)
    .eq("client_id", clientId)
    .gte("date", periodStart)
    .lte("date", periodEnd);

  if (error) {
    console.error("Failed to load CT journals:", error);
    return [];
  }

  return data || [];
}

export { loadCTJournals, amountFromLine, sumBy };



/* -------------------------------------------------------------------------- */
/*                               CT600 CONFIG                                 */
/* -------------------------------------------------------------------------- */

const CAPITAL_ALLOWANCE_ACCOUNTS = [
  // Main Pool (AIA eligible)
  "Plant & Machinery",
  "Machinery",
  "Equipment",
  "Tools & Equipment",
  "Office Equipment",
  "Fixtures & Fittings",
  "Furniture",
  "Computer Equipment",
  "IT Equipment",
  "Servers",
  "Laptops",
  "Desktops",
  "Printers",
  "CCTV Systems",
  "Security Systems",
  "Air Conditioning Units",
  "Heating Systems",
  "Lighting Systems",
  "Warehouse Equipment",
  "Construction Equipment",
  "Power Tools",
  "Hand Tools",
  "Workshop Equipment",

  // Vehicles (AIA eligible except cars)
  "Vans",
  "Lorries",
  "Trucks",
  "Commercial Vehicles",
  "Pickups",
  "Forklifts",

  // Cars (NOT AIA eligible — but still capital allowances)
  "Cars",
  "Motor Vehicles",
  "Company Car",

  // Special Rate Pool (reduced rate)
  "Integral Features",
  "Electrical Systems",
  "Cold Water Systems",
  "Hot Water Systems",
  "Thermal Insulation",
  "Solar Panels",
  "Lift Systems",
  "Escalators",
  "Moving Walkways",

  // Short‑Life Assets (optional election)
  "Short Life Asset",

  // Land & Buildings (NOT CA eligible — but included for future logic)
  // These will be ignored in CA logic but listed for completeness
  "Land",
  "Buildings",
  "Property Improvements",
  "Extensions",
  "Structural Works",
];

const CAPITAL_ALLOWANCE_POOLS: Record<string, "main" | "special" | "cars"> = {
  // Main pool
  "Plant & Machinery": "main",
  Machinery: "main",
  Equipment: "main",
  "Tools & Equipment": "main",
  "Office Equipment": "main",
  "Fixtures & Fittings": "main",
  Furniture: "main",
  "Computer Equipment": "main",
  "IT Equipment": "main",
  Servers: "main",
  Laptops: "main",
  Desktops: "main",
  Printers: "main",
  "CCTV Systems": "main",
  "Security Systems": "main",
  "Warehouse Equipment": "main",
  "Construction Equipment": "main",
  "Power Tools": "main",
  "Hand Tools": "main",
  "Workshop Equipment": "main",

  // Special rate pool
  "Integral Features": "special",
  "Electrical Systems": "special",
  "Cold Water Systems": "special",
  "Hot Water Systems": "special",
  "Thermal Insulation": "special",
  "Solar Panels": "special",
  "Lift Systems": "special",
  Escalators: "special",
  "Moving Walkways": "special",

  // Cars pool
  Cars: "cars",
  "Motor Vehicles": "cars",
  "Company Car": "cars",
};

const CAPITAL_ALLOWANCE_RATES = {
  main: 0.18,
  special: 0.06,
  cars: 0.18, // refine by CO₂ later if needed
};

/* -------------------------------------------------------------------------- */
/*                         CT600A / DLA CONFIG                                */
/* -------------------------------------------------------------------------- */

const DLA_MOVEMENT_ACCOUNTS = [
  "Cash Withdrawals",
  "Director Payments (Disallowable)",
  "Director Personal Expenses",
  "Director Loan – Drawings",
];

const DLA_INTEREST_INCOME_ACCOUNT = "Director Loan – Interest Charged";
const DLA_INTEREST_EXPENSE_ACCOUNT = "Director Loan – Interest Paid";

/* -------------------------------------------------------------------------- */
/*                         CT600L / R&D CONFIG                                */
/* -------------------------------------------------------------------------- */

const R_AND_D_SME_ACCOUNTS = [
  "R&D Staff Costs",
  "R&D Subcontractors",
  "R&D Materials",
  "R&D Software & Cloud",
  "R&D Utilities & Overheads",
  "R&D Prototypes & Testing",
  "R&D Capitalised Costs",
];

const R_AND_D_GRANTS_ACCOUNT = "R&D Grants / Subsidies";

const DEFAULT_R_AND_D_SME_MULTIPLIER = 0.86; // 86% uplift (example)
const DEFAULT_R_AND_D_RDEC_RATE = 0.2; // 20% RDEC rate (example)

/* -------------------------------------------------------------------------- */
/*                         CT600 RATE / ASSOCIATED COS                        */
/* -------------------------------------------------------------------------- */

function computeCorpTaxRate(profit: number, associatedCompanies: number) {
  const n = Math.max(1, (associatedCompanies || 0) + 1);

  const lowerLimit = 50000 / n;
  const upperLimit = 250000 / n;

  const smallRate = 0.19;
  const mainRate = 0.25;

  if (profit <= lowerLimit) return smallRate;
  if (profit >= upperLimit) return mainRate;

  const marginalRelief =
    ((upperLimit - profit) * (mainRate - smallRate)) / upperLimit;

  return mainRate - marginalRelief;
}

/* -------------------------------------------------------------------------- */
/*                               CT600 BUILDER                                */
/* -------------------------------------------------------------------------- */

async function buildCTFormData(
  formCode: string,
  client: any,
  clientId: string,
  periodStart: string,
  periodEnd: string
) {
  const { data: corpSubmission } = await supabaseAdmin
    .from("corp_submissions")
    .select("*")
    .eq("client_id", clientId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  const { data: ctPayments } = await supabaseAdmin
    .from("ct_payments")
    .select("*")
    .eq("client_id", clientId)
    .gte("payment_date", periodStart)
    .lte("payment_date", periodEnd);

  const ctJournals = await loadCTJournals(clientId, periodStart, periodEnd);

  let turnover = 0;
  let nonTradingIncome = 0;
  let allowableExpenses = 0;
  let disallowableExpenses = 0;

  let capitalAllowances = 0;
  let mainPoolAdditions = 0;
  let specialPoolAdditions = 0;
  let carsPoolAdditions = 0;

  let dlaLoansAdvanced = 0;
  let dlaLoansRepaid = 0;
  let dlaInterestCharged = 0;
  let dlaInterestPaid = 0;

  let rAndDSmeSpend = 0;
  let rAndDGrants = 0;

  let dotasFlag = false;
  let charityIncome = 0;
  let royaltyIncome = 0;
  let niTradingFlag = false;

  (ctJournals || []).forEach((j: any) => {
    (j.journal_lines || []).forEach((line: any) => {
      const accountName = line.chart_of_account_entries?.account_name || "";
      const amt = amountFromLine(line);

      // DLA movements
      if (DLA_MOVEMENT_ACCOUNTS.includes(accountName)) {
        if (amt > 0) {
          dlaLoansAdvanced += amt;
        } else if (amt < 0) {
          dlaLoansRepaid += Math.abs(amt);
        }
      }

      if (accountName === DLA_INTEREST_INCOME_ACCOUNT && amt > 0) {
        dlaInterestCharged += amt;
      }

      if (accountName === DLA_INTEREST_EXPENSE_ACCOUNT && amt > 0) {
        dlaInterestPaid += amt;
      }

      // R&D
      if (R_AND_D_SME_ACCOUNTS.includes(accountName) && amt > 0) {
        rAndDSmeSpend += amt;
      }

      if (accountName === R_AND_D_GRANTS_ACCOUNT && amt > 0) {
        rAndDGrants += amt;
      }

      const lowerName = accountName.toLowerCase();

      if (lowerName.includes("dotas")) dotasFlag = true;
      if (lowerName.includes("charity") && amt > 0) charityIncome += amt;
      if (lowerName.includes("royalty") && amt > 0) royaltyIncome += amt;
      if (lowerName.includes("northern ireland")) niTradingFlag = true;

      if (CT_MAP.ignore.includes(accountName)) return;

      if (CT_MAP.revenue.includes(accountName)) {
        turnover += amt;
        return;
      }

      if (CT_MAP.other_income.includes(accountName)) {
        nonTradingIncome += amt;
        return;
      }

      const pool = CAPITAL_ALLOWANCE_POOLS[accountName];
      if (pool) {
        const debit = Math.max(amt, 0);
        if (pool === "main") mainPoolAdditions += debit;
        if (pool === "special") specialPoolAdditions += debit;
        if (pool === "cars") carsPoolAdditions += debit;
        return;
      }

      if (CT_MAP.allowable.includes(accountName)) {
        allowableExpenses += Math.max(amt, 0);
        return;
      }

      if (CT_MAP.disallowable.includes(accountName)) {
        disallowableExpenses += Math.max(amt, 0);
        return;
      }

      return;
    });
  });

  const mainPoolBF = corpSubmission?.ca_main_pool_bf || 0;
  const specialPoolBF = corpSubmission?.ca_special_pool_bf || 0;
  const carsPoolBF = corpSubmission?.ca_cars_pool_bf || 0;
  const aiaClaimed = corpSubmission?.ca_aia_claimed || 0;

  const mainPoolBeforeWDA = mainPoolBF + mainPoolAdditions;
  const specialPoolBeforeWDA = specialPoolBF + specialPoolAdditions;
  const carsPoolBeforeWDA = carsPoolBF + carsPoolAdditions;

  const mainWDA = mainPoolBeforeWDA * (CAPITAL_ALLOWANCE_RATES.main || 0);
  const specialWDA =
    specialPoolBeforeWDA * (CAPITAL_ALLOWANCE_RATES.special || 0);
  const carsWDA = carsPoolBeforeWDA * (CAPITAL_ALLOWANCE_RATES.cars || 0);

  const totalCapitalAllowances = aiaClaimed + mainWDA + specialWDA + carsWDA;

  const mainPoolCF = mainPoolBeforeWDA - mainWDA;
  const specialPoolCF = specialPoolBeforeWDA - specialWDA;
  const carsPoolCF = carsPoolBeforeWDA - carsWDA;

  capitalAllowances = totalCapitalAllowances;

  const computedProfitBeforeCA =
    turnover + nonTradingIncome - allowableExpenses - disallowableExpenses;

  const computedProfit = computedProfitBeforeCA - capitalAllowances;

  const baseProfit =
    corpSubmission?.profit_before_tax != null
      ? corpSubmission.profit_before_tax
      : computedProfit;

  const currentPeriodLoss = baseProfit < 0 ? Math.abs(baseProfit) : 0;

  const lossCarryback = corpSubmission?.loss_carryback || 0;
  const groupRelief = corpSubmission?.group_relief || 0;

  // R&D engine
  const autoRAndDMultiplier =
    corpSubmission?.r_and_d_multiplier != null &&
    corpSubmission.r_and_d_multiplier > 0
      ? corpSubmission.r_and_d_multiplier
      : DEFAULT_R_AND_D_SME_MULTIPLIER;

  const autoTotalRAndDSpend = rAndDSmeSpend;
  const autoRAndDGrants = rAndDGrants;

  const autoSmeQualifyingSpend = Math.max(
    autoTotalRAndDSpend - autoRAndDGrants,
    0
  );

  const autoSmeEnhancedDeduction =
    autoSmeQualifyingSpend * autoRAndDMultiplier;

  const autoRdecQualifyingSpend = Math.max(autoRAndDGrants, 0);
  const autoRdecCredit =
    autoRdecQualifyingSpend * DEFAULT_R_AND_D_RDEC_RATE;

  const autoSmePayableCredit = 0;
  const autoSurrenderedLoss = 0;

  const overrideEnabled =
    corpSubmission?.r_and_d_override_enabled || false;

  const overrideSmeEnhancedDeduction =
    corpSubmission?.r_and_d_override_sme_enhanced_deduction || 0;

  const overrideSmePayableCredit =
    corpSubmission?.r_and_d_override_sme_payable_credit || 0;

  const overrideRdecCredit =
    corpSubmission?.r_and_d_override_rdec_credit || 0;

  const overrideSurrenderedLoss =
    corpSubmission?.r_and_d_override_surrendered_loss || 0;

  const finalSmeEnhancedDeduction = overrideEnabled
    ? overrideSmeEnhancedDeduction
    : autoSmeEnhancedDeduction;

  const finalSmePayableCredit = overrideEnabled
    ? overrideSmePayableCredit
    : autoSmePayableCredit;

  const finalRdecCredit = overrideEnabled
    ? overrideRdecCredit
    : autoRdecCredit;

  const finalSurrenderedLoss = overrideEnabled
    ? overrideSurrenderedLoss
    : autoSurrenderedLoss;

  const rAndDSpend = autoTotalRAndDSpend;
  const rAndDMultiplier = autoRAndDMultiplier;
  const rAndDEnhancedRelief = finalSmeEnhancedDeduction;

  const taxableProfit =
    baseProfit - lossCarryback - groupRelief - rAndDEnhancedRelief;

  const associatedCompanies =
    corpSubmission?.associated_companies_count || 0;

  const taxRate =
    corpSubmission?.corp_tax_rate != null
      ? corpSubmission.corp_tax_rate
      : computeCorpTaxRate(taxableProfit, associatedCompanies);

  const corpTaxDue =
    corpSubmission?.corp_tax_due != null
      ? corpSubmission.corp_tax_due
      : taxableProfit * taxRate;

  const paymentsMade = sumBy(ctPayments || [], "amount");
  const balanceDue = corpTaxDue - paymentsMade;

  const derivedTotalLoans = dlaLoansAdvanced - dlaLoansRepaid;

  const ct600ARequired =
    (corpSubmission?.loans_to_participators != null
      ? corpSubmission.loans_to_participators
      : derivedTotalLoans) !== 0;

  const ct600LRequired = rAndDSpend > 0;
  const ct600JRequired = dotasFlag;
  const ct600FRequired = charityIncome > 0;
  const ct600MRequired = royaltyIncome > 0;
  const ct600NRequired = niTradingFlag;

  return {
    summary: {
      formCode,
      companyName: client.business_name || client.name,
      tradingName: client.trading_name,
      periodStart,
      periodEnd,
      turnover,
      nonTradingIncome,
      expenses: allowableExpenses + disallowableExpenses,
      capitalAllowances: totalCapitalAllowances,
      profitBeforeTax: baseProfit,
      corpTaxDue,
      paymentsMade,
      balanceDue,
    },
    computations: {
      turnover,
      nonTradingIncome,
      allowableExpenses,
      disallowableExpenses,
      capitalAllowances: totalCapitalAllowances,
      adjustedProfit: baseProfit,
      taxableProfit,
      lossCarryback,
      groupRelief,
      rAndDSpend,
      rAndDMultiplier,
      rAndDEnhancedRelief,
      taxRate,
      taxDue: corpTaxDue,
    },
    capitalAllowances: {
      totalCapitalAllowances,
      aiaClaimed,
      mainPool: {
        broughtForward: mainPoolBF,
        additions: mainPoolAdditions,
        wda: mainWDA,
        carriedForward: mainPoolCF,
      },
      specialPool: {
        broughtForward: specialPoolBF,
        additions: specialPoolAdditions,
        wda: specialWDA,
        carriedForward: specialPoolCF,
      },
      carsPool: {
        broughtForward: carsPoolBF,
        additions: carsPoolAdditions,
        wda: carsWDA,
        carriedForward: carsPoolCF,
      },
    },
    losses: {
      currentPeriodLoss,
      broughtForward: corpSubmission?.loss_bf || 0,
      carriedForward:
        corpSubmission?.loss_cf || currentPeriodLoss,
      carryback: lossCarryback,
      groupRelief,
    },
    adjustments: {
      manualAdjustments:
        corpSubmission?.adjustments_total || 0,
    },
    rAndD: {
      totalRAndD: rAndDSpend,
      enhancedRelief: rAndDEnhancedRelief,
      multiplier: rAndDMultiplier,
      sme: {
        qualifyingSpend: autoSmeQualifyingSpend,
        enhancedDeduction: finalSmeEnhancedDeduction,
        payableCredit: finalSmePayableCredit,
        surrenderedLoss: finalSurrenderedLoss,
      },
      rdec: {
        qualifyingSpend: autoRdecQualifyingSpend,
        credit: finalRdecCredit,
      },
      override: {
        enabled: overrideEnabled,
        smeEnhancedDeduction: overrideSmeEnhancedDeduction,
        smePayableCredit: overrideSmePayableCredit,
        rdecCredit: overrideRdecCredit,
        surrenderedLoss: overrideSurrenderedLoss,
      },
      grants: autoRAndDGrants,
    },
    loansToParticipators: {
      totalLoans:
        corpSubmission?.loans_to_participators != null
          ? corpSubmission.loans_to_participators
          : derivedTotalLoans,
      loansAdvanced: dlaLoansAdvanced,
      loansRepaid: dlaLoansRepaid,
      interestCharged: dlaInterestCharged,
      interestPaid: dlaInterestPaid,
    },
    payments: {
      paymentsMade,
      balanceDue,
    },
    disclosures: {
      notes: corpSubmission?.notes || null,
    },
    supplements: {
      ct600ARequired,
      ct600JRequired,
      ct600LRequired,
      ct600FRequired,
      ct600MRequired,
      ct600NRequired,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                         PUBLIC ENGINE WRAPPER                              */
/* -------------------------------------------------------------------------- */

export async function getCt600Data(params: {
  formCode?: string;
  client: any;
  clientId: string;
  periodStart: string;
  periodEnd: string;
}) {
  const { formCode = "CT600", client, clientId, periodStart, periodEnd } = params;

  return buildCTFormData(formCode, client, clientId, periodStart, periodEnd);
}
