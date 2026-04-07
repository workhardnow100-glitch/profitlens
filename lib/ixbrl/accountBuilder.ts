// lib/ixbrl/accountsBuilder.ts

/**
 * ACCOUNTS iXBRL BUILDER
 * -----------------------
 * PURPOSE:
 *   Generates the statutory accounts iXBRL file (FRS102‑1A, FRS105, or IFRS)
 *   for HMRC submission. This is the *accounts* iXBRL, separate from the CT
 *   computations iXBRL.
 *
 * CALLED BY:
 *   pages/api/forms/generate-pack.js
 *
 * INPUT:
 *   {
 *     clientId: string;
 *     companyNumber: string;
 *     companyName: string;
 *     periodStart: string;
 *     periodEnd: string;
 *     defaultFramework?: "FRS102-1A" | "FRS105" | "IFRS";
 *   }
 *
 * OUTPUT:
 *   {
 *     ixbrl: string;        // XHTML iXBRL instance
 *     framework: Framework; // The GAAP framework used
 *   }
 */

import { supabaseAdmin } from "../supabase-admin";
import {
  IxbrlContext,
  IxbrlUnit,
  IxbrlFact,
  IxbrlTextBlock,
} from "./types";
import { resolveTaxonomiesForPeriod } from "./taxonomyRegistry";
import { getConceptByInternalKey } from "./conceptMap";
import { buildIxbrlInstance } from "./instanceBuilder";

type Framework = "FRS102-1A" | "FRS105" | "IFRS";

// ------------------------------------------------------------
// FRAMEWORK DETECTION LOGIC
// ------------------------------------------------------------
function determineFramework(params: {
  turnover: number;
  balanceSheetTotal: number;
  employees?: number | null;
}): Framework {
  const { turnover, balanceSheetTotal, employees } = params;
  const emp = employees ?? 0;

  // Micro-entity thresholds (FRS105)
  const microHits = [
    turnover <= 632000,
    balanceSheetTotal <= 316000,
    emp <= 10,
  ].filter(Boolean).length;

  if (microHits >= 2) return "FRS105";

  // Small company thresholds (FRS102-1A)
  const smallHits = [
    turnover <= 10200000,
    balanceSheetTotal <= 5100000,
    emp <= 50,
  ].filter(Boolean).length;

  if (smallHits >= 2) return "FRS102-1A";

  // Otherwise IFRS
  return "IFRS";
}

// ------------------------------------------------------------
// MAIN BUILDER
// ------------------------------------------------------------
export async function buildAccountsIxbrl(params: {
  clientId: string;
  companyNumber: string;
  companyName: string;
  periodStart: string;
  periodEnd: string;
  defaultFramework?: Framework;
}): Promise<{
  ixbrl: string;
  framework: Framework;
}> {
  const {
    clientId,
    companyNumber,
    companyName,
    periodStart,
    periodEnd,
    defaultFramework = "FRS102-1A",
  } = params;

  // ------------------------------------------------------------
  // 0. LOAD CLIENT + PERIOD METADATA
  // ------------------------------------------------------------
  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (clientError) {
    throw new Error("Failed to load client: " + clientError.message);
  }

  const { data: periodMetaRows, error: periodMetaError } = await supabaseAdmin
    .from("client_accounts_periods")
    .select("*")
    .eq("client_id", clientId)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd);

  if (periodMetaError) {
    throw new Error("Failed to load accounts period metadata: " + periodMetaError.message);
  }

  const periodMeta = periodMetaRows?.[0] || null;

  const directorName: string =
    periodMeta?.director_name ||
    client.contact_person ||
    client.business_name ||
    companyName;

  const approvalDate: string =
    periodMeta?.accounts_approval_date ||
    periodEnd;

  const employeesCurrent: number | null =
    periodMeta?.employees_current_year ?? null;

  const employeesPrevious: number | null =
    periodMeta?.employees_previous_year ?? null;

  const directorsRemCurrent: number | null =
    periodMeta?.directors_remuneration ?? null;

  const directorsRemPrevious: number | null =
    periodMeta?.directors_remuneration_previous ?? null;

  const relatedPartyNotes: string | null =
    periodMeta?.related_party_notes ?? null;

  const contingentLiabilitiesNotes: string | null =
    periodMeta?.contingent_liabilities_notes ?? null;

  const postBalanceSheetEventsNotes: string | null =
    periodMeta?.post_balance_sheet_events ?? null;

  const accountingPoliciesOverride: string | null =
    periodMeta?.accounting_policies_override ?? null;

  const smallCompaniesRegimeOverride: string | null =
    periodMeta?.small_companies_regime_override ?? null;

// ------------------------------------------------------------
// 1. LOAD CHART OF ACCOUNTS (resolve coa_id dynamically)
// ------------------------------------------------------------

// Resolve COA ID from one journal line
const { data: coaRow, error: coaRowError } = await supabaseAdmin
  .from("journal_entries")
  .select("lines:journal_lines(account:chart_of_account_entries(coa_id))")
  .eq("client_id", clientId)
  .limit(1)
  .single();

if (coaRowError) {
  throw new Error("Failed to resolve client COA ID: " + coaRowError.message);
}

// Supabase nests joins as arrays, so account is an array
const coaId: string | undefined = coaRow?.lines?.[0]?.account?.[0]?.coa_id;
if (!coaId) {
  throw new Error(`No COA ID found for client ${clientId}`);
}

// Now load the chart of accounts
const { data: coa, error: coaError } = await supabaseAdmin
  .from("chart_of_account_entries")
  .select("*")
  .eq("coa_id", coaId);

if (coaError) {
  throw new Error("Failed to load COA: " + coaError.message);
}



  // ------------------------------------------------------------
  // 2. LOAD JOURNALS
  // ------------------------------------------------------------
  const { data: journals, error: journalsError } = await supabaseAdmin
    .from("journal_entries")
    .select(`
      id,
      date,
      client_id,
      lines:journal_lines (
        debit,
        credit,
        account:chart_of_account_entries (
          account_code,
          account_name
        )
      )
    `)
    .eq("client_id", clientId)
    .gte("date", periodStart)
    .lte("date", periodEnd);

  if (journalsError) {
    throw new Error("Failed to load journals: " + journalsError.message);
  }

  // ------------------------------------------------------------
  // 3. BUILD TRIAL BALANCE
  // ------------------------------------------------------------
  const balances: Record<string, number> = {};

  for (const j of journals || []) {
    for (const line of j.lines || []) {
      const account = Array.isArray(line.account)
        ? line.account[0]
        : line.account;

      const code = account?.account_code;
      if (!code) continue;

      const amt =
        Number(line.debit ?? 0) -
        Number(line.credit ?? 0);

      balances[code] = (balances[code] || 0) + amt;
    }
  }

  // ------------------------------------------------------------
  // 4. AGGREGATE INTO HIGH-LEVEL BUCKETS
  // ------------------------------------------------------------
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  let turnover = 0;
  let costOfSales = 0;

  for (const account of coa || []) {
    const code = account.account_code;
    const bal = balances[code] || 0;
    const type = account.account_type;
    const bucket = account.hmrc_bucket;

    // Balance sheet classification
    if (
      type === "ASSET" ||
      type === "BANK" ||
      type === "ACCOUNTS_RECEIVABLE"
    ) {
      totalAssets += bal;
    }

    if (
      type === "LIABILITY" ||
      type === "ACCOUNTS_PAYABLE" ||
      bucket === "liabilities" ||
      bucket === "vat"
    ) {
      totalLiabilities += bal;
    }

    if (type === "EQUITY" || bucket === "equity") {
      totalEquity += bal;
    }

    // Turnover (Sales only)
    if (
      type === "INCOME" &&
      bucket === "income" &&
      Number(code) >= 4000 &&
      Number(code) <= 4099
    ) {
      turnover += bal;
    }

    // Cost of sales
    if (
      type === "EXPENSE" &&
      bucket === "allowable" &&
      Number(code) >= 5000 &&
      Number(code) <= 5099
    ) {
      costOfSales += Math.abs(bal);
    }
  }

  const grossProfit = turnover - costOfSales;

  const totalExpenses = Object.entries(balances)
    .filter(([code]) => {
      const acc = coa.find((a) => a.account_code === code);
      return acc?.account_type === "EXPENSE";
    })
    .reduce((sum, [, bal]) => sum + Math.abs(bal), 0);

  const profitForYear = turnover - totalExpenses;

  const balanceSheetTotal = totalAssets;


  // ------------------------------------------------------------
// DEBUG: Verify trial balance totals
// ------------------------------------------------------------
console.log("Trial balance totals:", {
  totalAssets,
  totalLiabilities,
  totalEquity,
  turnover,
  costOfSales,
  grossProfit,
  profitForYear,
  balanceSheetTotal,
});

// ------------------------------------------------------------
// DEBUG: Check for COA ↔ balances mismatches
// ------------------------------------------------------------
for (const [code, bal] of Object.entries(balances)) {
  const acc = coa.find(
    (a) => String(a.account_code).trim() === String(code).trim()
  );
  if (!acc) {
    console.warn(`Unmatched journal code: ${code} → ${bal}`);
  }
}


  // ------------------------------------------------------------
  // 5. DETERMINE FRAMEWORK
  // ------------------------------------------------------------
  const framework = determineFramework({
    turnover,
    balanceSheetTotal,
    employees: employeesCurrent,
  });

  const gaapFramework: Framework =
    framework || defaultFramework || "FRS102-1A";

  // ------------------------------------------------------------
  // 6. RESOLVE TAXONOMY
  // ------------------------------------------------------------
  const { accountsTaxonomy } = resolveTaxonomiesForPeriod({
    periodStart,
    periodEnd,
    gaapFramework,
  });

  // ------------------------------------------------------------
  // 7. CONTEXTS & UNITS
  // ------------------------------------------------------------
  const mainContext: IxbrlContext = {
    id: "C_ACCOUNTS",
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

  // ------------------------------------------------------------
  // 8. FACTS (MINIMAL SET)
  // ------------------------------------------------------------
  const facts: IxbrlFact[] = [
    {
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.bs.total_assets"
      ),
      contextId: mainContext.id,
      unitId: gbpUnit.id,
      value: totalAssets,
    },
    {
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.bs.total_liabilities"
      ),
      contextId: mainContext.id,
      unitId: gbpUnit.id,
      value: totalLiabilities,
    },
    {
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.bs.equity"
      ),
      contextId: mainContext.id,
      unitId: gbpUnit.id,
      value: totalEquity,
    },
    {
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.pl.turnover"
      ),
      contextId: mainContext.id,
      unitId: gbpUnit.id,
      value: turnover,
    },
    {
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.pl.cost_of_sales"
      ),
      contextId: mainContext.id,
      unitId: gbpUnit.id,
      value: costOfSales,
    },
    {
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.pl.gross_profit"
      ),
      contextId: mainContext.id,
      unitId: gbpUnit.id,
      value: grossProfit,
    },
    {
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.pl.profit_for_year"
      ),
      contextId: mainContext.id,
      unitId: gbpUnit.id,
      value: profitForYear,
    },
  ];

  // ------------------------------------------------------------
  // 9. DIRECTORS' REPORT + STATUTORY TEXT BLOCKS
  // ------------------------------------------------------------

  const employeesCurrentText =
    typeof employeesCurrent === "number"
      ? employeesCurrent.toString()
      : "not disclosed";

  const employeesPreviousText =
    typeof employeesPrevious === "number"
      ? employeesPrevious.toString()
      : "not disclosed";

  const directorsRemCurrentText =
    typeof directorsRemCurrent === "number"
      ? directorsRemCurrent.toFixed(2)
      : "0.00";

  const directorsRemPreviousText =
    typeof directorsRemPrevious === "number"
      ? directorsRemPrevious.toFixed(2)
      : "0.00";

  const relatedPartyHtml =
    relatedPartyNotes?.trim() ||
    `During the year the company entered into transactions with related parties in the normal course of business. All transactions were conducted at arm’s length. Balances outstanding at the year end are disclosed within debtors and creditors as appropriate.`;

  const contingentLiabilitiesHtml =
    contingentLiabilitiesNotes?.trim() ||
    `There were no contingent liabilities at the balance sheet date which require disclosure in these financial statements.`;

  const postBalanceSheetEventsHtml =
    postBalanceSheetEventsNotes?.trim() ||
    `No events have occurred between the balance sheet date and the date of approval of these financial statements that require adjustment or disclosure.`;

  const accountingPoliciesHtml =
    accountingPoliciesOverride?.trim() ||
    `
        <h2>1. Accounting policies</h2>

        <p>The principal accounting policies adopted in the preparation of these financial statements are set out below. These policies have been consistently applied to all the years presented, unless otherwise stated.</p>

        <h3>1.1 Basis of preparation</h3>
        <p>The financial statements have been prepared in accordance with the applicable financial reporting framework in the United Kingdom and the Companies Act 2006. The financial statements are prepared under the historical cost convention.</p>

        <h3>1.2 Going concern</h3>
        <p>The directors have a reasonable expectation that the company has adequate resources to continue in operational existence for the foreseeable future. Accordingly, the financial statements have been prepared on a going concern basis.</p>

        <h3>1.3 Turnover</h3>
        <p>Turnover represents the fair value of consideration receivable for goods and services supplied in the ordinary course of the company’s activities, net of value added tax, rebates and discounts. Revenue is recognised when control of the goods or services passes to the customer and the amount of revenue can be measured reliably.</p>

        <h3>1.4 Tangible fixed assets</h3>
        <p>Tangible fixed assets are stated at cost less accumulated depreciation and any accumulated impairment losses. Depreciation is provided to write off the cost of assets less their estimated residual values on a straight‑line basis over their expected useful lives.</p>

        <h3>1.5 Financial instruments</h3>
        <p>Basic financial assets, including trade and other receivables and cash at bank, are initially recognised at transaction price and subsequently measured at amortised cost. Basic financial liabilities, including trade and other payables, are initially recognised at transaction price and subsequently measured at amortised cost.</p>

        <h3>1.6 Taxation</h3>
        <p>Current tax is provided at amounts expected to be paid (or recovered) using the tax rates and laws that have been enacted or substantively enacted by the balance sheet date. Deferred tax is recognised in respect of timing differences between the carrying amount of assets and liabilities for financial reporting purposes and the amounts used for taxation purposes, where it is probable that a liability or asset will crystallise.</p>
    `;

  const smallCompaniesRegimeHtmlFrs102 =
    smallCompaniesRegimeOverride?.trim() ||
    `
        <h2>5. Small companies regime</h2>

        <p>The company is entitled to and has taken advantage of the small companies regime under the Companies Act 2006 where applicable. As a result, the company has prepared abridged financial statements and has taken advantage of the exemptions available in respect of the preparation of a strategic report and certain disclosures otherwise required by the applicable financial reporting framework.</p>

        <p>The members have not required the company to obtain an audit of its financial statements for the year in accordance with section 476 of the Companies Act 2006.</p>
    `;

  const microEntityRegimeHtmlFrs105 =
    smallCompaniesRegimeOverride?.trim() ||
    `
        <h2>5. Micro-entity regime</h2>

        <p>These financial statements have been prepared in accordance with the micro-entity provisions of the Companies Act 2006 and Financial Reporting Standard 105, “The Financial Reporting Standard applicable to the Micro-entities Regime”.</p>

        <p>The company has taken advantage of the exemptions available to micro-entities in respect of the preparation and filing of certain information, including the omission of a profit and loss account from the public record.</p>

        <p>The members have not required the company to obtain an audit of its financial statements for the year in accordance with section 476 of the Companies Act 2006.</p>
    `;

  const textBlocks: IxbrlTextBlock[] = [];

  // 9.1 Directors’ report (FRS102 + FRS105 only)
  if (gaapFramework !== "IFRS") {
    textBlocks.push({
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.directors_report"
      ),
      contextId: mainContext.id,
      html: `
        <h2>Directors’ report</h2>
        <p>Statutory accounts for the year ended ${periodEnd}.</p>
        <p>These financial statements have been generated automatically by ProfitLens based on the company’s accounting records.</p>
      `,
    });
  }

  // 9.2 Accounting policies (all frameworks)
  textBlocks.push({
    concept: getConceptByInternalKey(
      accountsTaxonomy.id,
      "accounts.accounting_policies"
    ),
    contextId: mainContext.id,
    html: accountingPoliciesHtml,
  });

  // 9.3 Notes to the financial statements (all frameworks)
  textBlocks.push({
    concept: getConceptByInternalKey(
      accountsTaxonomy.id,
      "accounts.notes"
    ),
    contextId: mainContext.id,
    html: `
        <h2>2. Notes to the financial statements</h2>

        <h3>2.1 Employees</h3>
        <p>The average monthly number of employees (including directors) during the year was ${employeesCurrentText} (prior year: ${employeesPreviousText}).</p>

        <h3>2.2 Directors’ remuneration</h3>
        <p>Directors’ remuneration for the year amounted to £${directorsRemCurrentText} (prior year: £${directorsRemPreviousText}). No retirement benefits are accruing under defined benefit schemes.</p>

        <h3>2.3 Related party transactions</h3>
        <p>${relatedPartyHtml}</p>

        <h3>2.4 Contingent liabilities</h3>
        <p>${contingentLiabilitiesHtml}</p>

        <h3>2.5 Post balance sheet events</h3>
        <p>${postBalanceSheetEventsHtml}</p>
      `,
  });

  // 9.4 Balance sheet statements
  // FRS102-1A only (no concept in FRS105, no mapping for IFRS)
  if (gaapFramework === "FRS102-1A") {
    textBlocks.push({
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.balance_sheet_statements"
      ),
      contextId: mainContext.id,
      html: `
        <h2>3. Balance sheet statements</h2>

        <p>These financial statements have been prepared in accordance with the provisions applicable to companies subject to the small companies regime of the Companies Act 2006, where relevant.</p>

        <p>The company has taken advantage of the exemptions available in respect of the preparation of a strategic report and, where applicable, the filing of a profit and loss account.</p>

        <p>The financial statements were approved and authorised for issue by the board of directors on ${approvalDate}.</p>
      `,
    });
  }

  // 9.5 Directors’ responsibilities and approval (all frameworks)
  textBlocks.push({
    concept: getConceptByInternalKey(
      accountsTaxonomy.id,
      "accounts.directors_approval"
    ),
    contextId: mainContext.id,
    html: `
        <h2>4. Directors’ responsibilities and approval</h2>

        <p>The directors are responsible for preparing the financial statements in accordance with applicable law and regulations. Company law requires the directors to prepare financial statements for each financial year which give a true and fair view of the state of affairs of the company and of the profit or loss of the company for that period.</p>

        <p>In preparing these financial statements, the directors are required to:</p>
        <ul>
          <li>select suitable accounting policies and then apply them consistently;</li>
          <li>make judgements and estimates that are reasonable and prudent; and</li>
          <li>prepare the financial statements on the going concern basis unless it is inappropriate to presume that the company will continue in business.</li>
        </ul>

        <p>The directors are responsible for keeping adequate accounting records that are sufficient to show and explain the company’s transactions and disclose with reasonable accuracy at any time the financial position of the company, and enable them to ensure that the financial statements comply with the Companies Act 2006. They are also responsible for safeguarding the assets of the company and hence for taking reasonable steps for the prevention and detection of fraud and other irregularities.</p>

        <p>These financial statements were approved by the board of directors and authorised for issue on ${approvalDate} and were signed on its behalf by:</p>

        <p>......................................................<br/>
        ${directorName}<br/>
        Director</p>
      `,
  });

  // 9.6 Small companies / micro-entity regime statement
  // FRS102-1A: small companies regime
  if (gaapFramework === "FRS102-1A") {
    textBlocks.push({
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.small_companies_regime"
      ),
      contextId: mainContext.id,
      html: smallCompaniesRegimeHtmlFrs102,
    });
  }

  // FRS105: micro-entity regime (mapped via accounts.small_companies_regime → MicroEntityRegimeStatement)
  if (gaapFramework === "FRS105") {
    textBlocks.push({
      concept: getConceptByInternalKey(
        accountsTaxonomy.id,
        "accounts.small_companies_regime"
      ),
      contextId: mainContext.id,
      html: microEntityRegimeHtmlFrs105,
    });
  }

  // ------------------------------------------------------------
  // 10. BUILD XHTML INSTANCE
  // ------------------------------------------------------------
  const ixbrl = buildIxbrlInstance({
    taxonomy: accountsTaxonomy,
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

  return { ixbrl, framework: gaapFramework };
}
