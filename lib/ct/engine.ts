// lib/ct/engine.ts

/**
 * CT COMPUTATION ENGINE WRAPPER (MASTER OUTPUT NORMALISER)
 * ---------------------------------------------------------
 * PURPOSE:
 *   Converts the legacy CT600 engine output (buildCTFormData) into the
 *   canonical CtComputations structure used by:
 *
 *     - CT600 XML builder
 *     - CT computations iXBRL builder
 *     - CT600 PDF generator
 *     - CT pack generator
 *
 * WHY THIS FILE MATTERS:
 *   This is the *single point* where all CT computations are normalised into
 *   the official ProfitLens data model. Any mismatch here causes:
 *     - XML failures
 *     - iXBRL inconsistencies
 *     - PDF mismatches
 *
 * INPUT:
 *   - clientId
 *   - periodStart
 *   - periodEnd
 *
 * OUTPUT:
 *   CtComputations (full accountant‑grade model)
 *
 * VALIDATION STATUS:
 *   ✓ Fully aligned with upgraded ct600Engine.ts
 *   ✓ Supports full adjustments model
 *   ✓ Supports full R&D model
 *   ✓ Supports full capital allowances model
 *   ✓ Supports supplements
 *   ☐ HMRC schema validation pending
 */

import { CtComputations } from "./computationsTypes";
import { getCt600Data } from "./ct600Engine";
import { supabaseAdmin } from "../supabase-admin";

export async function computeCtForPeriod(params: {
  clientId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<CtComputations> {
  const { clientId, periodStart, periodEnd } = params;

  // ------------------------------------------------------------
  // 1. LOAD CLIENT
  // ------------------------------------------------------------
  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !client) {
    throw new Error("Client not found for CT computations.");
  }

  // ------------------------------------------------------------
  // 2. LOAD RAW CT600 ENGINE OUTPUT
  // ------------------------------------------------------------
  const ctRaw = await getCt600Data({
    formCode: "CT600",
    client,
    clientId,
    periodStart,
    periodEnd,
  });

  const ct = ctRaw as any;
  const computations = (ct.computations || {}) as any;

  // ------------------------------------------------------------
  // 3. NORMALISE DISCLOSURES
  // ------------------------------------------------------------
  const rawDisclosures = ct.disclosures;
  let disclosures: any[] = [];

  if (Array.isArray(rawDisclosures)) {
    disclosures = rawDisclosures;
  } else if (rawDisclosures?.notes) {
    disclosures = Array.isArray(rawDisclosures.notes)
      ? rawDisclosures.notes
      : [rawDisclosures.notes];
  }

  // ------------------------------------------------------------
  // 4. RETURN FULL CtComputations MODEL
  // ------------------------------------------------------------
  return {
    periodStart,
    periodEnd,

    // ------------------------------------------------------------
    // HEADLINE FIGURES
    // ------------------------------------------------------------
    taxableProfit: computations.taxableProfit ?? 0,
    corporationTaxDue: computations.taxDue ?? 0,

    // ------------------------------------------------------------
    // SUMMARY
    // ------------------------------------------------------------
    summary: ct.summary ?? null,

    // ------------------------------------------------------------
    // COMPUTATIONS (HIGH‑LEVEL)
    // ------------------------------------------------------------
    computations: {
      taxableProfit: computations.taxableProfit ?? 0,
      taxDue: computations.taxDue ?? 0,
      turnover: computations.turnover ?? 0,
      allowableExpenses: computations.allowableExpenses ?? 0,
      lossCarryback: computations.lossCarryback ?? 0,
      groupRelief: computations.groupRelief ?? 0,
    },

    // ------------------------------------------------------------
    // CAPITAL ALLOWANCES
    // ------------------------------------------------------------
    capitalAllowances: ct.capitalAllowances ?? null,

    // ------------------------------------------------------------
    // LOSSES
    // ------------------------------------------------------------
    losses: ct.losses ?? null,

    // ------------------------------------------------------------
    // ADJUSTMENTS (FULL MODEL)
    // ------------------------------------------------------------
    adjustments: {
      nonDeductibleExpenses:
        ct.adjustments?.nonDeductibleExpenses ??
        ct.adjustments?.disallowableExpenses ??
        0,

      nonTaxableIncomeDeduction:
        ct.adjustments?.nonTaxableIncomeDeduction ?? 0,

      otherAdjustments:
        ct.adjustments?.otherAdjustments ??
        ct.adjustments?.manualAdjustments ??
        0,

      // Legacy compatibility
      disallowableExpenses:
        ct.adjustments?.disallowableExpenses ??
        ct.adjustments?.nonDeductibleExpenses ??
        0,
    },

    // ------------------------------------------------------------
    // R&D
    // ------------------------------------------------------------
    rAndD: ct.rAndD ?? null,

    // ------------------------------------------------------------
    // LOANS TO PARTICIPATORS
    // ------------------------------------------------------------
    loansToParticipators: ct.loansToParticipators ?? null,

    // ------------------------------------------------------------
    // PAYMENTS
    // ------------------------------------------------------------
    payments: ct.payments ?? null,

    // ------------------------------------------------------------
    // DISCLOSURES
    // ------------------------------------------------------------
    disclosures,

    // ------------------------------------------------------------
    // INCOME CATEGORIES (future)
    // ------------------------------------------------------------
    incomeCategories: ct.incomeCategories ?? [],

    // ------------------------------------------------------------
    // PAYMENTS EXPANDED (future)
    // ------------------------------------------------------------
    paymentsExpanded: ct.paymentsExpanded ?? null,
  };
}
