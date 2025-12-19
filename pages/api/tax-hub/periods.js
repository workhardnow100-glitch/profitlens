// pages/api/tax-hub/periods.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]"; // adjust if needed
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { SYSTEM_CATEGORIES } from "../../../lib/constants/systemCategories";
import { CT_MAP } from "../../../lib/constants/ctMap";

// Build allowed categories like the transactions API
const ALLOWED_BUSINESS_CATEGORIES = new Set([
  ...SYSTEM_CATEGORIES,
  ...CT_MAP.income,
  ...CT_MAP.allowable,
  ...CT_MAP.disallowable,
  ...CT_MAP.ignore,
]);

// System-only inference (safe), mirroring transactions API
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

// Helper: format date → YYYY-MM-DD
function fmt(d) {
  return d.toISOString().split("T")[0];
}

// Helper: label like "16 Sep 2024 → 16 Dec 2024"
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

// Generate VAT periods based on stagger (16th → 15th, HMRC style)
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

// CIS monthly periods (6th → 5th) with totals
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

    const amt = Number(tx.cis_amount || 0);
    if (tx.cis_type === "deducted") periods[key].cisDeducted += amt;
    else if (tx.cis_type === "suffered") periods[key].cisSuffered += amt;
    periods[key].netCis = periods[key].cisDeducted - periods[key].cisSuffered;
  });
  return Object.values(periods);
}

// Corporation Tax periods (calendar year buckets)
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
        corpTaxDue: 0, // placeholder; your CT logic can populate this if needed
      };
    }
    periods[key].transactions.push(tx);
    if (tx.tax_locked) periods[key].locked = true;
  });
  return Object.values(periods);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Session + role/subscription checks (kept, but non-blocking to data if valid)
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(session.user.subscriptionStatus);
  if (!(isFounder || isSubscribedOrTrial)) return res.status(403).json({ error: "Upgrade required" });

  // Accountant-aware client ID
  const actingClientId = session.user.actingAsClientId || session.user.clientId;

  const { clientId } = req.body;
  if (!clientId) return res.status(400).json({ error: "Missing clientId" });

  // Prevent accountants from spoofing clientId
  if (session.user.role === "accountant" && clientId !== actingClientId) {
    return res.status(403).json({
      error: "Accountants cannot request tax periods for unauthorized clients",
    });
  }

  try {
    // AUDIT LOG — Accountant viewing Tax Hub periods
    if (session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_TAX_HUB_PERIODS",
          details: "Viewed VAT/CIS/CT/SA periods in Tax Hub",
        },
      ]);
    }

    // Fetch transactions with fields needed for enrichment
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("transactions")
      .select(
        "id, date, business_category, tax_locked, client_id, vat_amount, amount, cis_amount, cis_type, type, description"
      )
      .eq("client_id", clientId)
      .order("date", { ascending: false });

    if (txError) throw txError;

    // Enrich categories exactly like the transactions API
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

    // Bucket into VAT, CIS, CT, SA based on enriched categories
    const grouped = { vat: [], cis: [], corp: [], sa: [] };
    enriched.forEach((tx) => {
      const c = (tx.business_category || "").toLowerCase();
      if (c.includes("vat")) grouped.vat.push(tx);
      else if (c.includes("cis")) grouped.cis.push(tx);
      else if (c.includes("corporation tax")) grouped.corp.push(tx);
      else if (c.includes("self assessment") || c.includes("sa payment")) grouped.sa.push(tx);
    });

    // CIS
    const cisPeriods = buildCISPeriods(grouped.cis);

    // Corporation Tax
    const corpPeriods = buildCorpPeriods(grouped.corp);

    // VAT settings and periods
    const { data: vatSetting } = await supabaseAdmin
      .from("vat_settings")
      .select("stagger")
      .eq("client_id", clientId)
      .maybeSingle();

    const stagger = vatSetting?.stagger || 1;
    const rawVatPeriods = generateVatPeriods(stagger);

    // VAT summary aggregation via internal call (absolute URL + bypass header)
    let totalVatOwed = 0, totalVatOutput = 0, totalVatInput = 0;
    const vatPeriods = [];
    const now = new Date();

    const baseUrl = `https://${process.env.VERCEL_URL || "profitlensuk.vercel.app"}`;

    for (const p of rawVatPeriods) {
      const summaryRes = await fetch(`${baseUrl}/api/vat/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": process.env.INTERNAL_SECRET,
        },
        body: JSON.stringify({
          clientId,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
        }),
      });

      let box1 = 0, box4 = 0, box5 = 0, locked = false, submitted = false;

      if (summaryRes.ok) {
        const summary = await summaryRes.json();
        box1 = summary.boxes?.box1 || 0;
        box4 = summary.boxes?.box4 || 0;
        box5 = summary.boxes?.box5 || 0;
        locked = summary.locked || false;
        submitted = summary.submitted || false;
      }

      totalVatOwed += box5;
      totalVatOutput += box1;
      totalVatInput += box4;

      const endDate = new Date(p.periodEnd);
      const hasActivity = Math.abs(box1) > 0 || Math.abs(box4) > 0 || Math.abs(box5) !== 0;

      let status = "Draft";
      if (submitted) status = "Submitted";
      else if (endDate < now && hasActivity) status = "Overdue";
      else if (hasActivity) status = "Ready to Submit";
      else if (endDate < now && !hasActivity) status = "Draft (No Activity)";

      const overdue = !submitted && endDate < now && hasActivity;

      vatPeriods.push({
        periodLabel: p.periodLabel,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        locked,
        hmrcAuthorized: true,
        submitted,
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

    const totalCorpTaxDue = corpPeriods.reduce((sum, p) => sum + (p.corpTaxDue || 0), 0);
    const totalCtPaid = (ctPayments || []).reduce(
      (sum, p) => sum + (p.direction === "payment" ? p.amount : -p.amount),
      0
    );
    const ctBalance = totalCorpTaxDue - totalCtPaid;

    const overdueVatCount = vatPeriods.filter((p) => p.overdue).length;

    // SA bucket: as per old version, reflect transactions marked SA/SA Payment
    const saPeriods = grouped.sa.map((tx) => ({
      periodLabel: tx.date,
      periodStart: tx.date,
      periodEnd: tx.date,
      locked: tx.tax_locked,
      hmrcAuthorized: (tx.business_category || "").toLowerCase().includes("self assessment") || (tx.business_category || "").toLowerCase().includes("sa payment"),
    }));

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
