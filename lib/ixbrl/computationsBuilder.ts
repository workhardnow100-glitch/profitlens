// lib/ixbrl/computationsBuilder.ts

import { CtComputations } from "../ct/computationsTypes";
import {
  IxbrlContext,
  IxbrlUnit,
  IxbrlFact,
  IxbrlTextBlock,
} from "./types";
import { resolveTaxonomiesForPeriod } from "./taxonomyRegistry";
import { getConceptByInternalKey } from "./conceptMap";
import { buildIxbrlInstance } from "./instanceBuilder";

export async function buildComputationsIxbrl(params: {
  clientId: string;
  companyNumber: string;
  companyName: string;
  gaapFramework: "FRS102-1A" | "FRS105" | "IFRS";
  computations: CtComputations;
}): Promise<string> {
  const {
    clientId,
    companyNumber,
    companyName,
    gaapFramework,
    computations,
  } = params;

  const { periodStart, periodEnd } = computations;

  // 1. Resolve taxonomy
  const { computationsTaxonomy } = resolveTaxonomiesForPeriod({
    periodStart,
    periodEnd,
    gaapFramework,
  });

  // 2. Contexts
  const mainContext: IxbrlContext = {
    id: "C_MAIN",
    entityId: companyNumber || clientId,
    periodStart,
    periodEnd,
    instant: false,
  };

  const contexts: IxbrlContext[] = [mainContext];

  // 3. Units
  const gbpUnit: IxbrlUnit = {
    id: "U_GBP",
    measure: "iso4217:GBP",
  };

  const units: IxbrlUnit[] = [gbpUnit];

  // 4. Facts
  const facts: IxbrlFact[] = [];

  // Taxable profit
  facts.push({
    concept: getConceptByInternalKey(
      computationsTaxonomy.id,
      "ct.taxable_profit"
    ),
    contextId: mainContext.id,
    unitId: gbpUnit.id,
    value: computations.taxableProfit ?? 0,
  });

  // Corporation tax due
  facts.push({
    concept: getConceptByInternalKey(
      computationsTaxonomy.id,
      "ct.corporation_tax_due"
    ),
    contextId: mainContext.id,
    unitId: gbpUnit.id,
    value: computations.corporationTaxDue ?? 0,
  });

  // 5. Optional narrative block – use a valid HMRC CT 2024 concept key
  const textBlocks: IxbrlTextBlock[] = [
    {
      concept: getConceptByInternalKey(
        computationsTaxonomy.id,
        "ct.computation_narrative" // fixed from ct.computations_narrative
      ),
      contextId: mainContext.id,
      html: `
        <p>Corporation Tax Computations for period ${periodStart} to ${periodEnd}.</p>
        <p>Generated automatically by ProfitLens.</p>
      `,
    },
  ];

  // 6. Build full XHTML iXBRL instance
  const ixbrl = buildIxbrlInstance({
    taxonomy: computationsTaxonomy,
    entity: {
      companyNumber,
      name: companyName,
    },
    period: {
      start: periodStart,
      end: periodEnd,
    },
    contexts,
    units,
    facts,
    textBlocks,
  });

  return ixbrl;
}
