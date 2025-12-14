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
      .select("id, date, hmrc_category_id, tax_locked, client_id")
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

    // ✅ 4A. Convert transactions → simple periods (VAT, Corp, SA)
    const makePeriods = (txs) =>
      txs.map((tx) => ({
        periodLabel: tx.date,
        periodStart: tx.date,
        periodEnd: tx.date,
        locked: tx.tax_locked,
        hmrcAuthorized: !!tx.hmrc_category_id,
      }));

    // ✅ 4B. Build CIS monthly periods (6th → 5th)
    function buildCISPeriods(cisTxs) {
      const periods = {};

      cisTxs.forEach((tx) => {
        const d = new Date(tx.date);

        // Determine CIS period start (6th of month)
        let periodStart = new Date(d.getFullYear(), d.getMonth(), 6);

        // If transaction is before the 6th, it belongs to previous period
        if (d.getDate() < 6) {
          periodStart = new Date(d.getFullYear(), d.getMonth() - 1, 6);
        }

        // Period end = 5th of next month
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

        // If ANY transaction is locked → whole period is locked
        if (tx.tax_locked) {
          periods[key].locked = true;
        }
      });

      return Object.values(periods);
    }

    const cisPeriods = buildCISPeriods(grouped.cis);

    // ✅ 5. Return clean JSON
    return res.status(200).json({
      vat: makePeriods(grouped.vat),
      cis: cisPeriods,
      corp: makePeriods(grouped.corp),
      sa: makePeriods(grouped.sa),
    });

  } catch (err) {
    console.error("Tax Hub periods error:", err);
    return res.status(500).json({ error: err.message });
  }
}
