// lib/ct/engine.ts

import { CtComputations } from "./computationsTypes";
import { getCt600Data } from "./ct600Engine";
import { supabaseAdmin } from "../supabase-admin";

export async function computeCtForPeriod(params: {
  clientId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<CtComputations> {
  const { clientId, periodStart, periodEnd } = params;

  // Load client (needed by getCt600Data)
  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError || !client) {
    throw new Error("Client not found for CT computations.");
  }

  // Use the same CT engine that powers the PDFs / forms page
  const ctRaw = await getCt600Data({
    formCode: "CT600",
    client,
    clientId,
    periodStart,
    periodEnd,
  });

  // Loosen types at the boundary
  const ct = ctRaw as any;
  const computations = (ct.computations || {}) as any;

  // Normalise disclosures: ct.disclosures might be { notes: ... } or an array
  const rawDisclosures = ct.disclosures;
  let disclosures: any[] = [];
  if (Array.isArray(rawDisclosures)) {
    disclosures = rawDisclosures;
  } else if (rawDisclosures?.notes) {
    disclosures = Array.isArray(rawDisclosures.notes)
      ? rawDisclosures.notes
      : [rawDisclosures.notes];
  }

  return {
    periodStart,
    periodEnd,

    // Headline figures (fallback to 0 if not present)
    taxableProfit: computations.taxableProfit ?? 0,
    corporationTaxDue: computations.taxDue ?? 0,

    // 1. Summary
    summary: ct.summary ?? null,

    // 2. Computations (high‑level)
    computations: {
      taxableProfit: computations.taxableProfit ?? 0,
      taxDue: computations.taxDue ?? 0,
      capitalAllowances: computations.capitalAllowances ?? null,
      losses: computations.losses ?? null,
      adjustments: computations.adjustments ?? null,
    },

    // 3. Capital Allowances
    capitalAllowances: ct.capitalAllowances ?? null,

    // 4. Losses
    losses: ct.losses ?? null,

    // 5. Adjustments
    adjustments: ct.adjustments ?? null,

    // 6. R&D (CT600L)
    rAndD: ct.rAndD ?? null,

    // 7. Loans to Participators (CT600A)
    loansToParticipators: ct.loansToParticipators ?? null,

    // 8. Payments & Balances
    payments: ct.payments ?? null,

    // 9. Additional Disclosures
    disclosures,

    // 12. Income Categories
    incomeCategories: ct.incomeCategories ?? [],

    // 13. Payments & Balances (Expanded)
    paymentsExpanded: ct.paymentsExpanded ?? null,
  };
}
