import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { clientId } = req.body;
  if (!clientId)
    return res.status(400).json({ error: "Missing clientId" });

  try {
    // ✅ 1. Load all HMRC categories (UUID → canonical_name)
    const { data: categories, error: catError } = await supabaseAdmin
      .from("hmrc_categories")
      .select("id, canonical_name");

    if (catError) throw catError;

    const categoryMap = {};
    categories.forEach((c) => {
      categoryMap[c.id] = (c.canonical_name || "").toLowerCase();
    });

    // ✅ 2. Fetch all transactions for this client
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("transactions")
      .select(
        "id, date, hmrc_category_id, tax_locked, client_id, category, vat_amount, amount"
      )
      .eq("client_id", clientId);

    if (txError) throw txError;

    // ✅ 3. Group by canonical tax type
    const grouped = { vat: [], cis: [], corp: [], sa: [] };

    transactions.forEach((tx) => {
      const canonical = categoryMap[tx.hmrc_category_id] || "";

      if (canonical === "vat") grouped.vat.push(tx);
      else if (canonical === "cis") grouped.cis.push(tx);
      else if (canonical === "corporation tax") grouped.corp.push(tx);
      else if (canonical === "self assessment") grouped.sa.push(tx);
    });

    // ✅ 4. Load VAT stagger (manual override)
    const { data: vatSetting } = await supabaseAdmin
      .from("vat_settings")
      .select("stagger")
      .eq("client_id", clientId)
      .single();

    let stagger = vatSetting?.stagger || null;

    // ✅ Auto-detect stagger from earliest VAT transaction
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

    // ✅ 4A. Simple periods (SA only)
    const makePeriods = (txs) =>
      txs.map((tx) => ({
        periodLabel: tx.date,
        periodStart: tx.date,
        periodEnd: tx.date,
        locked: tx.tax_locked,
        hmrcAuthorized: !!tx.hmrc_category_id,
      }));

    // ✅ 4B. CIS monthly periods (6th → 5th)
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

    // ✅ 4B.2 Add CIS totals
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

    // ✅ 4C. VAT quarterly periods (stagger-aware)
    function buildVATPeriods(vatTxs, stagger) {
      const periods = {};

      vatTxs.forEach((tx) => {
        const d = new Date(tx.date);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;

        const q1Start = stagger === 1 ? 1 : stagger === 2 ? 2 : 3;

        const offset = (month - q1Start + 12) % 12;
        const quarterIndex = Math.floor(offset / 3);

        const periodStart = new Date(year, q1Start - 1 + quarterIndex * 3, 1);
        const periodEnd = new Date(year, q1Start - 1 + quarterIndex * 3 + 3, 0);

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

    // ✅ 4D. VAT totals
    function addVatTotalsToPeriods(vatPeriods) {
      return vatPeriods.map((period) => {
        let outputVat = 0;
        let inputVat = 0;

        period.transactions.forEach((tx) => {
          const vat = Number(tx.vat_amount || 0);
          if (!vat) return;

          if (tx.category === "sales") {
            outputVat += vat;
          } else {
            inputVat += vat;
          }
        });

        return {
          ...period,
          outputVat,
          inputVat,
          netVat: outputVat - inputVat,
        };
      });
    }

    let vatPeriods = buildVATPeriods(grouped.vat, stagger);
    vatPeriods = addVatTotalsToPeriods(vatPeriods);

    // ✅ 4E. Corporation Tax annual periods
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

    // ✅ 5. Load VAT payments
    const { data: vatPayments } = await supabaseAdmin
      .from("vat_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("payment_date", { ascending: false });

    // ✅ 6. Compute VAT balance
    const totalVatOwed = vatPeriods.reduce(
      (sum, p) => sum + (p.netVat || 0),
      0
    );

    const totalVatPaid = (vatPayments || []).reduce(
      (sum, p) =>
        sum + (p.direction === "payment" ? p.amount : -p.amount),
      0
    );

    const vatBalance = totalVatOwed - totalVatPaid;

    // ✅ 7. Load CT payments
    const { data: ctPayments } = await supabaseAdmin
      .from("ct_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("payment_date", { ascending: false });

    // ✅ 8. Compute CT totals (profit + tax due)
    const totalCorpTaxDue = corpPeriods.reduce(
      (sum, p) => sum + (p.corpTaxDue || 0),
      0
    );

    // ✅ 9. Compute CT paid/refunded
    const totalCtPaid = (ctPayments || []).reduce(
      (sum, p) =>
        sum + (p.direction === "payment" ? p.amount : -p.amount),
      0
    );

    // ✅ 10. CT balance
    const ctBalance = totalCorpTaxDue - totalCtPaid;

    // ✅ 11. Return clean JSON
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
