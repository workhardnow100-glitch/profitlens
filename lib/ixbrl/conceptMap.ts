//lib/ixbrl/conceptMap.ts
/**
 * TAXONOMY CONCEPT MAP
 * ---------------------
 * PURPOSE:
 *   Maps ProfitLens internal computation keys to real XBRL concepts in:
 *     - HMRC Corporation Tax taxonomy (CT computations)
 *     - FRS102‑1A taxonomy (small companies)
 *     - FRS105 taxonomy (micro‑entities)
 *     - IFRS taxonomy (full accounts)
 *
 * USED BY:
 *   - buildComputationsIxbrl
 *   - buildAccountsIxbrl
 *   - instanceBuilder
 *
 * WHY THIS MATTERS:
 *   This file is the *single source of truth* for all iXBRL concept mappings.
 */

import { TaxonomyConceptMapEntry } from "./types";

export const TAXONOMY_CONCEPT_MAP: TaxonomyConceptMapEntry[] = [

  // ────────────────────────────────────────────────
  // HMRC CT COMPUTATIONS (2024)
  // ────────────────────────────────────────────────

  {
    id: "ct-turnover",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.turnover",
    xbrlName: "uk-corp-tax:Turnover",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "monetary",
    balanceType: "credit",
  },
  {
  id: "ct-group-relief",
  taxonomyId: "hmrc-ct-2024",
  internalKey: "ct.group_relief",
  xbrlName: "uk-corp-tax:GroupReliefAmount",
  xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
  dataType: "monetary",
  balanceType: "debit"
},

  {
    id: "ct-allowable-expenses",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.allowable_expenses",
    xbrlName: "uk-corp-tax:AllowableExpenses",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "monetary",
    balanceType: "debit",
  },
  {
    id: "ct-non-deductible-expenses",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.non_deductible_expenses",
    xbrlName: "uk-corp-tax:DisallowableExpenses",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "monetary",
    balanceType: "debit",
  },
  {
    id: "ct-non-taxable-income-deductions",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.non_taxable_income_deductions",
    xbrlName: "uk-corp-tax:NonTaxableIncomeDeductions",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "monetary",
    balanceType: "credit",
  },
  {
    id: "ct-other-adjustments",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.other_adjustments",
    xbrlName: "uk-corp-tax:OtherAdjustments",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "monetary",
  },
  {
  id: "ct-disallowable-expenses",
  taxonomyId: "hmrc-ct-2024",
  internalKey: "ct.disallowable_expenses",
  xbrlName: "uk-corp-tax:DisallowableExpenses",
  xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
  dataType: "monetary",
  balanceType: "debit"
},


  {
    id: "ct-taxable-profit",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.taxable_profit",
    xbrlName: "uk-corp-tax:TaxableProfit",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "monetary",
    balanceType: "credit",
  },
  {
    id: "ct-corporation-tax-due",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.corporation_tax_due",
    xbrlName: "uk-corp-tax:CorporationTaxDue",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "monetary",
    balanceType: "credit",
  },

  // Capital allowances
  {
    id: "ct-capital-allowances-total",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.capital_allowances_total",
    xbrlName: "uk-corp-tax:CapitalAllowancesTotal",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "monetary",
  },
  {
    id: "ct-capital-allowances-aia",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.capital_allowances_aia",
    xbrlName: "uk-corp-tax:AnnualInvestmentAllowance",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "monetary",
  },

  // Losses
  {
    id: "ct-losses-used",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.losses_used",
    xbrlName: "uk-corp-tax:LossesUsed",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "monetary",
  },
  {
    id: "ct-losses-carried-forward",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.losses_carried_forward",
    xbrlName: "uk-corp-tax:LossesCarriedForward",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "monetary",
  },

  // R&D
  {
    id: "ct-rd-enhanced-deduction",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.r_and_d_enhanced_deduction",
    xbrlName: "uk-corp-tax:ResearchAndDevelopmentEnhancedDeduction",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "monetary",
  },

  // Loans to participators
  {
    id: "ct-loans-to-participators",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.loans_to_participators",
    xbrlName: "uk-corp-tax:LoansToParticipators",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "monetary",
  },

  // Payments
  {
    id: "ct-payments-made",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.payments_made",
    xbrlName: "uk-corp-tax:PaymentsMade",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "monetary",
  },
  {
    id: "ct-balance-due",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.balance_due",
    xbrlName: "uk-corp-tax:BalanceDue",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "monetary",
  },

  // Narrative
  {
    id: "ct-computation-narrative",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.computation_narrative",
    xbrlName: "uk-corp-tax:ComputationNarrative",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "textBlock",
  },

  // ────────────────────────────────────────────────
  // ACCOUNTS — FRS102‑1A (2024)
  // ────────────────────────────────────────────────

  {
    id: "frs102-assets-total",
    taxonomyId: "frs102-1a-2024",
    internalKey: "accounts.bs.total_assets",
    xbrlName: "frs102:TotalAssets",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/102/2024-01-01",
    dataType: "monetary",
    balanceType: "debit",
  },
  {
    id: "frs102-liabilities-total",
    taxonomyId: "frs102-1a-2024",
    internalKey: "accounts.bs.total_liabilities",
    xbrlName: "frs102:TotalLiabilities",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/102/2024-01-01",
    dataType: "monetary",
    balanceType: "credit",
  },
  {
    id: "frs102-equity",
    taxonomyId: "frs102-1a-2024",
    internalKey: "accounts.bs.equity",
    xbrlName: "frs102:Equity",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/102/2024-01-01",
    dataType: "monetary",
    balanceType: "credit",
  },

  {
    id: "frs102-turnover",
    taxonomyId: "frs102-1a-2024",
    internalKey: "accounts.pl.turnover",
    xbrlName: "frs102:TurnoverRevenue",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/102/2024-01-01",
    dataType: "monetary",
    balanceType: "credit",
  },
  {
    id: "frs102-cost-of-sales",
    taxonomyId: "frs102-1a-2024",
    internalKey: "accounts.pl.cost_of_sales",
    xbrlName: "frs102:CostOfSales",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/102/2024-01-01",
    dataType: "monetary",
    balanceType: "debit",
  },
  {
    id: "frs102-gross-profit",
    taxonomyId: "frs102-1a-2024",
    internalKey: "accounts.pl.gross_profit",
    xbrlName: "frs102:GrossProfitLoss",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/102/2024-01-01",
    dataType: "monetary",
    balanceType: "credit",
  },
  {
    id: "frs102-profit-for-year",
    taxonomyId: "frs102-1a-2024",
    internalKey: "accounts.pl.profit_for_year",
    xbrlName: "frs102:ProfitLossForPeriod",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/102/2024-01-01",
    dataType: "monetary",
    balanceType: "credit",
  },

  {
    id: "frs102-directors-report",
    taxonomyId: "frs102-1a-2024",
    internalKey: "accounts.directors_report",
    xbrlName: "frs102:DirectorsReportTextBlock",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/102/2024-01-01",
    dataType: "textBlock",
  },

  // ⭐ NEW — FRS102‑1A statutory text blocks
  {
    id: "frs102-accounting-policies",
    taxonomyId: "frs102-1a-2024",
    internalKey: "accounts.accounting_policies",
    xbrlName: "frs102:AccountingPoliciesTextBlock",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/102/2024-01-01",
    dataType: "textBlock",
  },
  {
    id: "frs102-notes",
    taxonomyId: "frs102-1a-2024",
    internalKey: "accounts.notes",
    xbrlName: "frs102:NotesToTheFinancialStatementsTextBlock",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/102/2024-01-01",
    dataType: "textBlock",
  },
  {
    id: "frs102-balance-sheet-statements",
    taxonomyId: "frs102-1a-2024",
    internalKey: "accounts.balance_sheet_statements",
    xbrlName: "frs102:BalanceSheetStatementsTextBlock",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/102/2024-01-01",
    dataType: "textBlock",
  },
  {
    id: "frs102-directors-approval",
    taxonomyId: "frs102-1a-2024",
    internalKey: "accounts.directors_approval",
    xbrlName: "frs102:DirectorsApprovalTextBlock",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/102/2024-01-01",
    dataType: "textBlock",
  },
  {
    id: "frs102-small-companies-regime",
    taxonomyId: "frs102-1a-2024",
    internalKey: "accounts.small_companies_regime",
    xbrlName: "frs102:SmallCompaniesRegimeStatement",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/102/2024-01-01",
    dataType: "textBlock",
  },

  // ────────────────────────────────────────────────
  // ACCOUNTS — FRS105 (2024)
  // ────────────────────────────────────────────────

  {
    id: "frs105-assets-total",
    taxonomyId: "frs105-2024",
    internalKey: "accounts.bs.total_assets",
    xbrlName: "frs105:TotalAssets",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/105/2024-01-01",
    dataType: "monetary",
    balanceType: "debit",
  },
  {
    id: "frs105-liabilities-total",
    taxonomyId: "frs105-2024",
    internalKey: "accounts.bs.total_liabilities",
    xbrlName: "frs105:TotalLiabilities",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/105/2024-01-01",
    dataType: "monetary",
    balanceType: "credit",
  },
  {
    id: "frs105-equity",
    taxonomyId: "frs105-2024",
    internalKey: "accounts.bs.equity",
    xbrlName: "frs105:Equity",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/105/2024-01-01",
    dataType: "monetary",
    balanceType: "credit",
  },

  {
    id: "frs105-turnover",
    taxonomyId: "frs105-2024",
    internalKey: "accounts.pl.turnover",
    xbrlName: "frs105:Turnover",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/105/2024-01-01",
    dataType: "monetary",
    balanceType: "credit",
  },
  {
    id: "frs105-cost-of-sales",
    taxonomyId: "frs105-2024",
    internalKey: "accounts.pl.cost_of_sales",
    xbrlName: "frs105:CostOfSales",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/105/2024-01-01",
    dataType: "monetary",
    balanceType: "debit",
  },
  {
    id: "frs105-gross-profit",
    taxonomyId: "frs105-2024",
    internalKey: "accounts.pl.gross_profit",
    xbrlName: "frs105:GrossProfitLoss",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/105/2024-01-01",
    dataType: "monetary",
    balanceType: "credit",
  },
  {
    id: "frs105-profit-for-year",
    taxonomyId: "frs105-2024",
    internalKey: "accounts.pl.profit_for_year",
    xbrlName: "frs105:ProfitLossForPeriod",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/105/2024-01-01",
    dataType: "monetary",
    balanceType: "credit",
  },

  {
    id: "frs105-directors-report",
    taxonomyId: "frs105-2024",
    internalKey: "accounts.directors_report",
    xbrlName: "frs105:DirectorsReportTextBlock",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/105/2024-01-01",
    dataType: "textBlock",
  },

  // ⭐ NEW — FRS105 statutory text blocks
  {
    id: "frs105-accounting-policies",
    taxonomyId: "frs105-2024",
    internalKey: "accounts.accounting_policies",
    xbrlName: "frs105:AccountingPoliciesTextBlock",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/105/2024-01-01",
    dataType: "textBlock",
  },
  {
    id: "frs105-notes",
    taxonomyId: "frs105-2024",
    internalKey: "accounts.notes",
    xbrlName: "frs105:NotesToTheFinancialStatementsTextBlock",
    xbrlNamespace: "http://www.xbrl.org/uk/frs/105/2024-01-01",
    dataType: "textBlock",
  },
  {
  id: "frs105-directors-approval",
  taxonomyId: "frs105-2024",
  internalKey: "accounts.directors_approval",
  xbrlName: "frs105:DirectorsApprovalTextBlock",
  xbrlNamespace: "http://www.xbrl.org/uk/frs/105/2024-01-01",
  dataType: "textBlock",
},
{
  id: "frs105-micro-entity-regime",
  taxonomyId: "frs105-2024",
  internalKey: "accounts.small_companies_regime",
  xbrlName: "frs105:MicroEntityRegimeStatement",
  xbrlNamespace: "http://www.xbrl.org/uk/frs/105/2024-01-01",
  dataType: "textBlock",
},

// ────────────────────────────────────────────────
// ACCOUNTS — IFRS (2024)
// ────────────────────────────────────────────────

{
  id: "ifrs-assets-total",
  taxonomyId: "ifrs-2024",
  internalKey: "accounts.bs.total_assets",
  xbrlName: "ifrs:Assets",
  xbrlNamespace: "http://xbrl.ifrs.org/taxonomy/2024-01-01/ifrs-full",
  dataType: "monetary",
  balanceType: "debit",
},
{
  id: "ifrs-liabilities-total",
  taxonomyId: "ifrs-2024",
  internalKey: "accounts.bs.total_liabilities",
  xbrlName: "ifrs:Liabilities",
  xbrlNamespace: "http://xbrl.ifrs.org/taxonomy/2024-01-01/ifrs-full",
  dataType: "monetary",
  balanceType: "credit",
},
{
  id: "ifrs-equity",
  taxonomyId: "ifrs-2024",
  internalKey: "accounts.bs.equity",
  xbrlName: "ifrs:Equity",
  xbrlNamespace: "http://xbrl.ifrs.org/taxonomy/2024-01-01/ifrs-full",
  dataType: "monetary",
  balanceType: "credit",
},

// ⭐ IFRS statutory text blocks
{
  id: "ifrs-accounting-policies",
  taxonomyId: "ifrs-2024",
  internalKey: "accounts.accounting_policies",
  xbrlName: "ifrs:DisclosureOfSignificantAccountingPoliciesExplanatory",
  xbrlNamespace: "http://xbrl.ifrs.org/taxonomy/2024-01-01/ifrs-full",
  dataType: "textBlock",
},
{
  id: "ifrs-notes",
  taxonomyId: "ifrs-2024",
  internalKey: "accounts.notes",
  xbrlName: "ifrs:DisclosureOfNotesAndOtherExplanatoryInformationExplanatory",
  xbrlNamespace: "http://xbrl.ifrs.org/taxonomy/2024-01-01/ifrs-full",
  dataType: "textBlock",
},
{
  id: "ifrs-directors-approval",
  taxonomyId: "ifrs-2024",
  internalKey: "accounts.directors_approval",
  xbrlName: "ifrs:AuthorisationOfFinancialStatementsForIssueExplanatory",
  xbrlNamespace: "http://xbrl.ifrs.org/taxonomy/2024-01-01/ifrs-full",
  dataType: "textBlock",
},
];

export function getConceptByInternalKey(taxonomyId: string, internalKey: string) {
  const concept = TAXONOMY_CONCEPT_MAP.find(
    (c) => c.taxonomyId === taxonomyId && c.internalKey === internalKey
  );

  if (!concept) {
    throw new Error(
      `No concept mapping found for internal key "${internalKey}" in taxonomy "${taxonomyId}".`
    );
  }

  return concept;
}

