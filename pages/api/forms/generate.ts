// pages/api/forms/generate.ts
import type { NextApiRequest, NextApiResponse } from "next";
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

type GenerateRequestBody = {
  clientId: string;
  formCode: string;
  periodStart: string;
  periodEnd: string;
};

type ApiResponse =
  | { success: true; pdfUrl: string; submissionId: string }
  | { success: false; message: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const { clientId, formCode, periodStart, periodEnd } =
      req.body as GenerateRequestBody;

    if (!clientId || !formCode || !periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: "Missing clientId, formCode, or period range.",
      });
    }

    const periodStartDate = new Date(periodStart);
    const periodEndDate = new Date(periodEnd);

    if (
      Number.isNaN(periodStartDate.getTime()) ||
      Number.isNaN(periodEndDate.getTime())
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid period start or end date." });
    }

    // 1. Load client
    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("*")
      .eq("id", clientId)
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
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (txError) {
      console.error("Error loading transactions:", txError);
      return res
        .status(500)
        .json({ success: false, message: "Error loading transactions." });
    }

    // 3. Build form data
    let formData: any = {};
    const year = periodEndDate.getFullYear();
    const taxYear = deriveTaxYear(periodEndDate);

    if (formCode.startsWith("CT")) {
      formData = await buildCTFormData(
        formCode,
        client,
        transactions || [],
        clientId,
        periodStart,
        periodEnd
      );
    } else if (formCode.startsWith("SA")) {
      formData = await buildSAFormData(
        formCode,
        client,
        transactions || [],
        clientId,
        periodStart,
        periodEnd
      );
    } else if (formCode.startsWith("CIS")) {
      formData = await buildCISFormData(
        formCode,
        client,
        transactions || [],
        clientId,
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
      clientId,
      periodStart,
      periodEnd,
      year,
      taxYear,
      filename,
      createdBy: "system",
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
  } catch (err: any) {
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
  formCode: string,
  client: any,
  transactions: any[],
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

  const ctTx = transactions.filter((t) => t.includedinct);

  const incomeTx = ctTx.filter((t) => Number(t.amount) > 0);
  const expenseTx = ctTx.filter((t) => Number(t.amount) < 0);

  const turnover = sumBy(incomeTx, "amount");
  const rawExpenses = sumBy(expenseTx, "amount") * -1;

  const allowableExpenses = rawExpenses;
  const disallowableExpenses = 0;

  const computedProfit = turnover - allowableExpenses + disallowableExpenses;
  const profitBeforeTax = corpSubmission?.profit_before_tax ?? computedProfit;

  const currentPeriodLoss = profitBeforeTax < 0 ? Math.abs(profitBeforeTax) : 0;

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
/*                                SA BUILDER                                  */
/* -------------------------------------------------------------------------- */

async function buildSAFormData(
  formCode: string,
  client: any,
  transactions: any[],
  clientId: string,
  periodStart: string,
  periodEnd: string
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

  const saTx = transactions.filter((t) => t.includedinsa);

  const incomeTx = saTx.filter((t) => Number(t.amount) > 0);
  const expenseTx = saTx.filter((t) => Number(t.amount) < 0);

  const turnover = sumBy(incomeTx, "amount");
  const expenses = sumBy(expenseTx, "amount") * -1;

  const profit = turnover - expenses;

  const estimatedTax = saSubmission?.tax_due ?? profit * 0.2;
  const class2NIC = saSubmission?.class2_nic ?? 0;
  const class4NIC = saSubmission?.class4_nic ?? 0;

  const paymentsMade = sumBy(saPayments || [], "amount");
  const balanceDue = estimatedTax + class2NIC + class4NIC - paymentsMade;

  return {
    summary: {
      formCode,
      taxpayerName: client.name,
      utr: client.utr_number,
      address: client.address,
      periodStart,
      periodEnd,
      turnover,
      expenses,
      profit,
      estimatedTax,
      class2NIC,
      class4NIC,
      paymentsMade,
      balanceDue,
    },

    sa103: {
      summary: {
        businessName: client.trading_name || client.name,
        turnover,
        allowableExpenses: expenses,
        disallowableExpenses: 0,
        netProfit: profit,
      },
      turnover: { totalTurnover: turnover },
      allowableExpenses: { totalAllowableExpenses: expenses },
      disallowableExpenses: { totalDisallowableExpenses: 0 },
      capitalAllowances: {
        totalCapitalAllowances: saSubmission?.capital_allowances ?? 0,
      },
      simplifiedExpenses: {
        usingSimplifiedExpenses: saSubmission?.using_simplified_expenses ?? false,
      },
      adjustments: {
        adjustmentsTotal: saSubmission?.adjustments_total ?? 0,
      },
      losses: {
        currentPeriodLoss: profit < 0 ? Math.abs(profit) : 0,
        broughtForward: saSubmission?.loss_bf ?? 0,
        carriedForward:
          saSubmission?.loss_cf ?? (profit < 0 ? Math.abs(profit) : 0),
      },
      class2NIC: { class2NIC },
      class4NIC: { class4NIC },
    },

    sa105: {
      property: {
        rentalIncome: saSubmission?.property_rental_income ?? 0,
        propertyExpenses: saSubmission?.property_expenses ?? 0,
        propertyProfit: saSubmission?.property_profit ?? 0,
      },
    },

    income: {
      employmentIncome: saSubmission?.employment_income ?? 0,
      pensions: saSubmission?.pensions ?? 0,
      dividends: saSubmission?.dividends ?? 0,
      interest: saSubmission?.interest ?? 0,
      otherIncome: saSubmission?.other_income ?? 0,
    },

    capitalGains: {
      totalGains: saSubmission?.capital_gains ?? 0,
    },

    taxCalculation: {
      totalIncome:
        (saSubmission?.employment_income ?? 0) +
        (saSubmission?.pensions ?? 0) +
        (saSubmission?.dividends ?? 0) +
        (saSubmission?.interest ?? 0) +
        (saSubmission?.other_income ?? 0) +
        (saSubmission?.property_rental_income ?? 0) +
        (profit > 0 ? profit : 0),
      allowances: saSubmission?.allowances ?? 0,
      taxableIncome: saSubmission?.taxable_income ?? 0,
      estimatedTax,
      class2NIC,
      class4NIC,
      totalLiability: estimatedTax + class2NIC + class4NIC,
    },

    payments: {
      paymentsOnAccount: saSubmission?.payments_on_account ?? 0,
      paymentsMade,
      balanceDue,
    },

    disclosures: {
      notes: saSubmission?.notes ?? null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*                               CIS BUILDER                                  */
/* -------------------------------------------------------------------------- */

async function buildCISFormData(
  formCode: string,
  client: any,
  transactions: any[],
  clientId: string,
  periodStart: string,
  periodEnd: string
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

  const cisTx = transactions.filter((t) => t.includedincis);

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
/*                               UTILITIES                                     */
/* -------------------------------------------------------------------------- */

function sumBy(items: any[], field: string): number {
  return (items || []).reduce((sum, item) => {
    const val = Number(item[field] ?? 0);
    return Number.isNaN(val) ? sum : sum + val;
  }, 0);
}

function deriveTaxYear(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return month >= 4
    ? `${year}/${String((year + 1) % 100).padStart(2, "0")}`
    : `${year - 1}/${String(year % 100).padStart(2, "0")}`;
}

/* -------------------------------------------------------------------------- */
/*                        PDF TEMPLATE DISPATCHER                              */
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
}: {
  formCode: string;
  client: any;
  clientId: string;
  periodStart: string;
  periodEnd: string;
  year?: number;
  taxYear?: string;
  filename: string;
  createdBy: string;
  formData: any;
}): Promise<any> {
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
      employment: {}, // can be wired later if you capture employment detail separately
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
      subcontractors: [], // to be filled when subcontractor tagging is added
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
