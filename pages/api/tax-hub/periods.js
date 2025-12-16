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
function generateVatPeriods(stagger, yearsBack = 2) {
  const now = new Date();
  const periods = [];

  const staggerMonths = {
    1: [0, 3, 6, 9],   // Jan, Apr, Jul, Oct
    2: [1, 4, 7, 10],  // Feb, May, Aug, Nov
    3: [2, 5, 8, 11],  // Mar, Jun, Sep, Dec
  }[stagger];

  for (let y = now.getFullYear() - yearsBack; y <= now.getFullYear(); y++) {
    for (const m of staggerMonths) {
      const start = new Date(y, m, 16);       // 16th
      const end = new Date(y, m + 3, 15);     // 15th, 3 months later

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

  // newest first
  return periods.reverse();
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { clientId } = req.body;
  if (!clientId)
    return res.status(400).json({ error: "Missing clientId" });

  try {
    // 1. Load HMRC categories (UUID → canonical_name)
    const { data: categories, error: catError } = await supabaseAdmin
      .from("hmrc_categories")
      .select("id, canonical_name");

    if (catError) throw catError;

    const categoryMap = {};
    categories.forEach((c) => {
      categoryMap[c.id] = (c.canonical_name || "").toLowerCase();
    });

    // 2. Fetch all transactions for this client
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("transactions")
      .select(
        "id, date, hmrc_category_id, tax_locked, client_id, category, vat_amount, amount"
      )
      .eq("client_id", clientId);

    if (txError) throw txError;

    // 3. Group by canonical tax type (for CIS / Corp / SA)
    const grouped = { vat: [], cis: [], corp: [], sa: [] };

    transactions.forEach((tx) => {
      const canonical = categoryMap[tx.hmrc_category_id] || "";

      if (canonical === "vat") grouped.vat.push(tx);
      else if (canonical === "cis") grouped.cis.push(tx);
      else if (canonical === "corporation tax") grouped.corp.push(tx);
      else if (canonical === "self assessment") grouped.sa.push(tx);
    });

    // 4. VAT stagger from settings (manual override)
    const { data: vatSetting } = await supabaseAdmin
      .from("vat_settings")
      .select("stagger")
      .eq("client_id", clientId)
      .maybeSingle();

    let stagger = vatSetting?.stagger || null;

    // If no explicit stagger, infer from earliest VAT tx
    if (!stagger && grouped.vat.length > 0) {
      const earliest = grouped.vat
        .map((tx) => new Date(tx.date))
        .sort((a, b) => a - b)[0];

      const month = earliest.getMonth() + 1;

      if (month === 1) stagger = 1;
      else if (month === 2) stagger = 2;
      else if (month === 3) stagger = 3;
      else stagger = 1;
    }

    if (!stagger) stagger = 1;

    // 4A. Simple SA periods (placeholder)
    const makePeriods = (txs) =>
      txs.map((tx) => ({
        periodLabel: tx.date,
        periodStart: tx.date,
        periodEnd: tx.date,
        locked: tx.tax_locked,
        hmrcAuthorized: !!tx.hmrc_category_id,
      }));

    // 4B. CIS monthly periods (6th → 5th)
    function buildCISPeriods(cisTxs) {
      const periods = {};

      cisTxs.forEach((tx) => {
        const d = new Date(tx.date);

        let periodStart = new Date(d.getFullYear(), d.getMonth(), 6);
        if (d.getDate() < 6) {
          periodStart = new Date(d.getFullYear(), d.getMonth() - 1, 6);
        }

        const periodEnd = new Date(
          periodStart.getFullYear(),
          periodStart.getMonth() + 1,
          5
        );

        const key = `${periodStart.toISOString().slice(0, 10)}_${periodEnd
          .toISOString()
          .slice(0, 10)}`;

        if (!periods[key]) {
          periods[key] = {
            periodLabel: `${periodStart
              .toISOString()
              .slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)}`,
            periodStart: periodStart.toISOString().slice(0, 10),
            periodEnd: periodEnd.toISOString().slice(0, 10),
            locked: false,
            hmrcAuthorized: true,
            transactions: [],
          };
        }

        periods[key].transactions.push(tx);

        if (tx.tax_locked) {
          periods[key].locked = true;
        }
      });

      return Object.values(periods);
    }

    let cisPeriods = buildCISPeriods(grouped.cis);

    // 4B.2 CIS totals
    function addCisTotalsToPeriods(cisPeriods) {
      return cisPeriods.map((period) => {
        let cisDeducted = 0;
        let cisSuffered = 0;

        period.transactions.forEach((tx) => {
          if (tx.category === "cis_deducted") {
            cisDeducted += Number(tx.vat_amount || 0);
          }
          if (tx.category === "cis_suffered") {
            cisSuffered += Number(tx.vat_amount || 0);
          }
        });

        return {
          ...period,
          cisDeducted,
          cisSuffered,
          netCis: cisDeducted - cisSuffered,
        };
      });
    }

    cisPeriods = addCisTotalsToPeriods(cisPeriods);

    // 4C. Corporation Tax annual periods
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
            periodLabel: `${periodStart
              .toISOString()
              .slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)}`,
            periodStart: periodStart.toISOString().slice(0, 10),
            periodEnd: periodEnd.toISOString().slice(0, 10),
            locked: false,
            hmrcAuthorized: true,
            transactions: [],
          };
        }

        periods[key].transactions.push(tx);

        if (tx.tax_locked) {
          periods[key].locked = true;
        }
      });

      return Object.values(periods);
    }

    const corpPeriods = buildCorpPeriods(grouped.corp);

    // 5. Load VAT payments
    const { data: vatPayments } = await supabaseAdmin
      .from("vat_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("payment_date", { ascending: false });

    // 6. Build VAT periods via stagger + VAT summary engine
    const rawVatPeriods = generateVatPeriods(stagger);

    let totalVatOwed = 0;
    const vatPeriods = [];

    for (const p of rawVatPeriods) {
      // ✅ PRODUCTION-SAFE internal call using origin header
      const summaryRes = await fetch(
        `${req.headers.origin}/api/vat/summary`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            periodStart: p.periodStart,
            periodEnd: p.periodEnd,
          }),
        }
      );

      if (!summaryRes.ok) {
        // If summary fails, just treat as zeroed period
        vatPeriods.push({
          periodLabel: p.periodLabel,
          periodStart: p.periodStart,
          periodEnd: p.periodEnd,
          locked: false,
          hmrcAuthorized: false,
          submitted: false,
          outputVat: 0,
          inputVat: 0,
          netVat: 0,
        });
        continue;
      }

      const summary = await summaryRes.json();

      const box1 = summary.boxes?.box1 || 0;
      const box4 = summary.boxes?.box4 || 0;
      const box5 = summary.boxes?.box5 || 0; // net VAT to pay/refund

      totalVatOwed += box5;

      vatPeriods.push({
        periodLabel: p.periodLabel,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        locked: summary.locked || false,
        hmrcAuthorized: true, // you can swap to client-based flag later
        submitted: summary.submitted || false,
        outputVat: box1,
        inputVat: box4,
        netVat: box5,
      });
    }

    // 7. Compute VAT paid / balance
    const totalVatPaid = (vatPayments || []).reduce(
      (sum, p) =>
        sum + (p.direction === "payment" ? p.amount : -p.amount),
      0
    );

    const vatBalance = totalVatOwed - totalVatPaid;

    // 8. Load CT payments
    const { data: ctPayments } = await supabaseAdmin
      .from("ct_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("payment_date", { ascending: false });

    // 9. Compute CT totals
    const totalCorpTaxDue = corpPeriods.reduce(
      (sum, p) => sum + (p.corpTaxDue || 0),
      0
    );

    // 10. Compute CT paid/refunded
    const totalCtPaid = (ctPayments || []).reduce(
      (sum, p) =>
        sum + (p.direction === "payment" ? p.amount : -p.amount),
      0
    );

    const ctBalance = totalCorpTaxDue - totalCtPaid;

    // 11. Return clean JSON for Tax Hub
    return res.status(200).json({
      vat: vatPeriods,
      cis: cisPeriods,
      corp: corpPeriods,
      sa: makePeriods(grouped.sa),

      vatStagger: stagger,

      vatPayments,
      totalVatOwed,
      totalVatPaid,
      vatBalance,

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
