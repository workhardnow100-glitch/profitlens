// lib/ixbrl/instanceBuilder.ts

import {
  IxbrlContext,
  IxbrlUnit,
  IxbrlFact,
  IxbrlTextBlock,
  TaxonomyRegistryEntry,
} from "./types";

export interface IxbrlInstanceInput {
  taxonomy: TaxonomyRegistryEntry;
  entity: {
    companyNumber?: string;
    name: string;
  };
  period: {
    start: string; // ISO
    end: string;   // ISO
  };
  contexts: IxbrlContext[];
  units: IxbrlUnit[];
  facts: IxbrlFact[];
  textBlocks?: IxbrlTextBlock[];
}

/**
 * Build a full iXBRL XHTML document for HMRC/FRC-style filings.
 */
export function buildIxbrlInstance(input: IxbrlInstanceInput): string {
  const {
    taxonomy,
    entity,
    period,
    contexts,
    units,
    facts,
    textBlocks = [],
  } = input;

  // Collect namespaces from concepts (facts + text blocks)
  const nsMap = new Map<string, string>();

  for (const f of facts) {
    const [prefix] = f.concept.xbrlName.split(":");
    if (prefix && f.concept.xbrlNamespace && !nsMap.has(prefix)) {
      nsMap.set(prefix, f.concept.xbrlNamespace);
    }
  }

  for (const t of textBlocks) {
    const [prefix] = t.concept.xbrlName.split(":");
    if (prefix && t.concept.xbrlNamespace && !nsMap.has(prefix)) {
      nsMap.set(prefix, t.concept.xbrlNamespace);
    }
  }

  // Add iso4217 namespace if any unit uses it
  const usesIso4217 = units.some((u) => u.measure.startsWith("iso4217:"));
  if (usesIso4217 && !nsMap.has("iso4217")) {
    nsMap.set("iso4217", "http://www.xbrl.org/2003/iso4217");
  }

  const dynamicNsAttrs = Array.from(nsMap.entries())
    .map(([prefix, uri]) => `xmlns:${prefix}="${uri}"`)
    .join("\n      ");

  // Contexts
  const contextsXml = contexts
    .map((ctx) => {
      const isInstant = !!ctx.instant;
      const periodXml = isInstant
        ? `<xbrli:instant>${ctx.periodEnd}</xbrli:instant>`
        : `<xbrli:startDate>${ctx.periodStart}</xbrli:startDate>
        <xbrli:endDate>${ctx.periodEnd}</xbrli:endDate>`;

      const identifier = entity.companyNumber || entity.name;
      const scheme =
        entity.companyNumber != null
          ? "http://www.companieshouse.gov.uk/"
          : "http://profitlens.internal/entity";

      return `
      <xbrli:context id="${escapeXml(ctx.id)}">
        <xbrli:entity>
          <xbrli:identifier scheme="${escapeXml(scheme)}">${escapeXml(
        identifier
      )}</xbrli:identifier>
        </xbrli:entity>
        <xbrli:period>
          ${periodXml}
        </xbrli:period>
      </xbrli:context>`.trim();
    })
    .join("\n      ");

  // Units
  const unitsXml = units
    .map((u) => {
      return `
      <xbrli:unit id="${escapeXml(u.id)}">
        <xbrli:measure>${escapeXml(u.measure)}</xbrli:measure>
      </xbrli:unit>`.trim();
    })
    .join("\n      ");

  // Facts (numeric)
  const factsXml = facts
    .map((f) => {
      const value = formatFactValue(f.value);
      const decimals = typeof f.value === "number" ? "0" : "INF";

      const unitAttr = f.unitId ? ` unitRef="${escapeXml(f.unitId)}"` : "";
      return `
      <ix:nonFraction
        name="${escapeXml(f.concept.xbrlName)}"
        contextRef="${escapeXml(f.contextId)}"${unitAttr}
        decimals="${decimals}"
      >${escapeXml(value)}</ix:nonFraction>`.trim();
    })
    .join("\n      ");

  // Text blocks (narrative)
  const textBlocksXml = textBlocks
    .map((t) => {
      return `
      <ix:nonNumeric
        name="${escapeXml(t.concept.xbrlName)}"
        contextRef="${escapeXml(t.contextId)}"
      >${t.html}</ix:nonNumeric>`.trim();
    })
    .join("\n      ");

  const schemaRefXml = `
      <link:schemaRef
        xlink:type="simple"
        xlink:href="${escapeXml(taxonomy.entryPointUrl)}"
      />`.trim();

  const html = `
<!DOCTYPE html>
<html
  xmlns="http://www.w3.org/1999/xhtml"
  xmlns:ix="http://www.xbrl.org/2013/inlineXBRL"
  xmlns:xbrli="http://www.xbrl.org/2003/instance"
  xmlns:link="http://www.xbrl.org/2003/linkbase"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  ${dynamicNsAttrs ? "\n  " + dynamicNsAttrs : ""}
>
  <head>
    <title>iXBRL Instance - ${escapeXml(entity.name)}</title>
  </head>
  <body>
    <ix:header>
      <xbrli:xbrl>
        ${schemaRefXml}

        <!-- Contexts -->
        ${contextsXml}

        <!-- Units -->
        ${unitsXml}
      </xbrli:xbrl>
    </ix:header>

    <div id="ixbrl-facts">
      <!-- Numeric facts -->
      ${factsXml}

      <!-- Text blocks -->
      ${textBlocksXml}
    </div>
  </body>
</html>
  `.trim();

  return html;
}

/* -------------------------------------------------------------------------- */
/*                               HELPERS                                      */
/* -------------------------------------------------------------------------- */

function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatFactValue(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return value.toString();
  return value;
}
