// pages/api/tax-hub/periods.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { SYSTEM_CATEGORIES } from "../../../lib/constants/systemCategories";
import { CT_MAP } from "../../../lib/constants/ctMap";
import vatSummaryHandler from "../vat/summary";

// ------------------------------
// CORPORATION TAX CALCULATOR
// ------------------------------
function calculateCorporationTax(profit) {
  if (profit <= 0) return { tax: 0, rate: 0 };

  const smallProfitsRate = 0.19;
  const mainRate = 0.25;

  if (profit <= 50000) {
    return { tax: profit * smallProfitsRate, rate: 19 };
  }

  if (profit >= 250000) {
    return { tax: profit * mainRate, rate: 25 };
  }

  const marginalRelief = ((250000 - profit) / 200000) * (0.25 - 0.19);
  const effectiveRate = 0.25 - marginalRelief;

  return {
    tax: profit * effectiveRate,
    rate: effectiveRate * 100,
  };
}

// ------------------------------
// LOWERCASE CT MAP
// ------------------------------
const CT_MAP_LOWER = {
  income: new Set(CT_MAP.income.map((c) => c.toLowerCase())),
  allowable: new Set(CT_MAP.allowable.map((c) => c.toLowerCase())),
  disallowable: new Set(CT_MAP.disallowable.map((c) => c.toLowerCase())),
  ignore: new Set(CT_MAP.ignore.map((c) => c.toLowerCase())),
};

// ------------------------------
// ALLOWED CATEGORIES
// ------------------------------
const ALLOWED_BUSINESS_CATEGORIES = new Set([
  ...SYSTEM_CATEGORIES,
  ...CT_MAP.income,
  ...CT_MAP.allowable,
  ...CT_MAP.disallowable,
  ...CT_MAP.ignore,
]);

// ------------------------------
// SYSTEM CATEGORY INFERENCE
// ------------------------------
function inferSystemCategory(type = "", description = "") {
  const normalizedType = type?.trim().toUpperCase() || "";
  const desc = description?.toLowerCase?.() || "";

  if (normalizedType === "TFR") return "Transfers";
  if (normalizedType === "FPI" || normalizedType === "FPO") return "Transfers";
  if (normalizedType === "DD") return "Returned Direct Debit";
  if (normalizedType === "SO") return "Internal Transfers";
  if (normalizedType === "CPT") return "Cash Deposit";
  if (normalizedType === "CHG" || normalizedType === "FEE") return "Bank Charges";

  if (/\bRETURNED\s*DIRECT\s*DEBIT\b/i.test(description)) return "Returned Direct Debit";
  if (/\bTRANSFER\b/i.test(description)) return "Transfers";
  if (/\bCASH\s*(WITHDRAWAL|DEPOSIT|ATM)\b/i.test(description)) return "Cash Deposit";
  if (/\bCARD\s*PAYMENT\b/i.test(description)) return "Card Payment";

  if (/\bHMRC\b/i.test(description)) {
    if (/\bVAT\b/i.test(description)) return "VAT Paid";
    if (/\bCIS\b/i.test(description)) return "CIS Suffered";
    if (/\bCORP(ORATION)?\s*TAX\b/i.test(description)) return "Corporation Tax Payment";
    if (/\bSELF\s*ASSESSMENT\b/i.test(description) || /\bSA\b/i.test(description)) {
      return "SA Payment";
    }
    return "SA Payment";
  }

  if (/\bDIRECTOR\b/i.test(description) && /\bLOAN\b/i.test(description)) {
    if (/\bDRAW(ING)?S?\b/i.test(description)) return "Director Loan – Drawings";
    if (/\bREPAY(MENT)?S?\b/i.test(description)) return "Director Loan – Repayments";
    if (/\bINTEREST\b/i.test(description) && /\bCHARGED\b/i.test(description))
      return "Director Loan – Interest Charged";
    if (/\bINTEREST\b/i.test(description) && /\bPAID\b/i.test(description))
      return "Director Loan – Interest Paid";
  }

  return null;
}

// ------------------------------
// HELPERS
// ------------------------------
function fmt(d) {
  return d.toISOString().split("T")[0];
}

function label(start, end) {
  return `${new Date(start).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })} → ${new Date(end).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
}

// ------------------------------
// VAT PERIOD GENERATOR
// ------------------------------
function generateVatPeriods(stagger, yearsBack = 5) {
  const now = new Date();
  const periods = [];
  const staggerMonths = { 1: [0, 3, 6, 9], 2: [1, 4, 7, 10], 3: [2, 5, 8, 11] }[stagger];

  for (let y = now.getFullYear() - yearsBack; y <= now.getFullYear(); y++) {
    for (const m of staggerMonths) {
      const start = new Date(y, m, 16);
      const end = new Date(y, m + 3, 15);
      if (end <= now) {
        const startStr = fmt(start);
        const endStr = fmt(end);
        periods.push({
          periodStart: startStr,
          periodEnd: endStr,
          periodLabel: label(startStr, endStr),
        });
      }
    }
  }
  return periods.reverse();
}

// ------------------------------
// CIS PERIOD BUILDER
// ------------------------------
function buildCISPeriods(cisTxs) {
  const periods = {};
  cisTxs.forEach((tx) => {
    const d = new Date(tx.date);
    let periodStart = new Date(d.getFullYear(), d.getMonth(), 6);
    if (d.getDate() < 6) periodStart = new Date(d.getFullYear(), d.getMonth() - 1, 6);
    const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 5);
    const key = `${periodStart.toISOString().slice(0, 10)}_${periodEnd.toISOString().slice(0, 10)}`;

    if (!periods[key]) {
      periods[key] = {
        periodLabel: `${periodStart.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)}`,
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: periodEnd.toISOString().slice(0, 10),
        locked: false,
        hmrcAuthorized: true,
        transactions: [],
        cisDeducted: 0,
        cisSuffered: 0,
        netCis: 0,
      };
    }
    periods[key].transactions.push(tx);
    if (tx.tax_locked) periods[key].locked = true;

    const amt = Math.abs(Number(tx.cis_amount || 0));
    if (tx.cis_type === "deducted") periods[key].cisDeducted += amt;
    else if (tx.cis_type === "suffered") periods[key].cisSuffered += amt;
    periods[key].netCis = periods[key].cisDeducted - periods[key].cisSuffered;
  });
  return Object.values(periods);
}

// ------------------------------
// CORPORATION TAX PERIOD BUILDER
// ------------------------------
function buildCorpPeriods(corpTxs) {
  const periods = {};
  corpTxs.forEach((tx) => {
    const d = new Date(tx.date);
    const year = d.getFullYear();
    const periodStart = new Date(year, 0, 1);
    const periodEnd = new Date(year, 11, 31);
    const key = `${year}`;

    if (!periods[key]) {
      periods[key] = {
        periodLabel: `${periodStart.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)}`,
        periodStart: periodStart.toISOString().slice(0, 10),
        periodEnd: periodEnd.toISOString().slice(0, 10),
        locked: false,
        hmrcAuthorized: true,
        transactions: [],
        corpTaxDue: 0,
      };
    }
    periods[key].transactions.push(tx);
    if (tx.tax_locked) periods[key].locked = true;
  });
  return Object.values(periods);
}

// ------------------------------
// MAIN HANDLER
// ------------------------------
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);

  // ⭐ THIS is the correct place
  console.log("🧪 TaxHub API session.user:", JSON.stringify(session?.user, null, 2));

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(session.user.subscriptionStatus);
  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  let clientId = null;

  if (session.user.role === "accountant") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId;
  }


  if (!clientId) {
    console.log("🧪 Tax Hub resolved clientId is NULL. Role:", session.user.role);
    console.log("🧪 actingAsClientId:", session.user.actingAsClientId);
    console.log("🧪 accessibleClients:", session.user.accessibleClients);
    return res.status(400).json({ error: "No client selected" });
  }

  try {
    // ------------------------------
    // AUDIT (ACCOUNTANT ONLY)
    // ------------------------------
    if (session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([{
        id: crypto.randomUUID(),
        client_id: clientId,
        actor_email: session.user.email,
        action: "ACCOUNTANT_VIEW_TAX_HUB_PERIODS",
        details: "Viewed VAT/CIS/CT/SA periods in Tax Hub",
        timestamp: new Date().toISOString(),
        user: null,
        user_id: null,
      }]);
    }

    // ------------------------------
    // FETCH TRANSACTIONS
    // ------------------------------
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("transactions")
      .select(
        "id, date, business_category, tax_locked, client_id, vat_amount, amount, cis_amount, cis_type, type, description"
      )
      .eq("client_id", clientId)
      .order("date", { ascending: false });

    if (txError) throw txError;

    // ------------------------------
    // CATEGORY ENRICHMENT
    // ------------------------------
    const enriched = (transactions || []).map((tx) => {
      let category = tx.business_category?.trim() || null;

      if (category && !ALLOWED_BUSINESS_CATEGORIES.has(category)) {
        category = "Uncategorised";
      }

      if (!category) {
        const sys = inferSystemCategory(tx.type, tx.description);
        if (sys && SYSTEM_CATEGORIES.includes(sys)) {
          category = sys;
        } else {
          category = "Uncategorised";
        }
      }

      return { ...tx, business_category: category };
    });

    // ------------------------------
    // GROUP INTO TAX TYPES
    // ------------------------------
    const grouped = { vat: [], cis: [], corp: [], sa: [] };
    enriched.forEach((tx) => {
      const c = (tx.business_category || "").toLowerCase();
      if (c.includes("vat")) grouped.vat.push(tx);
      else if (c.includes("cis")) grouped.cis.push(tx);
      else if (c.includes("corporation tax")) grouped.corp.push(tx);
      else if (c.includes("self assessment") || c.includes("sa payment")) grouped.sa.push(tx);
    });

    // ------------------------------
    // CIS PERIODS
    // ------------------------------
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    const cisSource = (transactions || []).filter((tx) => {
      if (!tx.cis_type || tx.cis_amount === null || tx.cis_amount === undefined) return false;
      if (!tx.date) return false;
      const d = new Date(tx.date);
      return d >= fiveYearsAgo;
    });

    const cisPeriods = buildCISPeriods(cisSource);

    // ------------------------------
    // CORPORATION TAX PERIODS
    // ------------------------------
    const now = new Date();
    const currentYear = now.getFullYear();
    const yearsBack = 5;
    const corpPeriods = [];

    for (let year = currentYear; year > currentYear - yearsBack; year--) {
      const periodStartDate = new Date(year, 0, 1);
      const periodEndDate = new Date(year, 11, 31);
      const periodStart = fmt(periodStartDate);
      const periodEnd = fmt(periodEndDate);

      const yearTxs = enriched.filter((tx) => {
        if (!tx.date) return false;
        const d = new Date(tx.date);
        return d.getFullYear() === year;
      });

      if (yearTxs.length === 0) continue;

      let income = 0;
      let allowable = 0;
      let disallowable = 0;
      let locked = false;

      yearTxs.forEach((tx) => {
        const cat = (tx.business_category || "Uncategorised").trim();
        const key = cat.toLowerCase();
        const amount = Number(tx.amount || 0);

        if (tx.tax_locked) locked = true;

        if (CT_MAP_LOWER.income.has(key) && amount > 0) {
          income += amount;
        } else if (CT_MAP_LOWER.allowable.has(key) && amount < 0) {
          allowable += Math.abs(amount);
        } else if (CT_MAP_LOWER.disallowable.has(key) && amount < 0) {
          disallowable += Math.abs(amount);
        }
      });

      const profit = income - allowable;
      const adjustedProfit = profit + disallowable;
      const { tax: corpTaxDue, rate: effectiveRate } = calculateCorporationTax(adjustedProfit);

      corpPeriods.push({
        periodLabel: `${periodStart} → ${periodEnd}`,
        periodStart,
        periodEnd,
        locked,
        hmrcAuthorized: true,
        transactions: yearTxs,
        corpTaxDue,
        income,
        allowable,
        disallowable,
        profit,
        adjustedProfit,
        effectiveRate,
      });
    }

    // ------------------------------
    // SELF ASSESSMENT PERIODS
    // ------------------------------
    const saPeriods = [];
    for (let year = currentYear; year > currentYear - yearsBack; year--) {
      const periodStartDate = new Date(year, 0, 1);
      const periodEndDate = new Date(year, 11, 31);
      const periodStart = fmt(periodStartDate);
      const periodEnd = fmt(periodEndDate);

      const yearTxs = enriched.filter((tx) => {
        if (!tx.date) return false;
        const d = new Date(tx.date);
        return d.getFullYear() === year;
      });

      if (yearTxs.length === 0) continue;

      let totalIncome = 0;
      let totalExpenses = 0;
      let locked = false;

      const saTxs = [];

      yearTxs.forEach((tx) => {
        const cat = (tx.business_category || "").toLowerCase();
        const amt = Number(tx.amount || 0);

        let isSA = false;

        if (CT_MAP_LOWER.income.has(cat)) {
          if (amt > 0) totalIncome += amt;
          isSA = true;
        }

        if (CT_MAP_LOWER.allowable.has(cat) || CT_MAP_LOWER.disallowable.has(cat)) {
          if (amt < 0) totalExpenses += Math.abs(amt);
          isSA = true;
        }

        if (tx.tax_locked) locked = true;
        if (isSA) saTxs.push(tx);
      });

      if (saTxs.length === 0) continue;

      const profit = totalIncome - totalExpenses;

      let personalAllowance = 12570;
      if (profit > 100000) {
        const reduction = Math.floor((profit - 100000) / 2);
        personalAllowance = Math.max(0, personalAllowance - reduction);
      }

      const taxableIncome = Math.max(0, profit - personalAllowance);

      let taxLiability = 0;
      let remaining = taxableIncome;

      const basicLimit = 50270 - personalAllowance;
      if (remaining > 0) {
        const basicTaxable = Math.min(remaining, basicLimit);
        taxLiability += basicTaxable * 0.20;
        remaining -= basicTaxable;
      }

      const higherLimit = 125140 - 50270;
      if (remaining > 0) {
        const higherTaxable = Math.min(remaining, higherLimit);
        taxLiability += higherTaxable * 0.40;
        remaining -= higherTaxable;
      }

      if (remaining > 0) {
        taxLiability += remaining * 0.45;
      }

           saPeriods.push({
        periodLabel: `${periodStart} → ${periodEnd}`,
        periodStart,
        periodEnd,
        locked,
        hmrcAuthorized: true,
        transactions: saTxs,
        totalIncome,
        totalExpenses,
        profit,
        personalAllowance,
        taxableIncome,
        taxLiability,
      });
    }
    // ------------------------------
    // VAT SETTINGS + PERIODS
    // ------------------------------
    const { data: vatSetting } = await supabaseAdmin
      .from("vat_settings")
      .select("stagger")
      .eq("client_id", clientId)
      .maybeSingle();

    const stagger = vatSetting?.stagger || 1;
    const rawVatPeriods = generateVatPeriods(stagger);

    // Fetch all MTD submissions for this client for all periods in view
    const { data: mtdRows } = await supabaseAdmin
      .from("vat_mtd_submissions")
      .select("*")
      .eq("client_id", clientId)
      .in("period_start", rawVatPeriods.map((p) => p.periodStart))
      .in("period_end", rawVatPeriods.map((p) => p.periodEnd));

    // Build lookup: "start_end" → submission row
    const mtdMap = {};
    (mtdRows || []).forEach((row) => {
      const key = `${row.period_start}_${row.period_end}`;
      mtdMap[key] = row;
    });

    // VAT summary aggregation
    let totalVatOwed = 0,
      totalVatOutput = 0,
      totalVatInput = 0;

    const vatPeriods = [];

    for (const p of rawVatPeriods) {
      // Call VAT summary API internally
      const mockReq = {
        method: "POST",
        headers: { "x-internal-secret": process.env.INTERNAL_SECRET },
        body: { clientId, periodStart: p.periodStart, periodEnd: p.periodEnd },
      };

      let summary;
      await vatSummaryHandler(mockReq, {
        status: () => ({
          json: (obj) => {
            summary = obj;
            return obj;
          },
        }),
      });

      let box1 = summary?.boxes?.box1 || 0;
      let box4 = summary?.boxes?.box4 || 0;
      let box5 = summary?.boxes?.box5 || 0;

      let locked = summary?.locked || false;
      let submitted = summary?.submitted || false;

      totalVatOwed += box5;
      totalVatOutput += box1;
      totalVatInput += box4;

      const endDate = new Date(p.periodEnd);
      const hasActivity =
        Math.abs(box1) > 0 || Math.abs(box4) > 0 || Math.abs(box5) !== 0;

      // Base status
      let status = "Draft";
      if (submitted) status = "Submitted";
      else if (endDate < now && hasActivity) status = "Overdue";
      else if (hasActivity) status = "Ready to Submit";
      else if (endDate < now && !hasActivity) status = "Draft (No Activity)";

      let overdue = !submitted && endDate < now && hasActivity;

      // 🔥 MTD submission merge
      const key = `${p.periodStart}_${p.periodEnd}`;
      const mtd = mtdMap[key];

      let hmrcReference = null;
      let processingDate = null;

      if (mtd) {
        hmrcReference = mtd.hmrc_reference;
        processingDate = mtd.updated_at;

        if (mtd.status === "submitted") {
          submitted = true;
          locked = true;
          status = "Submitted (MTD)";
          overdue = false;
        }
      }

      vatPeriods.push({
        periodLabel: p.periodLabel,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        locked,
        hmrcAuthorized: true,
        submitted,
        hmrcReference,
        processingDate,
        outputVat: box1,
        inputVat: box4,
        netVat: box5,
        status,
        overdue,
      });
    }
    // VAT payments + balances
    const { data: vatPayments, error: vatPaymentsError } = await supabaseAdmin
      .from("vat_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("payment_date", { ascending: false });
    if (vatPaymentsError) throw vatPaymentsError;

    const totalVatPaid = (vatPayments || []).reduce(
      (sum, p) => sum + (p.direction === "payment" ? p.amount : -p.amount),
      0
    );
    const vatBalance = totalVatOwed - totalVatPaid;

    // CT payments + balances
    const { data: ctPayments } = await supabaseAdmin
      .from("ct_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("payment_date", { ascending: false });

    const totalCorpTaxDue = corpPeriods.reduce(
      (sum, p) => sum + (p.corpTaxDue || 0),
      0
    );
    const totalCtPaid = (ctPayments || []).reduce(
      (sum, p) => sum + (p.direction === "payment" ? p.amount : -p.amount),
      0
    );
    const ctBalance = totalCorpTaxDue - totalCtPaid;

    const overdueVatCount = vatPeriods.filter((p) => p.overdue).length;

    return res.status(200).json({
      vat: vatPeriods,
      cis: cisPeriods,
      corp: corpPeriods,
      sa: saPeriods,
      vatStagger: stagger,
      vatPayments,
      totalVatOwed,
      totalVatPaid,
      vatBalance,
      totalVatOutput,
      totalVatInput,
      overdueVatCount,
      ctPayments,
      totalCorpTaxDue,
      totalCtPaid,
      ctBalance,
    });
  } catch (err) {
    console.error("Tax Hub periods error:", err);
    return res.status(500).json({ error: err.message });
  }
}
