/**
 * iXBRL TYPE DEFINITIONS
 * -----------------------
 * PURPOSE:
 *   Defines all shared TypeScript interfaces used by the iXBRL builders:
 *     - CT computations iXBRL (buildComputationsIxbrl)
 *     - Accounts iXBRL (buildAccountsIxbrl)
 *     - iXBRL instance generator (buildIxbrlInstance)
 *     - Taxonomy registry + concept mapping
 *
 * WHY THIS FILE MATTERS:
 *   These types form the backbone of the entire iXBRL generation system.
 *   Every fact, context, unit, and taxonomy concept must conform to these
 *   structures to produce valid inline XBRL for HMRC.
 *
 * CALLED BY:
 *   - lib/ixbrl/computationsBuilder.ts
 *   - lib/ixbrl/accountsBuilder.ts
 *   - lib/ixbrl/instanceBuilder.ts
 *   - lib/ixbrl/taxonomyRegistry.ts
 *   - lib/ixbrl/conceptMap.ts
 *
 * VALIDATION STATUS:
 *   ✓ Structurally correct
 *   ✓ Matches HMRC iXBRL expectations (contexts, units, facts, text blocks)
 *   ✓ Used consistently across all builders
 *   ☐ Full schema validation pending (requires HMRC taxonomy validator)
 *
 * FUTURE NOTES:
 *   - If HMRC introduces new data types (e.g., percentages, dates), extend
 *     TaxonomyDataType accordingly.
 *   - If new fact types (e.g., tuples, footnotes) are required, add interfaces.
 *   - This file should remain stable and rarely change.
 */

export type TaxonomyType = "accounts" | "computations";

/**
 * A single taxonomy entry (e.g. FRS102-1A 2024, HMRC CT 2024).
 * Loaded via taxonomyRegistry and used to resolve concept namespaces.
 */
export interface TaxonomyRegistryEntry {
  id: string;                 // e.g. "frs102-1a-2024", "hmrc-ct-2024"
  type: TaxonomyType;
  version: string;            // "2023", "2024", etc.
  label: string;              // Human-readable label
  validFrom: string;          // ISO date
  validTo?: string | null;    // ISO date or null
  entryPointUrl: string;      // Official entry point URL
}

/**
 * Supported XBRL data types for facts.
 * Extend this if HMRC introduces new types.
 */
export type TaxonomyDataType =
  | "monetary"
  | "string"
  | "boolean"
  | "integer"
  | "textBlock";

/**
 * A single concept mapping entry.
 * Maps internal keys (e.g. "ct.taxable_profit") to real XBRL names.
 */
export interface TaxonomyConceptMapEntry {
  id: string;
  taxonomyId: string;         // FK to TaxonomyRegistryEntry.id
  internalKey: string;        // e.g. "ct.taxable_profit"
  xbrlName: string;           // e.g. "uk-corp-tax:TaxableProfit"
  xbrlNamespace: string;      // e.g. "http://www.gov.uk/taxonomy/uk-corp-tax"
  dataType: TaxonomyDataType;
  balanceType?: "debit" | "credit" | null;
  notes?: string;
}

/**
 * iXBRL Context — defines the reporting period.
 * Duration contexts: periodStart + periodEnd
 * Instant contexts: periodEnd only (instant = true)
 */
export interface IxbrlContext {
  id: string;
  entityId: string;
  periodStart: string; // ISO
  periodEnd: string;   // ISO
  instant?: boolean;   // true for instant, false/undefined for duration
}

/**
 * iXBRL Unit — usually GBP, but could be shares, percentages, etc.
 */
export interface IxbrlUnit {
  id: string;
  measure: string; // e.g. "iso4217:GBP"
}

/**
 * iXBRL Fact — a single numeric or string value.
 * Used for all monetary and non-textBlock facts.
 */
export interface IxbrlFact {
  concept: TaxonomyConceptMapEntry;
  contextId: string;
  unitId?: string;
  value: string | number | boolean;
}

/**
 * iXBRL Text Block — used for narrative sections (directors' report, notes).
 * Must contain valid XHTML.
 */
export interface IxbrlTextBlock {
  concept: TaxonomyConceptMapEntry;
  contextId: string;
  html: string;
}
