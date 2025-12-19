// pages/api/tax-hub/periods.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]"; // ⬅️ adjust relative path if needed
import { supabaseAdmin } from "../../../lib/supabase-admin";

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

  const staggerMonths = {
    1: [0, 3, 6, 9],
    2: [1, 4, 7, 10],
    3: [2, 5, 8, 11],
  }[stagger];

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

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // ✅ Session + role/subscription checks
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );
  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ✅ Accountant-aware client ID
  const actingClientId =
    session.user.actingAsClientId || session.user.clientId;

  const { clientId } = req.body;
  if (!clientId)
    return res.status(400).json({ error: "Missing clientId" });

  // ✅ Prevent accountants from spoofing clientId
  if (session.user.role === "accountant" && clientId !== actingClientId) {
    return res.status(403).json({
      error: "Accountants cannot request tax periods for unauthorized clients",
    });
  }

  try {
    // ✅ AUDIT LOG — Accountant viewing Tax Hub periods
    if (session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([ 
        { 
          client_id: clientId, 
          actor_email: session.user.email, 
          action: "ACCOUNTANT_VIEW_TAX_HUB_PERIODS", 
          details: "Viewed VAT/CIS/CT/SA periods in Tax Hub" 
        } 
      ]);
    }

    // ✅ 1. Load HMRC categories
    const { data: categories, error: catError } = await supabaseAdmin
      .from("hmrc_categories")
      .select("id, canonical_name");
    if (catError) throw catError;

    const categoryMap = {};
    categories.forEach((c) => {
      categoryMap[c.id] = (c.canonical_name || "").toLowerCase();
    });

    // ✅ 2. Fetch all transactions
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("transactions")
      .select(
        "id, date, business_category, tax_locked, client_id, vat_amount, amount, cis_amount, cis_type"
      )
      .eq("client_id", clientId);
    if (txError) throw txError;

    // ✅ 3. Group by canonical tax type
    const grouped = { vat: [], cis: [], corp: [], sa: [] };
    transactions.forEach((tx) => {
      const canonical = (tx.business_category || "").toLowerCase();
      if (canonical === "vat") grouped.vat.push(tx);
      else if (canonical === "cis") grouped.cis.push(tx);
      else if (canonical === "corporation tax") grouped.corp.push(tx);
      else if (canonical === "self assessment") grouped.sa.push(tx);
    });

    // ✅ 4B. CIS monthly periods
    function buildCISPeriods(cisTxs) {
      const periods = {};
      cisTxs.forEach((tx) => {
        const d = new Date(tx.date);
        let periodStart = new Date(d.getFullYear(), d.getMonth(), 6);
        if (d.getDate() < 6) {
          periodStart = new Date(d.getFullYear(), d.getMonth() - 1, 6);
        }
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
          };
        }
        periods[key].transactions.push(tx);
        if (tx.tax_locked) periods[key].locked = true;
      });
      return Object.values(periods);
    }

    let cisPeriods = buildCISPeriods(grouped.cis);
    cisPeriods = cisPeriods.map((period) => {
      let cisDeducted = 0, cisSuffered = 0;
      period.transactions.forEach((tx) => {
        const amt = Number(tx.cis_amount || 0);
        if (tx.cis_type === "deducted") cisDeducted += amt;
        else if (tx.cis_type === "suffered") cisSuffered += amt;
      });
      return { ...period, cisDeducted, cisSuffered, netCis: cisDeducted - cisSuffered };
    });

    // ✅ 4C. Corporation Tax periods
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
          };
        }
        periods[key].transactions.push(tx);
        if (tx.tax_locked) periods[key].locked = true;
      });
      return Object.values(periods);
    }

    const corpPeriods = buildCorpPeriods(grouped.corp);

    // ✅ VAT logic
    const { data: vatSetting } = await supabaseAdmin
      .from("vat_settings")
      .select("stagger")
      .eq("client_id", clientId)
      .maybeSingle();
    let stagger = vatSetting?.stagger || 1;
    const rawVatPeriods = generateVatPeriods(stagger);

    let totalVatOwed = 0, totalVatOutput = 0, totalVatInput = 0;
    const vatPeriods = [];
    const now = new Date();

    // 🔑 Absolute URL for VAT summary fetch
    const baseUrl = `https://${process.env.VERCEL_URL || "profitlensuk.vercel.app"}`;

    for (const p of rawVatPeriods) {
      const summaryRes = await fetch(`${baseUrl}/api/vat/summary`, {
        method: "POST",
        headers: {
                    "Content-Type": "application/json",
          "x-internal-secret": process.env.INTERNAL_SECRET, // 🔑 bypass header
        },
        body: JSON.stringify({
          clientId,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
        }),
      });

      let box1 = 0;
      let box4 = 0;
      let box5 = 0;
      let locked = false;
      let submitted = false;

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
      const hasActivity =
        Math.abs(box1) > 0 ||
        Math.abs(box4) > 0 ||
        Math.abs(box5) !== 0;

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

    // ✅ Fetch vatPayments from database
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
      sa: grouped.sa.map((tx) => ({
        periodLabel: tx.date,
        periodStart: tx.date,
        periodEnd: tx.date,
        locked: tx.tax_locked,
        hmrcAuthorized:
          (tx.business_category || "").toLowerCase() === "self assessment",
      })),
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
