// lib/ixbrl/conceptMap.ts
import { TaxonomyConceptMapEntry } from "./types";

export const TAXONOMY_CONCEPT_MAP: TaxonomyConceptMapEntry[] = [
  // ────────────────────────────────────────────────
  // CT COMPUTATIONS (existing)
  // ────────────────────────────────────────────────
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
  {
    id: "ct-computation-narrative",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.computation_narrative",
    xbrlName: "uk-corp-tax:ComputationNarrative",
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "textBlock",
    balanceType: null,
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
    balanceType: null,
  },

  // ────────────────────────────────────────────────
  // ACCOUNTS — FRS105 (2024)
  // (mapped to equivalent micro-entity concepts)
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

  // ────────────────────────────────────────────────
  // ACCOUNTS — IFRS (2024)
  // (mapped to equivalent IFRS concepts)
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
];

export function getConceptByInternalKey(
  taxonomyId: string,
  internalKey: string
) {
  const concept = TAXONOMY_CONCEPT_MAP.find(
    (c) => c.taxonomyId === taxonomyId && c.internalKey === internalKey
  );
  if (!concept) {
    throw new Error(
      `No concept mapping for ${internalKey} in taxonomy ${taxonomyId}`
    );
  }
  return concept;
}
