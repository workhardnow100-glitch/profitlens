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

  const { computationsTaxonomy } = resolveTaxonomiesForPeriod({
    periodStart,
    periodEnd,
    gaapFramework,
  });

  const mainContext: IxbrlContext = {
    id: "C_MAIN",
    entityId: companyNumber || clientId,
    periodStart,
    periodEnd,
    instant: false,
  };

  const contexts: IxbrlContext[] = [mainContext];

  const gbpUnit: IxbrlUnit = {
    id: "U_GBP",
    measure: "iso4217:GBP",
  };

  const units: IxbrlUnit[] = [gbpUnit];

  const facts: IxbrlFact[] = [];

  const push = (key: string, value: number | undefined | null) => {
    if (value == null) return;
    facts.push({
      concept: getConceptByInternalKey(computationsTaxonomy.id, key),
      contextId: mainContext.id,
      unitId: gbpUnit.id,
      value,
    });
  };

  // Core CT figures
  push("ct.taxable_profit", computations.taxableProfit);
  push("ct.corporation_tax_due", computations.corporationTaxDue);

  // Capital allowances
  push("ct.capital_allowances_total", computations.capitalAllowances?.totalCapitalAllowances);
  push("ct.capital_allowances_aia", computations.capitalAllowances?.aiaClaimed);

  // Losses
  push("ct.losses_carried_forward", computations.losses?.carriedForward);
  push("ct.losses_used", computations.losses?.used);
  push("ct.loss_carryback", computations.losses?.lossCarryback);
  push("ct.group_relief", computations.losses?.groupRelief);

  // R&D
  push("ct.r_and_d_enhanced_deduction", computations.rAndD?.rAndDEnhancedRelief);

  // Director loan
  push("ct.loans_to_participators", computations.loansToParticipators?.totalLoans);

  // Payments
  push("ct.payments_made", computations.payments?.paymentsMade);
  push("ct.balance_due", computations.payments?.balanceDue);

  // Turnover and expenses
  push("ct.turnover", computations.computations?.turnover);
  push("ct.allowable_expenses", computations.computations?.allowableExpenses);
  push("ct.disallowable_expenses", computations.adjustments?.disallowableExpenses);

  const textBlocks: IxbrlTextBlock[] = [
    {
      concept: getConceptByInternalKey(computationsTaxonomy.id, "ct.computation_narrative"),
      contextId: mainContext.id,
      html: `
        <p>Corporation Tax Computations for period ${periodStart} to ${periodEnd}.</p>
        <p>Generated automatically by ProfitLens.</p>
      `,
    },
  ];

  return buildIxbrlInstance({
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
}
