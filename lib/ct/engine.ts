// lib/ct/engine.ts

import { CtComputations } from "./computationsTypes";
import { getCt600Data } from "../ct/ct600Engine";
import { supabaseAdmin } from "../supabase-admin";

export async function computeCtForPeriod(params: {
  clientId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<CtComputations> {
  const { clientId, periodStart, periodEnd } = params;

  // Load client (needed for company name/number)
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  const ct = await getCt600Data({
    formCode: "CT600",
    client,
    clientId,
    periodStart,
    periodEnd,
  });

  return {
    periodStart,
    periodEnd,
    taxableProfit: ct.computations.taxableProfit,
    corporationTaxDue: ct.computations.taxDue,
  };
}
