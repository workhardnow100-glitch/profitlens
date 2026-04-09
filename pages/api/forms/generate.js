/**
 * ============================================================
 * File: pages/api/forms/generate.js
 * Purpose:
 *   Generate HMRC-style PDF forms for a specific client:
 *     - CT600 family (Corporation Tax)
 *     - SA100 / SA103 / SA105 / SA110 (Self Assessment)
 *     - CIS300 / CIS_STATEMENT (CIS)
 * Architecture:
 *   - Journals = accounting truth
 *   - Toggles on transactions = which tax engines a transaction feeds
 *   - COA buckets + CT_MAP + sa_bucket = classification
 *   - CIS amounts = from transactions.cis_amount (hybrid)
 * ============================================================
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { v4 as uuidv4 } from "uuid";



// PDF templates
import { generateCt600Pdf } from "../../../lib/pdf/templates/ct600";
import { generateCt600aPdf } from "../../../lib/pdf/templates/ct600a";
import { generateCt600jPdf } from "../../../lib/pdf/templates/ct600j";
import { generateCt600lPdf } from "../../../lib/pdf/templates/ct600l";
import { generateCt600fPdf } from "../../../lib/pdf/templates/ct600f";
import { generateCt600mPdf } from "../../../lib/pdf/templates/ct600m";
import { generateCt600nPdf } from "../../../lib/pdf/templates/ct600n";

import { generateSa100Pdf } from "../../../lib/pdf/templates/sa100";
import { generateSa103Pdf } from "../../../lib/pdf/templates/sa103";
import { generateSa105Pdf } from "../../../lib/pdf/templates/sa105";
import { generateSa110Pdf } from "../../../lib/pdf/templates/sa110";
import { generateCis300Pdf } from "../../../lib/pdf/templates/cis300";
import { generateCisStatementPdf } from "../../../lib/pdf/templates/cis_statement";
import { generateFrs105AccountsPdf } from "../../../lib/pdf/templates/generateFrs105AccountsPdf";
import { generateFrs1021aAccountsPdf } from "../../../lib/pdf/templates/generateFrs1021aAccountsPdf";


// CT category map
import { CT_MAP } from "../../../lib/constants/ctMap";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }

    const role = (session.user.role || "").toUpperCase();
    const isFounder = role === "FOUNDER";
    const isAccountant = role === "ACCOUNTANT";
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
      session.user.subscriptionStatus
    );

    if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
      return res
        .status(403)
        .json({ success: false, message: "Upgrade required" });
    }

    const resolvedClientId = isAccountant
      ? session.user.actingAsClientId
      : session.user.clientId || session.user.defaultClientId;

    const { formCode, periodStart, periodEnd } = req.body || {};

    if (!resolvedClientId || !formCode || !periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: "Missing client, formCode, or period range.",
      });
    }

    // ✅ Whitelist check
    const validCodes = [
      "CT600","CT600N","SA100","SA103","SA105","SA110",
      "CIS300","CIS_STATEMENT","FRS105","FRS102_1A"
    ];
    if (!validCodes.includes(formCode)) {
      return res.status(400).json({ success: false, message: "Unsupported form code." });
    }

    const periodStartDate = new Date(periodStart);
    const periodEndDate = new Date(periodEnd);

    if (
      Number.isNaN(periodStartDate.getTime()) ||
      Number.isNaN(periodEndDate.getTime()) ||
      periodStartDate > periodEndDate
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid period start or end date." });
    }

    // ✅ Generate submissionId before audit
    const submissionId = uuidv4();

    await supabaseAdmin.from("audit").insert([
      {
        client_id: resolvedClientId,
        actor_email: session.user.email,
        action: isAccountant ? "ACCOUNTANT_GENERATE_FORM" : "GENERATE_FORM",
        details: `Generated form ${formCode} for ${periodStart} → ${periodEnd} (submission ${submissionId})`,
        timestamp: new Date().toISOString(),
      },
    ]);

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("id", resolvedClientId)
      .single();

    if (clientError || !client) {
      console.error("Error loading client:", clientError);
      return res
        .status(404)
        .json({ success: false, message: "Client not found." });
    }

    // Still load transactions once (used for CIS amounts and any other metadata)
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("client_id", resolvedClientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (txError) {
      console.error("Error loading transactions:", txError);
      return res
        .status(500)
        .json({ success: false, message: "Error loading transactions." });
    }

    const year = periodEndDate.getFullYear();
    const taxYear = deriveTaxYear(periodEndDate);

    let formData = {};

    if (formCode.startsWith("CT")) {
      formData = await buildCTFormData(
        formCode,
        client,
        resolvedClientId,
        periodStart,
        periodEnd
      );
    } else if (formCode.startsWith("SA")) {
      formData = await buildSAFormData(
        formCode,
        client,
        resolvedClientId,
        periodStart,
        periodEnd,
        taxYear
      );
    } else if (formCode.startsWith("CIS")) {
      formData = await buildCISFormData(
        formCode,
        client,
        resolvedClientId,
        periodStart,
        periodEnd
      );
    } else if (formCode.startsWith("FRS")) {
      formData = await buildAccountsFormData(
        client,
        resolvedClientId,
        periodStart,
        periodEnd
      );
    }

    const filename = `${submissionId}.pdf`;

    const record = await generatePdfForForm({
      formCode,
      client,
      clientId: resolvedClientId,
      periodStart,
      periodEnd,
      year,
      taxYear,
      filename,
      createdBy: session.user.email || "system",
      formData,
    });

    if (!record || !record.url) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate or store PDF record.",
      });
    }

    return res.status(200).json({
      success: true,
      pdfUrl: record.url,
      submissionId: record.id || submissionId,
    });
  } catch (err) {
    console.error("Unexpected error in /api/forms/generate:", err);
    return res.status(500).json({
      success: false,
      message: err && err.message ? err.message : "Internal server error.",
    });
  }
}


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

const CAPITAL_ALLOWANCE_POOLS = {
  // Main pool
  "Plant & Machinery": "main",
  "Machinery": "main",
  "Equipment": "main",
  "Tools & Equipment": "main",
  "Office Equipment": "main",
  "Fixtures & Fittings": "main",
  "Furniture": "main",
  "Computer Equipment": "main",
  "IT Equipment": "main",
  "Servers": "main",
  "Laptops": "main",
  "Desktops": "main",
  "Printers": "main",
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
  "Escalators": "special",
  "Moving Walkways": "special",

  // Cars pool
  "Cars": "cars",
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

function computeCorpTaxRate(profit, associatedCompanies) {
  // Ensure at least 1 company for threshold scaling
  const n = Math.max(1, associatedCompanies || 1);


  const lowerLimit = 50000 / n;
  const upperLimit = 250000 / n;

  const smallRate = 0.19;
  const mainRate = 0.25;

  // 1. Small profits rate
  if (profit <= lowerLimit) {
    return smallRate;
  }

  // 2. Main rate
  if (profit >= upperLimit) {
    return mainRate;
  }

  // 3. Marginal relief band
  // MR = (UpperLimit - Profit) * (MainRate - SmallRate) / UpperLimit
  const marginalRelief =
    ((upperLimit - profit) * (mainRate - smallRate)) / upperLimit;

  const effectiveRate = mainRate - marginalRelief;

  return effectiveRate;
}

/* -------------------------------------------------------------------------- */
/*                               CT600 BUILDER                                */
/* -------------------------------------------------------------------------- */

// Utility: define once at top, not inside loop
function amountFromLine(line) {
  const type = line.chart_of_account_entries?.account_type || null;
  const debit = Number(line.debit || 0);
  const credit = Number(line.credit || 0);

  if (type === "INCOME") return credit - debit;
  if (type === "EXPENSE") return debit - credit;
  return debit - credit;
}

async function buildCTFormData(
  formCode,
  client,
  clientId,
  periodStart,
  periodEnd,
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

  // CT is journal‑driven, filtered by CT toggle on transactions
  const ctJournals = await loadCTJournals(clientId, periodStart, periodEnd);

  let turnover = 0;
  let nonTradingIncome = 0;
  let allowableExpenses = 0;
  let disallowableExpenses = 0;

  // Capital allowance tracking
  let capitalAllowances = 0;
  let mainPoolAdditions = 0;
  let specialPoolAdditions = 0;
  let carsPoolAdditions = 0;

  // Loans to participators (CT600A)
  let dlaLoansAdvanced = 0;
  let dlaLoansRepaid = 0;
  let dlaInterestCharged = 0;
  let dlaInterestPaid = 0;

  // R&D tracking
  let rAndDSmeSpend = 0;
  let rAndDGrants = 0;

  // Supplements
  let dotasFlag = false;
  let charityIncome = 0;
  let royaltyIncome = 0;
  let niTradingFlag = false;

  (ctJournals || []).forEach((j) => {
    (j.journal_lines || []).forEach((line) => {
      const accountName = line.chart_of_account_entries?.account_name || "";
      const amt = amountFromLine(line);
      const normalizedName = accountName.trim().toLowerCase();

      // --- CT600A / DLA ---
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

      // --- CT600L / R&D ---
      if (R_AND_D_SME_ACCOUNTS.includes(accountName) && amt > 0) {
        rAndDSmeSpend += amt;
      }
      if (accountName === R_AND_D_GRANTS_ACCOUNT && amt > 0) {
        rAndDGrants += amt;
      }

      // --- Supplements ---
      if (normalizedName.includes("dotas")) dotasFlag = true;
      if (normalizedName.includes("charity") && amt > 0) charityIncome += amt;
      if (normalizedName.includes("royalty") && amt > 0) royaltyIncome += amt;
      if (normalizedName.includes("northern ireland")) niTradingFlag = true;

      // --- CT profit classification ---
      if (CT_MAP.ignore.includes(normalizedName)) return;

      if (CT_MAP.revenue.includes(normalizedName)) {
        turnover += amt;
        return;
      }
      if (CT_MAP.other_income.includes(normalizedName)) {
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
      if (CT_MAP.allowable.includes(normalizedName)) {
        allowableExpenses += Math.max(amt, 0);
        return;
      }
      if (CT_MAP.disallowable.includes(normalizedName)) {
        disallowableExpenses += Math.max(amt, 0);
        return;
      }
    });
  });

  // Capital allowance pools
  const mainPoolBF = corpSubmission?.ca_main_pool_bf || 0;
  const specialPoolBF = corpSubmission?.ca_special_pool_bf || 0;
  const carsPoolBF = corpSubmission?.ca_cars_pool_bf || 0;
  const aiaClaimed = corpSubmission?.ca_aia_claimed || 0;

  const mainPoolBeforeWDA = mainPoolBF + mainPoolAdditions;
  const specialPoolBeforeWDA = specialPoolBF + specialPoolAdditions;
  const carsPoolBeforeWDA = carsPoolBF + carsPoolAdditions;

  const mainWDA = mainPoolBeforeWDA * (CAPITAL_ALLOWANCE_RATES.main || 0);
  const specialWDA = specialPoolBeforeWDA * (CAPITAL_ALLOWANCE_RATES.special || 0);
  const carsWDA = carsPoolBeforeWDA * (CAPITAL_ALLOWANCE_RATES.cars || 0);

  const totalCapitalAllowances = aiaClaimed + mainWDA + specialWDA + carsWDA;
  // Define carried forward balances for each pool
const mainPoolCF = mainPoolBeforeWDA - mainWDA;
const specialPoolCF = specialPoolBeforeWDA - specialWDA;
const carsPoolCF = carsPoolBeforeWDA - carsWDA;


  capitalAllowances = totalCapitalAllowances;

  // Profit before capital allowances
  const computedProfitBeforeCA =
    turnover + nonTradingIncome - allowableExpenses + disallowableExpenses;

  // Apply capital allowances
  const computedProfit = computedProfitBeforeCA - capitalAllowances;

  const baseProfit =
    corpSubmission?.profit_before_tax != null
      ? corpSubmission.profit_before_tax
      : computedProfit;

  const currentPeriodLoss = baseProfit < 0 ? Math.abs(baseProfit) : 0;
  const lossCarryback = corpSubmission?.loss_carryback || 0;
  const groupRelief = corpSubmission?.group_relief || 0;

 /* -------------------------- R&D Engine -------------------------- */
const autoRAndDMultiplier =
  corpSubmission?.r_and_d_multiplier && corpSubmission.r_and_d_multiplier > 0
    ? corpSubmission.r_and_d_multiplier
    : DEFAULT_R_AND_D_SME_MULTIPLIER;

const autoTotalRAndDSpend = rAndDSmeSpend;
const autoRAndDGrants = rAndDGrants;

if (autoRAndDGrants > autoTotalRAndDSpend) {
  console.warn("R&D grants exceed total spend — clamped to 0 qualifying spend.");
}

const autoSmeQualifyingSpend = Math.max(autoTotalRAndDSpend - autoRAndDGrants, 0);
const autoSmeEnhancedDeduction = autoSmeQualifyingSpend * autoRAndDMultiplier;

const autoRdecQualifyingSpend = Math.max(autoRAndDGrants, 0);
const autoRdecCredit = autoRdecQualifyingSpend * DEFAULT_R_AND_D_RDEC_RATE;

const autoSmePayableCredit = 0;
const autoSurrenderedLoss = 0;

const overrideEnabled = corpSubmission?.r_and_d_override_enabled || false;
const overrideSmeEnhancedDeduction = corpSubmission?.r_and_d_override_sme_enhanced_deduction || 0;
const overrideSmePayableCredit = corpSubmission?.r_and_d_override_sme_payable_credit || 0;
const overrideRdecCredit = corpSubmission?.r_and_d_override_rdec_credit || 0;
const overrideSurrenderedLoss = corpSubmission?.r_and_d_override_surrendered_loss || 0;

const finalSmeEnhancedDeduction = overrideEnabled ? overrideSmeEnhancedDeduction : autoSmeEnhancedDeduction;
const finalSmePayableCredit = overrideEnabled ? overrideSmePayableCredit : autoSmePayableCredit;
const finalRdecCredit = overrideEnabled ? overrideRdecCredit : autoRdecCredit;
const finalSurrenderedLoss = overrideEnabled ? overrideSurrenderedLoss : autoSurrenderedLoss;

const rAndDSpend = autoTotalRAndDSpend;
const rAndDMultiplier = autoRAndDMultiplier;
const rAndDEnhancedRelief = finalSmeEnhancedDeduction;

const taxableProfit = Math.max(
  baseProfit - lossCarryback - groupRelief - rAndDEnhancedRelief,
  0
);


  const associatedCompanies = corpSubmission?.associated_companies_count || 0;
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

// Derived total loans to participators from journals if not explicitly stored
const derivedTotalLoans = dlaLoansAdvanced - dlaLoansRepaid;

// Supplement detection (engine-wide, journal-driven)
const ct600ARequired =
  (corpSubmission && corpSubmission.loans_to_participators != null
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
    companyName: client?.business_name || client?.name || "",
    tradingName: client?.trading_name || "",
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
    carriedForward: corpSubmission?.loss_cf || currentPeriodLoss,
    carryback: lossCarryback,
    groupRelief,
  },

  adjustments: {
    manualAdjustments: corpSubmission?.adjustments_total || 0,
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
/*                                SA ENGINE                                   */
/* -------------------------------------------------------------------------- */

async function buildSAFormData(
  formCode,
  client,
  clientId,
  periodStart,
  periodEnd,
  taxYear
) {
  const { data: saSubmission } = await supabaseAdmin
    .from("sa_submissions")
    .select("*")
    .eq("client_id", clientId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  const { data: saPayments } = await supabaseAdmin
    .from("sa_payments")
    .select("*")
    .eq("client_id", clientId)
    .gte("payment_date", periodStart)
    .lte("payment_date", periodEnd);

  // SA: journal‑driven + SA toggle
  const journals = await loadSAJournals(clientId, periodStart, periodEnd);

  const sa103 = buildSA103FromJournals(saSubmission, client, journals);
  const sa105 = buildSA105FromJournals(saSubmission, journals);
  const income = buildSAOtherIncome(saSubmission);
  const capitalGains = buildSACapitalGains(saSubmission);

  const paymentsMade = sumBy(saPayments || [], "amount");

  const taxCalculation = buildSATaxCalculation({
    saSubmission,
    sa103,
    sa105,
    income,
    capitalGains,
  });

  const class2NIC = saSubmission?.class2_nic || 0;
  const class4NIC = saSubmission?.class4_nic || 0;

  const totalLiability =
    (taxCalculation.estimatedTax || 0) + class2NIC + class4NIC;

  const paymentsOnAccount = saSubmission?.payments_on_account || 0;
  const balanceDue = totalLiability - paymentsMade;

  const summary = {
    formCode,
    taxpayerName: client?.name || "",
    utr: client?.utr_number || "",
    address: client?.address || client?.registered_address || "",
    periodStart,
    periodEnd,
    turnover: sa103?.summary?.turnover || 0,
    expenses:
      (sa103?.summary?.allowableExpenses || 0) +
      (sa103?.summary?.disallowableExpenses || 0),
    profit: sa103?.summary?.netProfit || 0,
    estimatedTax: taxCalculation.estimatedTax || 0,
    class2NIC,
    class4NIC,
    paymentsMade,
    balanceDue,
  };

  return {
    summary,
    sa103,
    sa105,
    income,
    capitalGains,
    taxCalculation: {
      totalIncome: taxCalculation.totalIncome,
      allowances: taxCalculation.allowances,
      taxableIncome: taxCalculation.taxableIncome,
      estimatedTax: taxCalculation.estimatedTax,
      class2NIC,
      class4NIC,
      totalLiability,
    },
    payments: {
      paymentsOnAccount,
      paymentsMade,
      balanceDue,
    },
    disclosures: {
      notes: saSubmission?.notes || null,
    },
  };
}

/* --------------------------- Journals Loaders ----------------------------- */

async function loadCTJournals(clientId, periodStart, periodEnd) {
  const { data, error } = await supabaseAdmin
    .from("journal_entries")
    .select(
      `
      id,
      date,
      transaction_id,
      journal_lines (
        debit,
        credit,
        chart_of_account_entries (
          account_name,
          account_type
        )
      ),
      transactions!journal_entries_transaction_fk (
        includedinct
      )
    `
    )
    .eq("client_id", clientId)
    .gte("date", periodStart)
    .lte("date", periodEnd)
    .eq("transactions.includedinct", true);

  if (error) {
    console.error("Error loading CT journals:", error);
    return [];
  }

  return data || [];
}

async function loadSAJournals(clientId, periodStart, periodEnd) {
  const { data, error } = await supabaseAdmin
    .from("journal_entries")
    .select(
      `
      id,
      date,
      transaction_id,
      journal_lines (
        debit,
        credit,
        chart_of_account_entries (
          sa_bucket,
          account_type
        )
      ),
      transactions!journal_entries_transaction_fk (
        includedinsa
      )
    `
    )
    .eq("client_id", clientId)
    .gte("date", periodStart)
    .lte("date", periodEnd)
    .eq("transactions.includedinsa", true);

  if (error) {
    console.error("Error loading SA journals:", error);
    return [];
  }

  return data || [];
}


async function loadCISJournals(clientId, periodStart, periodEnd) {
  const { data, error } = await supabaseAdmin
    .from("journal_entries")
    .select(
      `
      id,
      date,
      transaction_id,
      journal_lines (
        debit,
        credit
      ),
      transactions!journal_entries_transaction_fk (
        includedincis,
        cis_amount
      )
    `
    )
    .eq("client_id", clientId)
    .gte("date", periodStart)
    .lte("date", periodEnd)
    .eq("transactions.includedincis", true);

  if (error) {
    console.error("Error loading CIS journals:", error);
    return [];
  }

  return data || [];
}


//* -------------------------- SA103 (Self-Employment) ----------------------- */

function buildSA103FromJournals(saSubmission, client, journals) {
  let turnover = 0;
  let allowable = 0;
  let disallowable = 0;
  let capitalAllowances = 0;
  let adjustments = 0;

  (journals || []).forEach((j) => {
    (j.journal_lines || []).forEach((line) => {
      const bucket =
        (line.chart_of_account_entries &&
          line.chart_of_account_entries.sa_bucket) ||
        null;
      if (!bucket) return;

      const amt = amountFromLine(line);

      switch (bucket) {
        case "sa_se_turnover":
          turnover += amt;
          break;
        case "sa_se_allowable_expense":
          allowable += amt;
          break;
        case "sa_se_disallowable_expense":
          disallowable += amt;
          break;
        case "sa_se_capital_allowance":
          capitalAllowances += amt;
          break;
        case "sa_se_adjustment":
          adjustments += amt;
          break;
        default:
          break;
      }
    });
  });

  const allowableExpenses = Math.max(allowable, 0);
  const disallowableExpenses = Math.max(disallowable, 0);

  // ✅ Correct tax profit formula
  const rawProfit =
    turnover -
    allowableExpenses +
    disallowableExpenses -
    capitalAllowances +
    adjustments;

  const currentPeriodLoss = rawProfit < 0 ? Math.abs(rawProfit) : 0;
const lossBF = saSubmission?.loss_bf || 0;

// If loss_cf is explicitly provided, use it.
// Otherwise, carry forward = brought forward + current period loss.
const lossCF = saSubmission?.loss_cf ?? (lossBF + currentPeriodLoss);


  const usingSimplifiedExpenses =
    (saSubmission && saSubmission.using_simplified_expenses) || false;

  // If simplified expenses are used, override allowableExpenses
  const effectiveAllowableExpenses = usingSimplifiedExpenses
    ? (saSubmission && saSubmission.simplified_expense_amount) || allowableExpenses
    : allowableExpenses;

  const class2NIC =
    saSubmission && saSubmission.class2_nic != null
      ? saSubmission.class2_nic
      : 0;
  const class4NIC =
    saSubmission && saSubmission.class4_nic != null
      ? saSubmission.class4_nic
      : 0;

  return {
    summary: {
      businessName: client?.trading_name || client?.name || "",
      turnover,
      allowableExpenses: effectiveAllowableExpenses,
      disallowableExpenses,
      netProfit: rawProfit,
    },
    turnover: { totalTurnover: turnover },
    allowableExpenses: { totalAllowableExpenses: effectiveAllowableExpenses },
    disallowableExpenses: { totalDisallowableExpenses: disallowableExpenses },
    capitalAllowances: { totalCapitalAllowances: capitalAllowances },
    simplifiedExpenses: { usingSimplifiedExpenses },
    adjustments: { adjustmentsTotal: adjustments },
    losses: {
      currentPeriodLoss,
      broughtForward: lossBF,
      carriedForward: lossCF,
    },
    class2NIC: { class2NIC },
    class4NIC: { class4NIC },
  };
}


/* ----------------------------- SA105 (Property) --------------------------- */

function buildSA105FromJournals(saSubmission, journals) {
  let rentalIncome = 0;
  let fhlIncome = 0;
  let rentARoomIncome = 0;

  let propertyAllowable = 0;
  let mortgageInterest = 0;
  let fhlExpenses = 0;
  let rentARoomExpenses = 0;
  let propertyCapitalAllowances = 0;
  let propertyLosses = 0;

  (journals || []).forEach((j) => {
    (j.journal_lines || []).forEach((line) => {
      const bucket =
        (line.chart_of_account_entries &&
          line.chart_of_account_entries.sa_bucket) ||
        null;
      if (!bucket) return;

      const amt = amountFromLine(line);

      switch (bucket) {
        case "sa_property_rental_income":
          rentalIncome += amt;
          break;
        case "sa_property_fhl_income":
          fhlIncome += amt;
          break;
        case "sa_property_rent_a_room_income":
          rentARoomIncome += amt;
          break;

        case "sa_property_allowable_expense":
          propertyAllowable += amt;
          break;
        case "sa_property_mortgage_interest":
          mortgageInterest += amt;
          break;
        case "sa_property_fhl_expense":
          fhlExpenses += amt;
          break;
        case "sa_property_rent_a_room_expense":
          rentARoomExpenses += amt;
          break;
        case "sa_property_capital_allowance":
          propertyCapitalAllowances += amt;
          break;
        case "sa_property_loss":
          propertyLosses += amt;
          break;
        default:
          break;
      }
    });
  });

  // Core property profit
  const propertyExpenses = Math.max(propertyAllowable, 0);
  const propertyProfit =
    rentalIncome - propertyExpenses - Math.max(propertyCapitalAllowances, 0) - Math.max(propertyLosses, 0);

  // Mortgage interest is a tax credit, not an expense
  const mortgageCredit = Math.max(mortgageInterest, 0) * 0.20;

  // FHL net profit
  const fhlProfit = fhlIncome - Math.max(fhlExpenses, 0);

  // Rent-a-Room relief
  let netRentARoom = rentARoomIncome - Math.max(rentARoomExpenses, 0);
  if (netRentARoom > 7500) netRentARoom -= 7500;

  return {
    property: {
      rentalIncome,
      allowableExpenses: propertyAllowable,
      capitalAllowances: propertyCapitalAllowances,
      losses: propertyLosses,
      profit: propertyProfit,
    },
    fhl: {
      income: fhlIncome,
      expenses: Math.max(fhlExpenses, 0),
      profit: fhlProfit,
    },
    rentARoom: {
      income: rentARoomIncome,
      expenses: Math.max(rentARoomExpenses, 0),
      netIncome: netRentARoom,
    },
    mortgageCredit,
  };
}



/* --------------------------- Other Income / Gains ------------------------- */

function buildSAOtherIncome(saSubmission) {
  return {
    employmentIncome:
      (saSubmission && saSubmission.employment_income) || 0,
    pensions: (saSubmission && saSubmission.pensions) || 0,
    dividends: (saSubmission && saSubmission.dividends) || 0,
    interest: (saSubmission && saSubmission.interest) || 0,
    otherIncome: (saSubmission && saSubmission.other_income) || 0,
  };
}

function buildSACapitalGains(saSubmission) {
  return {
    totalGains: (saSubmission && saSubmission.capital_gains) || 0,
  };
}

/* --------------------------- Tax Calculation (SA) ------------------------- */

function buildSATaxCalculation(params) {
  const saSubmission = params.saSubmission || null;
  const sa103 = params.sa103 || null;
  const sa105 = params.sa105 || null;
  const income = params.income || {};
  const capitalGains = params.capitalGains || {};

  const employmentIncome = income.employmentIncome || 0;
  const pensions = income.pensions || 0;
  const dividends = income.dividends || 0;
  const interest = income.interest || 0;
  const otherIncome = income.otherIncome || 0;

  const propertyRentalIncome =
    (sa105 && sa105.property && sa105.property.rentalIncome) || 0;

  const seNetProfit =
    (sa103 && sa103.summary && sa103.summary.netProfit) || 0;
  const selfEmploymentProfit = seNetProfit > 0 ? seNetProfit : 0;

  const totalIncome =
    employmentIncome +
    pensions +
    dividends +
    interest +
    otherIncome +
    propertyRentalIncome +
    selfEmploymentProfit;

  const allowances =
    (saSubmission && saSubmission.allowances) != null
      ? saSubmission.allowances
      : 12570;

  const taxableIncome =
    (saSubmission && saSubmission.taxable_income) != null
      ? saSubmission.taxable_income
      : Math.max(totalIncome - allowances, 0);

  const estimatedTax =
    (saSubmission && saSubmission.tax_due) != null
      ? saSubmission.tax_due
      : taxableIncome * 0.2;

  return {
    totalIncome,
    allowances,
    taxableIncome,
    estimatedTax,
    capitalGains: capitalGains.totalGains || 0,
  };
}

/* -------------------------------------------------------------------------- */
/*                               CIS BUILDER                                  */
/* -------------------------------------------------------------------------- */

async function buildCISFormData(
  formCode,
  client,
  clientId,
  periodStart,
  periodEnd
) {
  const { data: cisSubmission } = await supabaseAdmin
    .from("cis_submissions")
    .select("*")
    .eq("client_id", clientId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();

  const { data: cisPayments } = await supabaseAdmin
    .from("cis_payments")
    .select("*")
    .eq("client_id", clientId)
    .gte("payment_date", periodStart)
    .lte("payment_date", periodEnd);

  const { data: cisAdjustments } = await supabaseAdmin
    .from("cis_adjustments")
    .select("*")
    .eq("client_id", clientId);

  // CIS: journals + toggle for inclusion, but amounts from transaction.cis_amount
  const cisJournals = await loadCISJournals(clientId, periodStart, periodEnd);

  let cisSufferedFromTx = 0;
  (cisJournals || []).forEach((j) => {
    const tx = j.transactions;
    if (!tx) return;
    const amt = Number(tx.cis_amount || 0);
    if (!Number.isNaN(amt)) {
      cisSufferedFromTx += amt;
    }
  });

  const paymentsMade = sumBy(cisPayments || [], "amount");
  const adjustmentsTotal = sumBy(cisAdjustments || [], "amount");

  const netCisComputed =
    cisSufferedFromTx + adjustmentsTotal - paymentsMade;
  const netCis =
    (cisSubmission && cisSubmission.net_cis) != null
      ? cisSubmission.net_cis
      : netCisComputed;


  return {
  summary: {
    formCode,
    contractorName: client?.business_name || client?.name || "",
    utr: client?.utr_number || "",
    periodStart,
    periodEnd,
    cisSuffered: cisSufferedFromTx,
    paymentsMade,
    adjustmentsTotal,
    netCis,
  },

  payments: {
    totalPaymentsToSubcontractors:
      cisSubmission?.total_payments || paymentsMade,
  },

  deductions: {
    totalCisDeducted:
      cisSubmission?.total_cis_deducted || cisSufferedFromTx,
  },

  cisSuffered: {
    cisSufferedFromTransactions: cisSufferedFromTx,
  },

  adjustments: {
    totalAdjustments: adjustmentsTotal,
  },

  netCis: {
    netCis,
  },

  disclosures: {
    notes: cisSubmission?.notes || null,
  },
};

}

// ---------------- ACCOUNTS BUILDER ----------------
async function buildAccountsFormData(client, clientId, periodStart, periodEnd) {
  // Current year journals
  const { data: journals, error } = await supabaseAdmin
    .from("journal_entries")
    .select(`
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
    `)
    .eq("client_id", clientId)
    .gte("date", periodStart)
    .lte("date", periodEnd);

  if (error) {
    console.error("Error loading Accounts journals:", error);
    return { overview: { totals: {} }, overviewPrior: { totals: {} } };
  }

  // Helper to compute totals + accounts from journals
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

    (journals || []).forEach(j => {
      (j.journal_lines || []).forEach(line => {
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        const type = (line.chart_of_account_entries?.account_type || "").toUpperCase();
        const bucket = (line.chart_of_account_entries?.hmrc_bucket || "").toLowerCase();
        const code = line.chart_of_account_entries?.account_code;

        if (code) {
          accounts[code] = (accounts[code] || 0) + (debit - credit);
        }

        // Grouping logic based on your schema
        if (bucket === "fixed_asset") totals.totalFixedAssets += debit - credit;
        if (bucket === "fixed_asset_contra") totals.totalFixedAssets -= (debit - credit);

        if (bucket === "assets" || type === "BANK" || type === "ACCOUNTS_RECEIVABLE") {
          totals.totalCurrentAssets += debit - credit;
        }

        if (bucket === "liabilities" || type === "ACCOUNTS_PAYABLE" || type === "LIABILITY") {
          totals.totalCurrentLiabilities += credit - debit;
        }

        if (bucket === "equity" || type === "EQUITY") {
          totals.totalEquity += credit - debit;
        }

        // Grand totals
        if (type === "ASSET") totals.totalAssets += debit - credit;
        if (type === "LIABILITY") totals.totalLiabilities += credit - debit;
      });
    });

    return { totals, accounts };
  }

  // Compute current year
  const current = computeFromJournals(journals);

  // Prior year journals
  const priorYearStart = new Date(periodStart);
  priorYearStart.setFullYear(priorYearStart.getFullYear() - 1);
  const priorYearEnd = new Date(periodEnd);
  priorYearEnd.setFullYear(priorYearEnd.getFullYear() - 1);

  const { data: priorJournals } = await supabaseAdmin
    .from("journal_entries")
    .select(`
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
    `)
    .eq("client_id", clientId)
    .gte("date", priorYearStart.toISOString().split("T")[0])
    .lte("date", priorYearEnd.toISOString().split("T")[0]);

  const prior = computeFromJournals(priorJournals);

  // If accounts_submissions exists, override prior totals
  const { data: priorSubmission } = await supabaseAdmin
    .from("accounts_submissions")
    .select("*")
    .eq("client_id", clientId)
    .eq("period_end", priorYearEnd.toISOString().split("T")[0])
    .maybeSingle();

  if (priorSubmission) {
    prior.totals.totalAssets = priorSubmission.total_assets || prior.totals.totalAssets;
    prior.totals.totalLiabilities = priorSubmission.total_liabilities || prior.totals.totalLiabilities;
    prior.totals.totalEquity = priorSubmission.total_equity || prior.totals.totalEquity;
    prior.totals.totalFixedAssets = priorSubmission.fixed_assets || prior.totals.totalFixedAssets;
    prior.totals.totalCurrentAssets = priorSubmission.current_assets || prior.totals.totalCurrentAssets;
    prior.totals.totalCurrentLiabilities = priorSubmission.current_liabilities || prior.totals.totalCurrentLiabilities;
    prior.totals.totalNonCurrentLiabilities = priorSubmission.non_current_liabilities || prior.totals.totalNonCurrentLiabilities;
    prior.accounts = priorSubmission.accounts || prior.accounts;
  }

  const payload = {
    overview: {
      totals: {
        non_current_assets: current.totals.totalFixedAssets,
        current_assets: current.totals.totalCurrentAssets,
        total_assets: current.totals.totalAssets,
        current_liabilities: current.totals.totalCurrentLiabilities,
        non_current_liabilities: current.totals.totalNonCurrentLiabilities,
        total_liabilities: current.totals.totalLiabilities,
        total_equity: current.totals.totalEquity,
        capital_and_reserves: current.totals.totalEquity,
      },
      accounts: current.accounts,
    },
    overviewPrior: {
      totals: {
        non_current_assets: prior.totals.totalFixedAssets,
        current_assets: prior.totals.totalCurrentAssets,
        total_assets: prior.totals.totalAssets,
        current_liabilities: prior.totals.totalCurrentLiabilities,
        non_current_liabilities: prior.totals.totalNonCurrentLiabilities,
        total_liabilities: prior.totals.totalLiabilities,
        total_equity: prior.totals.totalEquity,
      },
      accounts: prior.accounts,
    },
    notes: {
      accountingPolicies: "These accounts have been prepared in accordance with FRS 105.",
      employees: client?.employees_current_year || 0,
      taxation: "Corporation tax is provided at amounts expected to be paid using enacted rates.",
      debtors: client?.debtors_total || 0,
      creditors: client?.creditors_total || 0,
    },
    directorApproval: {
      approvedBy: client?.director_name || "Director",
      signature: client?.director_signature_name || "Signature",
      approvalDate: client?.accounts_approval_date
        ? client.accounts_approval_date.toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      statement: "The directors acknowledge their responsibilities under the Companies Act 2006.",
    },
  };

  console.log("Accounts generate payload:", JSON.stringify(payload, null, 2));
  return payload;
}


/* -------------------------------------------------------------------------- */
/*                        PDF TEMPLATE DISPATCHER                             */
/* -------------------------------------------------------------------------- */

async function generatePdfForForm(params) {
  const {
    formCode,
    client,
    clientId,
    periodStart,
    periodEnd,
    year,
    taxYear,
    filename,
    createdBy,
    formData,
  } = params;

  const clientDetails = {
    name: client?.name || "",
    trading_name: client?.trading_name || "",
    business_type: client?.business_type || "",
    utr_number: client?.utr_number || "",
    ni_number: client?.ni_number || "",
    address: client?.address || client?.registered_address || "",
    postcode: client?.postcode || "",
    phone: client?.phone || "",
    email: client?.email || "",
  };

  const companyDetails = {
    business_name: client?.business_name || client?.name || "",
    trading_name: client?.trading_name || "",
    company_number: client?.company_number || "",
    utr_number: client?.utr_number || "",
    registered_address: client?.registered_address || client?.address || "",
    postcode: client?.postcode || "",
    phone: client?.phone || "",
    email: client?.email || "",
    website: client?.website || "",
    contact_person: client?.contact_person || "",
    contact_phone: client?.contact_phone || "",
    contact_email: client?.contact_email || "",
  };

  // ---------------- CT600 FAMILY ----------------
if (formCode === "CT600") {
  return await generateCt600Pdf({
    clientId,
    year,
    periodStart,
    periodEnd,
    filename,
    createdBy,
    companyDetails,

    ctSummary: formData.summary || {},
    computations: formData.computations || {},
    capitalAllowances: formData.capitalAllowances || {},
    losses: formData.losses || {},
    adjustments: formData.adjustments || {},
    rAndD: formData.rAndD || {},
    loansToParticipators: formData.loansToParticipators || {},
    payments: formData.payments || {},
    disclosures: formData.disclosures || {},

    supplements: formData.supplements || {},
  });
}


if (formCode === "CT600N") {
  return await generateCt600nPdf({
    clientId,
    year,
    periodStart,
    periodEnd,
    filename,
    createdBy,
    companyDetails,
    niRate: formData.niRate || {},
    disclosures: formData.disclosures || {},
  });
}

// ---------------- SA FAMILY ----------------

if (formCode === "SA100") {
  return await generateSa100Pdf({
    clientId,
    taxYear,
    periodStart,
    periodEnd,
    filename,
    createdBy,
    clientDetails,
    saSummary: formData.summary || {},
    income: formData.income || {},
    employment: {},
    pensions: {},
    selfEmployment: (formData.sa103 && formData.sa103.summary) || {},
    property: (formData.sa105 && formData.sa105.property) || {},
    dividends: {
      dividends:
        (formData.income && formData.income.dividends) || 0,
    },
    interest: {
      interest:
        (formData.income && formData.income.interest) || 0,
    },
    capitalGains: formData.capitalGains || {},
    adjustments:
      (formData.sa103 && formData.sa103.adjustments) || {},
    taxCalculation: formData.taxCalculation || {},
    payments: formData.payments || {},
    disclosures: formData.disclosures || {},
  });
}

if (formCode === "SA103") {
  return await generateSa103Pdf({
    clientId,
    taxYear,
    periodStart,
    periodEnd,
    filename,
    createdBy,
    clientDetails,
    sa103Summary: formData.sa103 && formData.sa103.summary,
    turnover: formData.sa103 && formData.sa103.turnover,
    allowableExpenses:
      formData.sa103 && formData.sa103.allowableExpenses,
    disallowableExpenses:
      formData.sa103 && formData.sa103.disallowableExpenses,
    capitalAllowances:
      formData.sa103 && formData.sa103.capitalAllowances,
    simplifiedExpenses:
      formData.sa103 && formData.sa103.simplifiedExpenses,
    adjustments: formData.sa103 && formData.sa103.adjustments,
    losses: formData.sa103 && formData.sa103.losses,
    class2NIC: formData.sa103 && formData.sa103.class2NIC,
    class4NIC: formData.sa103 && formData.sa103.class4NIC,
    payments: formData.payments || {},
    disclosures: formData.disclosures || {},
  });
}

if (formCode === "SA105") {
  const property = (formData.sa105 && formData.sa105.property) || {};
  const propertyProfit =
    property.propertyProfit != null ? property.propertyProfit : 0;

  return await generateSa105Pdf({
    clientId,
    taxYear,
    periodStart,
    periodEnd,
    filename,
    createdBy,
    clientDetails,
    sa105Summary: {
      ...(formData.summary || {}),
      propertyProfit,
    },
    rentalIncome: {
      totalRentalIncome: property.rentalIncome || 0,
    },
    furnishedHolidayLettings: {},
    rentARoom: {},
    allowableExpenses: {
      totalAllowableExpenses: property.propertyExpenses || 0,
    },
    disallowableExpenses: {},
    mortgageInterest: {},
    capitalAllowances: {},
    propertyLosses: {
      totalPropertyLosses:
        propertyProfit < 0 ? Math.abs(propertyProfit) : 0,
    },
    jointOwnership: {},
    adjustments:
      (formData.sa103 && formData.sa103.adjustments) || {},
    payments: formData.payments || {},
    disclosures: formData.disclosures || {},
  });
}

if (formCode === "SA110") {
  const tc = formData.taxCalculation || {};
  const pay = formData.payments || {};

  return await generateSa110Pdf({
    clientId,
    taxYear,
    periodStart,
    periodEnd,
    filename,
    createdBy,
    clientDetails,
    sa110Summary: formData.summary || {},
    totalIncome: { totalIncome: tc.totalIncome || 0 },
    adjustments:
      (formData.sa103 && formData.sa103.adjustments) || {},
    allowances: { allowances: tc.allowances || 0 },
    taxableIncome: { taxableIncome: tc.taxableIncome || 0 },
    taxBands: formData.taxBands || {},
    taxDue: { taxDue: tc.estimatedTax || 0 },
    nicClass2: { class2NIC: tc.class2NIC || 0 },
    nicClass4: { class4NIC: tc.class4NIC || 0 },
    paymentsOnAccount: {
      paymentsOnAccount: pay.paymentsOnAccount || 0,
    },
    balancingPayments: {
      balancingPayments: pay.balanceDue || 0,
    },
    refunds: {},
    finalLiability: {
      totalLiability: tc.totalLiability || 0,
    },
    disclosures: formData.disclosures || {},
  });
}

// ---------------- CIS FAMILY ----------------

if (formCode === "CIS300") {
  return await generateCis300Pdf({
    clientId,
    periodStart,
    periodEnd,
    filename,
    createdBy,
    clientDetails: companyDetails,
    cisSummary: formData.summary || {},
    subcontractors: [],
    payments: formData.payments || {},
    deductions: formData.deductions || {},
    cisSuffered: formData.cisSuffered || {},
    adjustments: formData.adjustments || {},
    netCis: formData.netCis || {},
    disclosures: formData.disclosures || {},
  });
}

if (formCode === "CIS_STATEMENT") {
  return await generateCisStatementPdf({
    clientId,
    periodStart,
    periodEnd,
    filename,
    createdBy,
    contractorDetails: companyDetails,
    subcontractorDetails: {},
    paymentDetails: {},
    materials: {},
    cisDeducted: {},
    verification: {},
    adjustments: {},
    netPayment: {},
    disclosures: {},
  });
}





// ---------------- PDF GENERATION ----------------
if (formCode === "FRS105") {
  return await generateFrs105AccountsPdf({
    clientId,
    year,
    periodStart,
    periodEnd,
    filename,
    createdBy,
    companyDetails: client,
    overview: formData.overview,
    overviewPrior: formData.overviewPrior,
    notes: formData.notes || {},
    directorApproval: formData.directorApproval || {},
    framework: "FRS105",
  });
}

if (formCode === "FRS102_1A") {
  return await generateFrs1021aAccountsPdf({
    clientId,
    year,
    periodStart,
    periodEnd,
    filename,
    createdBy,
    companyDetails: client,
    overview: formData.overview,
    overviewPrior: formData.overviewPrior,
    notes: formData.notes || {},
    directorApproval: formData.directorApproval || {},
    framework: "FRS102_1A",
  });
}



throw new Error("No PDF template configured for formCode: " + formCode);


}

/* -------------------------------------------------------------------------- */
/*                               UTILITIES                                    */
/* -------------------------------------------------------------------------- */

function sumBy(items, field) {
  return (items || []).reduce((sum, item) => {
    const val = Number(item[field] || 0);
    if (Number.isNaN(val)) return sum;
    return sum + val;
  }, 0);
}

function deriveTaxYear(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 4) {
    return (
      year +
      "/" +
      String((year + 1) % 100)
        .toString()
        .padStart(2, "0")
    );
  }
  return (
    year - 1 +
    "/" +
    String(year % 100)
      .toString()
      .padStart(2, "0")
  );
}
