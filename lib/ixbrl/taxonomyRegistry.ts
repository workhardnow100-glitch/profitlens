// lib/ixbrl/taxonomyRegistry.ts
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
  // COMPUTATIONS TAXONOMY (existing)
  // ────────────────────────────────────────────────

  {
    id: "hmrc-ct-2024",
    type: "computations",
    version: "2024",
    label: "HMRC CT Computational 2024",
    validFrom: "2024-01-01",
    validTo: null,
    entryPointUrl:
      "https://example.com/hmrc/ct/2024/entrypoint.xsd", // placeholder
  },
];

export function resolveTaxonomiesForPeriod(params: {
  periodStart: string;
  periodEnd: string;
  gaapFramework: "FRS102-1A" | "FRS105" | "IFRS";
}) {
  // Select accounts taxonomy based on framework
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
