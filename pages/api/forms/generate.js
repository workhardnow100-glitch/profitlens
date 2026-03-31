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
import { generateSa100Pdf } from "../../../lib/pdf/templates/sa100";
import { generateSa103Pdf } from "../../../lib/pdf/templates/sa103";
import { generateSa105Pdf } from "../../../lib/pdf/templates/sa105";
import { generateSa110Pdf } from "../../../lib/pdf/templates/sa110";
import { generateCis300Pdf } from "../../../lib/pdf/templates/cis300";
import { generateCisStatementPdf } from "../../../lib/pdf/templates/cis_statement";

// CT category map
import { CT_MAP } from "../../../lib/ct-map";

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

    await supabaseAdmin.from("audit").insert([
      {
        client_id: resolvedClientId,
        actor_email: session.user.email,
        action: isAccountant ? "ACCOUNTANT_GENERATE_FORM" : "GENERATE_FORM",
        details: `Generated form ${formCode} for ${periodStart} → ${periodEnd}`,
        timestamp: new Date().toISOString(),
      },
    ]);

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
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Unsupported form code." });
    }

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
/*                               CT600 BUILDER                                */
/* -------------------------------------------------------------------------- */

async function buildCTFormData(
  formCode,
  client,
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

  // CT is journal‑driven, filtered by CT toggle on transactions
  const ctJournals = await loadCTJournals(clientId, periodStart, periodEnd);

  let turnover = 0;
  let allowableExpenses = 0;
  let disallowableExpenses = 0;

  (ctJournals || []).forEach((j) => {
    (j.journal_lines || []).forEach((line) => {
      const accountName =
        (line.chart_of_account_entries &&
          line.chart_of_account_entries.account_name) ||
        "";
      const accountType =
        (line.chart_of_account_entries &&
          line.chart_of_account_entries.account_type) ||
        null;
      const amt = amountFromLine(line);

      if (CT_MAP.ignore.includes(accountName)) {
        return;
      }

      if (CT_MAP.revenue.includes(accountName)) {
        turnover += amt;
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

      if (CT_MAP.other_income.includes(accountName)) {
        turnover += amt;
        return;
      }

      if (accountType === "EXPENSE") {
        allowableExpenses += Math.max(amt, 0);
      }
    });
  });

  const computedProfit =
    turnover - allowableExpenses + disallowableExpenses;

  const profitBeforeTax =
    (corpSubmission && corpSubmission.profit_before_tax) != null
      ? corpSubmission.profit_before_tax
      : computedProfit;

  const currentPeriodLoss =
    profitBeforeTax < 0 ? Math.abs(profitBeforeTax) : 0;

  const taxRate =
    (corpSubmission && corpSubmission.corp_tax_rate) != null
      ? corpSubmission.corp_tax_rate
      : 0.19;

  const corpTaxDue =
    (corpSubmission && corpSubmission.corp_tax_due) != null
      ? corpSubmission.corp_tax_due
      : profitBeforeTax * taxRate;

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
      totalCapitalAllowances:
        (corpSubmission && corpSubmission.capital_allowances) || 0,
    },
    losses: {
      currentPeriodLoss,
      broughtForward: (corpSubmission && corpSubmission.loss_bf) || 0,
      carriedForward:
        (corpSubmission && corpSubmission.loss_cf) || currentPeriodLoss,
    },
    adjustments: {
      manualAdjustments:
        (corpSubmission && corpSubmission.adjustments_total) || 0,
    },
    rAndD: {
      totalRAndD: (corpSubmission && corpSubmission.r_and_d_spend) || 0,
    },
    loansToParticipators: {
      totalLoans:
        (corpSubmission && corpSubmission.loans_to_participators) || 0,
    },
    payments: {
      paymentsMade,
      balanceDue,
    },
    disclosures: {
      notes: (corpSubmission && corpSubmission.notes) || null,
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

  const class2NIC =
    (saSubmission && saSubmission.class2_nic) != null
      ? saSubmission.class2_nic
      : 0;
  const class4NIC =
    (saSubmission && saSubmission.class4_nic) != null
      ? saSubmission.class4_nic
      : 0;

  const totalLiability =
    (taxCalculation.estimatedTax || 0) + class2NIC + class4NIC;

  const paymentsOnAccount =
    (saSubmission && saSubmission.payments_on_account) || 0;
  const balanceDue = totalLiability - paymentsMade;

  const summary = {
    formCode,
    taxpayerName: client.name,
    utr: client.utr_number,
    address: client.address,
    periodStart,
    periodEnd,
    turnover: sa103.summary.turnover,
    expenses:
      sa103.summary.allowableExpenses +
      sa103.summary.disallowableExpenses,
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
      notes: (saSubmission && saSubmission.notes) || null,
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

/* --------------------------- Shared helpers ------------------------------- */

function amountFromLine(line) {
  const type =
    (line.chart_of_account_entries &&
      line.chart_of_account_entries.account_type) ||
    null;
  const debit = Number(line.debit || 0);
  const credit = Number(line.credit || 0);

  if (type === "INCOME") {
    return credit - debit;
  }

  if (type === "EXPENSE") {
    return debit - credit;
  }

  return debit - credit;
}

/* -------------------------- SA103 (Self-Employment) ----------------------- */

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

  const rawProfit =
    turnover -
    allowableExpenses -
    disallowableExpenses +
    capitalAllowances +
    adjustments;

  const currentPeriodLoss = rawProfit < 0 ? Math.abs(rawProfit) : 0;
  const lossBF = (saSubmission && saSubmission.loss_bf) || 0;
  const lossCF =
    (saSubmission && saSubmission.loss_cf) ||
    (rawProfit < 0 ? Math.abs(rawProfit) : 0);

  const usingSimplifiedExpenses =
    (saSubmission && saSubmission.using_simplified_expenses) || false;

  const class2NIC =
    (saSubmission && saSubmission.class2_nic) != null
      ? saSubmission.class2_nic
      : 0;
  const class4NIC =
    (saSubmission && saSubmission.class4_nic) != null
      ? saSubmission.class4_nic
      : 0;

  return {
    summary: {
      businessName: client.trading_name || client.name,
      turnover,
      allowableExpenses,
      disallowableExpenses,
      netProfit: rawProfit,
    },
    turnover: { totalTurnover: turnover },
    allowableExpenses: { totalAllowableExpenses: allowableExpenses },
    disallowableExpenses: { totalDisallowableExpenses: disallowableExpenses },
    capitalAllowances: {
      totalCapitalAllowances: capitalAllowances,
    },
    simplifiedExpenses: {
      usingSimplifiedExpenses,
    },
    adjustments: {
      adjustmentsTotal: adjustments,
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

  const propertyExpenses =
    Math.max(propertyAllowable, 0) + Math.max(mortgageInterest, 0);
  const propertyProfit = rentalIncome - propertyExpenses;

  return {
    property: {
      rentalIncome,
      propertyExpenses,
      propertyProfit,
    },
    fhl: {
      income: fhlIncome,
      expenses: Math.max(fhlExpenses, 0),
    },
    rentARoom: {
      income: rentARoomIncome,
      expenses: Math.max(rentARoomExpenses, 0),
    },
    capitalAllowances: propertyCapitalAllowances,
    propertyLosses: propertyLosses,
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
  const saSubmission = params.saSubmission;
  const sa103 = params.sa103;
  const sa105 = params.sa105;
  const income = params.income;
  const capitalGains = params.capitalGains;

  const employmentIncome = income.employmentIncome || 0;
  const pensions = income.pensions || 0;
  const dividends = income.dividends || 0;
  const interest = income.interest || 0;
  const otherIncome = income.otherIncome || 0;

  const propertyRentalIncome =
    (sa105.property && sa105.property.rentalIncome) || 0;
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
        (cisSubmission && cisSubmission.total_payments) || paymentsMade,
    },

    deductions: {
      totalCisDeducted:
        (cisSubmission && cisSubmission.total_cis_deducted) ||
        cisSufferedFromTx,
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
      notes: (cisSubmission && cisSubmission.notes) || null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                        PDF TEMPLATE DISPATCHER                             */
/* -------------------------------------------------------------------------- */

async function generatePdfForForm(params) {
  const formCode = params.formCode;
  const client = params.client;
  const clientId = params.clientId;
  const periodStart = params.periodStart;
  const periodEnd = params.periodEnd;
  const year = params.year;
  const taxYear = params.taxYear;
  const filename = params.filename;
  const createdBy = params.createdBy;
  const formData = params.formData;

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
      selfEmployment: (formData.sa103 && formData.sa103.summary) || {},
      property: (formData.sa105 && formData.sa105.property) || {},
      dividends: { dividends: (formData.income && formData.income.dividends) || 0 },
      interest: { interest: (formData.income && formData.income.interest) || 0 },
      capitalGains: formData.capitalGains,
      adjustments: (formData.sa103 && formData.sa103.adjustments) || {},
      taxCalculation: formData.taxCalculation,
      payments: formData.payments,
      disclosures: formData.disclosures,
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
      payments: formData.payments,
      disclosures: formData.disclosures,
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
      rentalIncome: { totalRentalIncome: property.rentalIncome || 0 },
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
      adjustments: (formData.sa103 && formData.sa103.adjustments) || {},
      payments: formData.payments,
      disclosures: formData.disclosures,
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
      sa110Summary: formData.summary,
      totalIncome: { totalIncome: tc.totalIncome || 0 },
      adjustments: (formData.sa103 && formData.sa103.adjustments) || {},
      allowances: { allowances: tc.allowances || 0 },
      taxableIncome: { taxableIncome: tc.taxableIncome || 0 },
      taxBands: formData.taxBands || {},
      taxDue: { taxDue: tc.estimatedTax || 0 },
      nicClass2: { class2NIC: tc.class2NIC || 0 },
      nicClass4: { class4NIC: tc.class4NIC || 0 },
      paymentsOnAccount: {
        paymentsOnAccount: pay.paymentsOnAccount || 0,
      },
      balancingPayments: { balancingPayments: pay.balanceDue || 0 },
      refunds: {},
      finalLiability: { totalLiability: tc.totalLiability || 0 },
      disclosures: formData.disclosures,
    });
  }

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
