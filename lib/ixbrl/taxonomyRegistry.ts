// lib/ixbrl/taxonomyRegistry.ts
import { TaxonomyRegistryEntry } from "./types";

export const TAXONOMY_REGISTRY: TaxonomyRegistryEntry[] = [
  {
    id: "frc-2023-small",
    type: "accounts",
    version: "2023",
    label: "FRC 2023 – Small Companies (FRS 102 1A)",
    validFrom: "2023-01-01",
    validTo: null,
    entryPointUrl: "https://example.com/frc/2023/small/entrypoint.xsd", // placeholder
  },
  {
    id: "hmrc-ct-2024",
    type: "computations",
    version: "2024",
    label: "HMRC CT Computational 2024",
    validFrom: "2024-01-01",
    validTo: null,
    entryPointUrl: "https://example.com/hmrc/ct/2024/entrypoint.xsd", // placeholder
  },
];

export function resolveTaxonomiesForPeriod(params: {
  periodStart: string;
  periodEnd: string;
  gaapFramework: "FRS102-1A" | "FRS105" | "IFRS"; // extend later
}) {
  // For now: hard‑code to these two; later we’ll add real date/version logic.
  const accountsTaxonomy = TAXONOMY_REGISTRY.find(
    (t) => t.type === "accounts" && t.id === "frc-2023-small"
  );
  const computationsTaxonomy = TAXONOMY_REGISTRY.find(
    (t) => t.type === "computations" && t.id === "hmrc-ct-2024"
  );

  if (!accountsTaxonomy || !computationsTaxonomy) {
    throw new Error("No suitable taxonomies found for period/framework.");
  }

  return { accountsTaxonomy, computationsTaxonomy };
}
