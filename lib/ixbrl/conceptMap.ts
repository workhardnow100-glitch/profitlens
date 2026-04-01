// lib/ixbrl/conceptMap.ts
import { TaxonomyConceptMapEntry } from "./types";

// For now, a small seed map. We’ll expand this systematically.
export const TAXONOMY_CONCEPT_MAP: TaxonomyConceptMapEntry[] = [
  // CT computations – examples
  {
    id: "ct-taxable-profit",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.taxable_profit",
    xbrlName: "uk-corp-tax:TaxableProfit",      // placeholder
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax", // placeholder
    dataType: "monetary",
    balanceType: "credit",
    notes: "Taxable profit for the period.",
  },
  {
    id: "ct-corporation-tax-due",
    taxonomyId: "hmrc-ct-2024",
    internalKey: "ct.corporation_tax_due",
    xbrlName: "uk-corp-tax:CorporationTaxDue",  // placeholder
    xbrlNamespace: "http://www.gov.uk/taxonomy/uk-corp-tax",
    dataType: "monetary",
    balanceType: "credit",
  },

  // Accounts – examples
  {
    id: "bs-cash",
    taxonomyId: "frc-2023-small",
    internalKey: "bs.assets.current.cash",
    xbrlName: "frc:CashAndCashEquivalents",     // placeholder
    xbrlNamespace: "http://www.frc.org.uk/taxonomy/frc",
    dataType: "monetary",
    balanceType: "debit",
  },
];

export function getConceptByInternalKey(taxonomyId: string, internalKey: string) {
  const concept = TAXONOMY_CONCEPT_MAP.find(
    (c) => c.taxonomyId === taxonomyId && c.internalKey === internalKey
  );
  if (!concept) {
    throw new Error(`No concept mapping for ${internalKey} in taxonomy ${taxonomyId}`);
  }
  return concept;
}
