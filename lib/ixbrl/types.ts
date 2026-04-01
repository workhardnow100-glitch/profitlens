// lib/ixbrl/types.ts

export type TaxonomyType = "accounts" | "computations";

export interface TaxonomyRegistryEntry {
  id: string;                 // e.g. "frs102-1a-2024", "hmrc-ct-2024"
  type: TaxonomyType;
  version: string;            // "2023", "2024", etc.
  label: string;              // Human label
  validFrom: string;          // ISO date
  validTo?: string | null;    // ISO date or null
  entryPointUrl: string;      // Official entry point URL
}

export type TaxonomyDataType =
  | "monetary"
  | "string"
  | "boolean"
  | "integer"
  | "textBlock";

export interface TaxonomyConceptMapEntry {
  id: string;
  taxonomyId: string;         // FK to TaxonomyRegistryEntry.id
  internalKey: string;        // e.g. "ct.taxable_profit", "accounts.bs.total_assets"
  xbrlName: string;           // e.g. "uk-corp-tax:TaxableProfit"
  xbrlNamespace: string;      // e.g. "http://www.gov.uk/taxonomy/uk-corp-tax"
  dataType: TaxonomyDataType;
  balanceType?: "debit" | "credit" | null;
  notes?: string;
}

export interface IxbrlContext {
  id: string;
  entityId: string;
  periodStart: string; // ISO
  periodEnd: string;   // ISO
  instant?: boolean;   // true for instant, false/undefined for duration
}

export interface IxbrlUnit {
  id: string;
  measure: string; // e.g. "iso4217:GBP"
}

export interface IxbrlFact {
  concept: TaxonomyConceptMapEntry;
  contextId: string;
  unitId?: string;
  value: string | number | boolean;
}

export interface IxbrlTextBlock {
  concept: TaxonomyConceptMapEntry;
  contextId: string;
  html: string;
}
