// lib/ct/engine.ts

import type { CtComputations } from "./computationsTypes";
import { getCt600Data } from "../ct/ct600Engine";
import { supabaseAdmin } from "../supabase-admin";

export async function computeCtForPeriod(params: {
  clientId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<CtComputations> {
  const { clientId, periodStart, periodEnd } = params;

  // Load client
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  // Load raw CT600 data from your tax engine
  const ctRaw = await getCt600Data({
    formCode: "CT600",
    client,
    clientId,
    periodStart,
    periodEnd,
  });

  const ct = ctRaw as any;
  const c = ct.computations || {};

  /* -------------------------------------------------------------------------- */
  /* NORMALISE ALL CT600 SECTIONS INTO OBJECTS (NOT ARRAYS)                     */
  /* -------------------------------------------------------------------------- */

  const summary = {
    tradingProfit: c.summary?.tradingProfit ?? 0,
    adjustments: c.summary?.adjustments ?? 0,
    capitalAllowances: c.summary?.capitalAllowances ?? 0,
    lossesUsed: c.summary?.lossesUsed ?? 0,
    taxableProfit: c.summary?.taxableProfit ?? 0,
    corporationTaxDue: c.summary?.corporationTaxDue ?? 0,
  };

  const capitalAllowances = {
    total: c.capitalAllowances?.total ?? 0,
    annualInvestmentAllowance: c.capitalAllowances?.annualInvestmentAllowance ?? 0,
    firstYearAllowance: c.capitalAllowances?.firstYearAllowance ?? 0,
  };

  const losses = {
    broughtForward: c.losses?.broughtForward ?? 0,
    used: c.losses?.used ?? 0,
    carriedForward: c.losses?.carriedForward ?? 0,
  };

  const adjustments = {
    disallowableExpenses: c.adjustments?.disallowableExpenses ?? 0,
    other: c.adjustments?.other ?? 0,
  };

  const payments = {
    totalPaid: c.payments?.totalPaid ?? 0,
    balancingDue: c.payments?.balancingDue ?? 0,
  };

  const rAndD = {
    total: c.rAndD?.total ?? 0,
    enhancedDeduction: c.rAndD?.enhancedDeduction ?? 0,
  };

  const loansToParticipators = {
    outstanding: c.loansToParticipators?.outstanding ?? 0,
    writtenOff: c.loansToParticipators?.writtenOff ?? 0,
  };

  const disclosures = {
    charitableDonations: c.disclosures?.charitableDonations ?? 0,
    politicalDonations: c.disclosures?.politicalDonations ?? 0,
  };

  /* -------------------------------------------------------------------------- */
  /* RETURN CT600‑READY COMPUTATION OBJECT                                      */
  /* -------------------------------------------------------------------------- */

  return {
    periodStart,
    periodEnd,

    taxableProfit: summary.taxableProfit,
    corporationTaxDue: summary.corporationTaxDue,

    summary,
    capitalAllowances,
    losses,
    adjustments,
    payments,
    rAndD,
    loansToParticipators,
    disclosures,

    incomeCategories: ct.incomeCategories ?? [],
    paymentsExpanded: ct.paymentsExpanded ?? null,
  };
}
