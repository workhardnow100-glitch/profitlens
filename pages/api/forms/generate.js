/**
 * ============================================================
 * File: pages/api/forms/generate.js
 * Purpose:
 *   Generate HMRC-style PDF forms for a specific client:
 *     - CT600 family (Corporation Tax)
 *     - SA100 / SA103 / SA105 / SA110 (Self Assessment)
 *     - CIS300 / CIS_STATEMENT (CIS)
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: POST only.
 *   - Authentication:
 *       • Uses NextAuth session.
 *   - RBAC:
 *       • ACCOUNTANT:
 *           – May generate forms for actingAsClientId.
 *       • USER:
 *           – May generate forms for their own clientId.
 *       • FOUNDER:
 *           – May generate forms for any client.
 *   - Subscription gating:
 *       • USER must be subscribed/trialing.
 *       • ACCOUNTANT + FOUNDER bypass subscription gating.
 *   - Anti‑spoofing:
 *       • Ignores clientId from body; uses session‑resolved clientId only.
 *   - Data handling:
 *       • All reads are client‑scoped via client_id.
 *       • Period range is validated.
 *   - Audit logging:
 *       • Logs GENERATE_FORM / ACCOUNTANT_GENERATE_FORM.
 *
 * Change Control:
 *   - Any change to:
 *       • CT/SA/CIS submission schemas
 *       • PDF templates
 *       • transaction CT/SA/CIS flags
 *     MUST be reflected here and in the Forms UI.
 * ============================================================
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { v4 as uuidv4 } from "uuid";

// PDF templates
import { generateCt600Pdf } from "../../../lib/pdf/templates/ct600";
import { generateSa100Pdf } from "../../../lib/pdf/templates/sa100";
import { generateSa103Pdf } from "../../../lib/pdf/templates/sa103";
import { generateSa105Pdf } from "../../../lib/pdf/templates/sa105";
import { generateSa110Pdf } from "../../../lib/pdf/templates/sa110";
import { generateCis300Pdf } from "../../../lib/pdf/templates/cis300";
import { generateCisStatementPdf } from "../../../lib/pdf/templates/cis_statement";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    // ⭐ Session + RBAC
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
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

    // ⭐ Subscription gating (accountants + founders bypass)
    if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
      return res
        .status(403)
        .json({ success: false, message: "Upgrade required" });
    }

    // ⭐ Accountant-aware client ID — ignore clientId from body for security
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

    // ⭐ Audit log — form generation
    await supabaseAdmin.from("audit").insert([
      {
        client_id: resolvedClientId,
        actor_email: session.user.email,
        action: isAccountant ? "ACCOUNTANT_GENERATE_FORM" : "GENERATE_FORM",
        details: `Generated form ${formCode} for ${periodStart} → ${periodEnd}`,
        timestamp: new Date().toISOString(),
      },
    ]);

    // 1. Load client
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("id", resolvedClientId)
      .single();

    if (clientError || !client) {
      return res
        .status(404)
        .json({ success: false, message: "Client not found." });
    }

    // 2. Load transactions
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

    // 3. Build form data
    let formData = {};
    const year = periodEndDate.getFullYear();
    const taxYear = deriveTaxYear(periodEndDate);

    if (formCode.startsWith("CT")) {
      formData = await buildCTFormData(
        formCode,
        client,
        transactions || [],
        resolvedClientId,
        periodStart,
        periodEnd
      );
    } else if (formCode.startsWith("SA")) {
      formData = await buildSAFormData(
        formCode,
        client,
        transactions || [],
        resolvedClientId,
        periodStart,
        periodEnd,
        taxYear
      );
    } else if (formCode.startsWith("CIS")) {
      formData = await buildCISFormData(
        formCode,
        client,
        transactions || [],
        resolvedClientId,
        periodStart,
        periodEnd
      );
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Unsupported form code." });
    }

    // 4. Generate PDF via template
    const submissionId = uuidv4();
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
      submissionId: record.id ?? submissionId,
    });
  } catch (err) {
    console.error("Unexpected error in /api/forms/generate:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Internal server error.",
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                               CT600 BUILDER                                */
/* -------------------------------------------------------------------------- */

async function buildCTFormData(
  formCode,
  client,
  transactions,
  clientId,
  periodStart,
  periodEnd
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

  const ctTx = (transactions || []).filter((t) => t.includedinct);

  const incomeTx = ctTx.filter((t) => Number(t.amount) > 0);
  const expenseTx = ctTx.filter((t) => Number(t.amount) < 0);

  const turnover = sumBy(incomeTx, "amount");
  const rawExpenses = sumBy(expenseTx, "amount") * -1;

  const allowableExpenses = rawExpenses;
  const disallowableExpenses = 0;

  const computedProfit = turnover - allowableExpenses + disallowableExpenses;
  const profitBeforeTax = corpSubmission?.profit_before_tax ?? computedProfit;

  const currentPeriodLoss =
    profitBeforeTax < 0 ? Math.abs(profitBeforeTax) : 0;

  const taxRate = corpSubmission?.corp_tax_rate ?? 0.19;
  const corpTaxDue = corpSubmission?.corp_tax_due ?? profitBeforeTax * taxRate;

  const paymentsMade = sumBy(ctPayments || [], "amount");
  const balanceDue = corpTaxDue - paymentsMade;

  return {
    summary: {
      formCode,
      companyName: client.business_name || client.name,
      tradingName: client.trading_name,
      periodStart,
      periodEnd,
      turnover,
      expenses: allowableExpenses + disallowableExpenses,
      profitBeforeTax,
      corpTaxDue,
      paymentsMade,
      balanceDue,
    },
    computations: {
      turnover,
      allowableExpenses,
      disallowableExpenses,
      adjustedProfit: profitBeforeTax,
      taxableProfit: profitBeforeTax,
      taxRate,
      taxDue: corpTaxDue,
    },
    capitalAllowances: {
      totalCapitalAllowances: corpSubmission?.capital_allowances ?? 0,
    },
    losses: {
      currentPeriodLoss,
      broughtForward: corpSubmission?.loss_bf ?? 0,
      carriedForward: corpSubmission?.loss_cf ?? currentPeriodLoss,
    },
    adjustments: {
      manualAdjustments: corpSubmission?.adjustments_total ?? 0,
    },
    rAndD: {
      totalRAndD: corpSubmission?.r_and_d_spend ?? 0,
    },
    loansToParticipators: {
      totalLoans: corpSubmission?.loans_to_participators ?? 0,
    },
    payments: {
      paymentsMade,
      balanceDue,
    },
    disclosures: {
      notes: corpSubmission?.notes ?? null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                                SA ENGINE                                   */
/* -------------------------------------------------------------------------- */

async function buildSAFormData(
  formCode,
  client,
  transactions,
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

  const saTx = (transactions || []).filter((t) => t.includedinsa);

  const sa103 = buildSA103FromTransactions(saSubmission, client, saTx);
  const sa105 = buildSA105FromSubmission(saSubmission);
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

  const class2NIC = saSubmission?.class2_nic ?? 0;
  const class4NIC = saSubmission?.class4_nic ?? 0;

  const totalLiability =
    (taxCalculation.estimatedTax ?? 0) + class2NIC + class4NIC;

  const paymentsOnAccount = saSubmission?.payments_on_account ?? 0;
  const balanceDue = totalLiability - paymentsMade;

  const summary = {
    formCode,
    taxpayerName: client.name,
    utr: client.utr_number,
    address: client.address,
    periodStart,
    periodEnd,
    turnover: sa103.summary.turnover,
    expenses: sa103.summary.allowableExpenses + sa103.summary.disallowableExpenses,
    profit: sa103.summary.netProfit,
    estimatedTax: taxCalculation.estimatedTax,
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
      notes: saSubmission?.notes ?? null,
    },
  };
}

/* -------------------------- SA103 (Self-Employment) ----------------------- */

function buildSA103FromTransactions(saSubmission, client, saTx) {
  const incomeTx = saTx.filter((t) => Number(t.amount) > 0);
  const expenseTx = saTx.filter((t) => Number(t.amount) < 0);

  const turnover = sumBy(incomeTx, "amount");
  const expenses = sumBy(expenseTx, "amount") * -1;

  const netProfit = turnover - expenses;

  const capitalAllowances = saSubmission?.capital_allowances ?? 0;
  const usingSimplifiedExpenses =
    saSubmission?.using_simplified_expenses ?? false;
  const adjustmentsTotal = saSubmission?.adjustments_total ?? 0;

  const currentPeriodLoss = netProfit < 0 ? Math.abs(netProfit) : 0;
  const lossBF = saSubmission?.loss_bf ?? 0;
  const lossCF =
    saSubmission?.loss_cf ?? (netProfit < 0 ? Math.abs(netProfit) : 0);

  const class2NIC = saSubmission?.class2_nic ?? 0;
  const class4NIC = saSubmission?.class4_nic ?? 0;

  return {
    summary: {
      businessName: client.trading_name || client.name,
      turnover,
      allowableExpenses: expenses,
      disallowableExpenses: 0,
      netProfit,
    },
    turnover: { totalTurnover: turnover },
    allowableExpenses: { totalAllowableExpenses: expenses },
    disallowableExpenses: { totalDisallowableExpenses: 0 },
    capitalAllowances: {
      totalCapitalAllowances: capitalAllowances,
    },
    simplifiedExpenses: {
      usingSimplifiedExpenses,
    },
    adjustments: {
      adjustmentsTotal,
    },
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

function buildSA105FromSubmission(saSubmission) {
  const rentalIncome = saSubmission?.property_rental_income ?? 0;
  const propertyExpenses = saSubmission?.property_expenses ?? 0;
  const propertyProfit = saSubmission?.property_profit ?? rentalIncome - propertyExpenses;

  return {
    property: {
      rentalIncome,
      propertyExpenses,
      propertyProfit,
    },
  };
}

/* --------------------------- Other Income / Gains ------------------------- */

function buildSAOtherIncome(saSubmission) {
  return {
    employmentIncome: saSubmission?.employment_income ?? 0,
    pensions: saSubmission?.pensions ?? 0,
    dividends: saSubmission?.dividends ?? 0,
    interest: saSubmission?.interest ?? 0,
    otherIncome: saSubmission?.other_income ?? 0,
  };
}

function buildSACapitalGains(saSubmission) {
  return {
    totalGains: saSubmission?.capital_gains ?? 0,
  };
}

/* --------------------------- Tax Calculation (SA) ------------------------- */

function buildSATaxCalculation({
  saSubmission,
  sa103,
  sa105,
  income,
  capitalGains,
}) {
  const employmentIncome = income.employmentIncome ?? 0;
  const pensions = income.pensions ?? 0;
  const dividends = income.dividends ?? 0;
  const interest = income.interest ?? 0;
  const otherIncome = income.otherIncome ?? 0;

  const propertyRentalIncome = sa105.property?.rentalIncome ?? 0;
  const selfEmploymentProfit =
    sa103.summary.netProfit > 0 ? sa103.summary.netProfit : 0;

  const totalIncome =
    employmentIncome +
    pensions +
    dividends +
    interest +
    otherIncome +
    propertyRentalIncome +
    selfEmploymentProfit;

  const allowances = saSubmission?.allowances ?? 0;
  const taxableIncome =
    saSubmission?.taxable_income ?? Math.max(totalIncome - allowances, 0);

  const estimatedTax = saSubmission?.tax_due ?? taxableIncome * 0.2;

  return {
    totalIncome,
    allowances,
    taxableIncome,
    estimatedTax,
    capitalGains: capitalGains.totalGains ?? 0,
  };
}

/* -------------------------------------------------------------------------- */
/*                               CIS BUILDER                                  */
/* -------------------------------------------------------------------------- */

async function buildCISFormData(
  formCode,
  client,
  transactions,
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

  const cisTx = (transactions || []).filter((t) => t.includedincis);

  const cisSufferedFromTx = sumBy(cisTx || [], "cis_amount");
  const paymentsMade = sumBy(cisPayments || [], "amount");
  const adjustmentsTotal = sumBy(cisAdjustments || [], "amount");

  const netCisComputed = cisSufferedFromTx + adjustmentsTotal - paymentsMade;
  const netCis = cisSubmission?.net_cis ?? netCisComputed;

  return {
    summary: {
      formCode,
      contractorName: client.business_name || client.name,
      utr: client.utr_number,
      periodStart,
      periodEnd,
      cisSuffered: cisSufferedFromTx,
      paymentsMade,
      adjustmentsTotal,
      netCis,
    },

    payments: {
      totalPaymentsToSubcontractors:
        cisSubmission?.total_payments ?? paymentsMade,
    },

    deductions: {
      totalCisDeducted:
        cisSubmission?.total_cis_deducted ?? cisSufferedFromTx,
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
      notes: cisSubmission?.notes ?? null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                        PDF TEMPLATE DISPATCHER                             */
/* -------------------------------------------------------------------------- */

async function generatePdfForForm({
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
}) {
  const clientDetails = {
    name: client.name,
    trading_name: client.trading_name,
    business_type: client.business_type,
    utr_number: client.utr_number,
    ni_number: client.ni_number,
    address: client.address || client.registered_address,
    postcode: client.postcode,
    phone: client.phone,
    email: client.email,
  };

  const companyDetails = {
    business_name: client.business_name || client.name,
    trading_name: client.trading_name,
    company_number: client.company_number,
    utr_number: client.utr_number,
    registered_address: client.registered_address || client.address,
    postcode: client.postcode,
    phone: client.phone,
    email: client.email,
    website: client.website,
    contact_person: client.contact_person,
    contact_phone: client.contact_phone,
    contact_email: client.contact_email,
  };

  // CT600 family
  if (formCode.startsWith("CT")) {
    return await generateCt600Pdf({
      clientId,
      year,
      periodStart,
      periodEnd,
      filename,
      createdBy,
      companyDetails,
      ctSummary: formData.summary,
      computations: formData.computations,
      capitalAllowances: formData.capitalAllowances,
      losses: formData.losses,
      adjustments: formData.adjustments,
      rAndD: formData.rAndD,
      loansToParticipators: formData.loansToParticipators,
      payments: formData.payments,
      disclosures: formData.disclosures,
    });
  }

  // SA100
  if (formCode === "SA100") {
    return await generateSa100Pdf({
      clientId,
      taxYear,
      periodStart,
      periodEnd,
      filename,
      createdBy,
      clientDetails,
      saSummary: formData.summary,
      income: formData.income,
      employment: {},
      pensions: {},
      selfEmployment: formData.sa103?.summary || {},
      property: formData.sa105?.property || {},
      dividends: { dividends: formData.income?.dividends ?? 0 },
      interest: { interest: formData.income?.interest ?? 0 },
      capitalGains: formData.capitalGains,
      adjustments: formData.sa103?.adjustments || {},
      taxCalculation: formData.taxCalculation,
      payments: formData.payments,
      disclosures: formData.disclosures,
    });
  }

  // SA103
  if (formCode === "SA103") {
    return await generateSa103Pdf({
      clientId,
      taxYear,
      periodStart,
      periodEnd,
      filename,
      createdBy,
      clientDetails,
      sa103Summary: formData.sa103?.summary,
      turnover: formData.sa103?.turnover,
      allowableExpenses: formData.sa103?.allowableExpenses,
      disallowableExpenses: formData.sa103?.disallowableExpenses,
      capitalAllowances: formData.sa103?.capitalAllowances,
      simplifiedExpenses: formData.sa103?.simplifiedExpenses,
      adjustments: formData.sa103?.adjustments,
      losses: formData.sa103?.losses,
      class2NIC: formData.sa103?.class2NIC,
      class4NIC: formData.sa103?.class4NIC,
      payments: formData.payments,
      disclosures: formData.disclosures,
    });
  }

  // SA105
  if (formCode === "SA105") {
    const property = formData.sa105?.property || {};
    const propertyProfit = property.propertyProfit ?? 0;

    return await generateSa105Pdf({
      clientId,
      taxYear,
      periodStart,
      periodEnd,
      filename,
      createdBy,
      clientDetails,
      sa105Summary: {
        ...formData.summary,
        propertyProfit,
      },
      rentalIncome: { totalRentalIncome: property.rentalIncome ?? 0 },
      furnishedHolidayLettings: {},
      rentARoom: {},
      allowableExpenses: {
        totalAllowableExpenses: property.propertyExpenses ?? 0,
      },
      disallowableExpenses: {},
      mortgageInterest: {},
      capitalAllowances: {},
      propertyLosses: {
        totalPropertyLosses: propertyProfit < 0 ? Math.abs(propertyProfit) : 0,
      },
      jointOwnership: {},
      adjustments: formData.sa103?.adjustments || {},
      payments: formData.payments,
      disclosures: formData.disclosures,
    });
  }

  // SA110
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
      sa110Summary: formData.summary,
      totalIncome: { totalIncome: tc.totalIncome ?? 0 },
      adjustments: formData.sa103?.adjustments || {},
      allowances: { allowances: tc.allowances ?? 0 },
      taxableIncome: { taxableIncome: tc.taxableIncome ?? 0 },
      taxBands: formData.taxBands || {},
      taxDue: { taxDue: tc.estimatedTax ?? 0 },
      nicClass2: { class2NIC: tc.class2NIC ?? 0 },
      nicClass4: { class4NIC: tc.class4NIC ?? 0 },
      paymentsOnAccount: {
        paymentsOnAccount: pay.paymentsOnAccount ?? 0,
      },
      balancingPayments: { balancingPayments: pay.balanceDue ?? 0 },
      refunds: {},
      finalLiability: { totalLiability: tc.totalLiability ?? 0 },
      disclosures: formData.disclosures,
    });
  }

  // CIS300
  if (formCode === "CIS300") {
    return await generateCis300Pdf({
      clientId,
      periodStart,
      periodEnd,
      filename,
      createdBy,
      clientDetails: companyDetails,
      cisSummary: formData.summary,
      subcontractors: [],
      payments: formData.payments,
      deductions: formData.deductions,
      cisSuffered: formData.cisSuffered,
      adjustments: formData.adjustments,
      netCis: formData.netCis,
      disclosures: formData.disclosures,
    });
  }

  // CIS Subcontractor Monthly Statement
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

  throw new Error(`No PDF template configured for formCode: ${formCode}`);
}

/* -------------------------------------------------------------------------- */
/*                               UTILITIES                                    */
/* -------------------------------------------------------------------------- */

function sumBy(items, field) {
  return (items || []).reduce((sum, item) => {
    const val = Number(item[field] ?? 0);
    return Number.isNaN(val) ? sum : sum + val;
  }, 0);
}

function deriveTaxYear(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 4
    ? `${year}/${String((year + 1) % 100).padStart(2, "0")}`
    : `${year - 1}/${String(year % 100).padStart(2, "0")}`;
}
