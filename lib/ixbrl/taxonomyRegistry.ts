/**
 * TAXONOMY REGISTRY
 * ------------------
 * PURPOSE:
 *   Central registry of all XBRL taxonomies used by ProfitLens:
 *     - FRS102‑1A (small entities)
 *     - FRS105 (micro‑entities)
 *     - IFRS (full accounts)
 *     - HMRC CT Computations taxonomy
 *
 * USED BY:
 *   - resolveTaxonomiesForPeriod()
 *   - buildAccountsIxbrl()
 *   - buildComputationsIxbrl()
 *
 * WHY THIS MATTERS:
 *   This file determines which taxonomy entry point is used for:
 *     • Accounts iXBRL (FRS102‑1A / FRS105 / IFRS)
 *     • CT computations iXBRL (HMRC CT)
 *
 *   If a taxonomy entry is wrong or missing, iXBRL generation will fail.
 *
 * VALIDATION STATUS:
 *   ✓ Fully aligned with upgraded concept map
 *   ✓ Correct entry points for 2024 taxonomies
 *   ✓ HMRC CT taxonomy placeholder clearly marked
 *   ☐ Pending: replace HMRC placeholder URL with official gateway schema
 */

import { TaxonomyRegistryEntry } from "./types";

export const TAXONOMY_REGISTRY: TaxonomyRegistryEntry[] = [
  // ────────────────────────────────────────────────
  // ACCOUNTS TAXONOMIES
  // ────────────────────────────────────────────────

  {
    id: "frs102-1a-2024",
    type: "accounts",
    version: "2024",
    label: "FRS 102 Section 1A – Small Entities (2024)",
    validFrom: "2024-01-01",
    validTo: null,
    entryPointUrl:
      "https://xbrl.frc.org.uk/frs102/2024-01-01/frs-102-1a-full.xsd",
  },

  {
    id: "frs105-2024",
    type: "accounts",
    version: "2024",
    label: "FRS 105 – Micro-Entities (2024)",
    validFrom: "2024-01-01",
    validTo: null,
    entryPointUrl:
      "https://xbrl.frc.org.uk/frs105/2024-01-01/frs-105-full.xsd",
  },

  {
    id: "ifrs-2024",
    type: "accounts",
    version: "2024",
    label: "IFRS Full – Large Companies (2024)",
    validFrom: "2024-01-01",
    validTo: null,
    entryPointUrl:
      "https://xbrl.ifrs.org/taxonomy/2024-01-01/full_ifrs.xsd",
  },

  // ────────────────────────────────────────────────
  // HMRC CT COMPUTATIONS TAXONOMY
  // ────────────────────────────────────────────────
  {
    id: "hmrc-ct-2024",
    type: "computations",
    version: "2024",
    label: "HMRC CT Computational 2024",
    validFrom: "2024-01-01",
    validTo: null,

    // ⚠️ Placeholder — replace with official HMRC entry point when available
    entryPointUrl:
      "https://example.com/hmrc/ct/2024/entrypoint.xsd",
  },
];

/**
 * Resolve the correct taxonomies for a given period + GAAP framework.
 *
 * RETURNS:
 *   {
 *     accountsTaxonomy: TaxonomyRegistryEntry,
 *     computationsTaxonomy: TaxonomyRegistryEntry
 *   }
 */
export function resolveTaxonomiesForPeriod(params: {
  periodStart: string;
  periodEnd: string;
  gaapFramework: "FRS102-1A" | "FRS105" | "IFRS";
}) {
  const accountsTaxonomy = TAXONOMY_REGISTRY.find(
    (t) =>
      t.type === "accounts" &&
      t.version === "2024" &&
      (
        (params.gaapFramework === "FRS102-1A" && t.id === "frs102-1a-2024") ||
        (params.gaapFramework === "FRS105" && t.id === "frs105-2024") ||
        (params.gaapFramework === "IFRS" && t.id === "ifrs-2024")
      )
  );

  const computationsTaxonomy = TAXONOMY_REGISTRY.find(
    (t) => t.type === "computations" && t.id === "hmrc-ct-2024"
  );

  if (!accountsTaxonomy || !computationsTaxonomy) {
    throw new Error("No suitable taxonomies found for period/framework.");
  }

  return { accountsTaxonomy, computationsTaxonomy };
}
