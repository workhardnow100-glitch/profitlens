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
        "id, date, hmrc_category_id, tax_locked, client_id, category, vat_amount"
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

    // ✅ 4A. Simple periods (Corp, SA)
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

    const cisPeriods = buildCISPeriods(grouped.cis);

    // ✅ 4C. VAT quarterly periods (Stagger 1 default)
    function buildVATPeriods(vatTxs) {
      const periods = {};

      vatTxs.forEach((tx) => {
        const d = new Date(tx.date);
        const year = d.getFullYear();
        const month = d.getMonth() + 1;

        let periodStart, periodEnd;

        if (month >= 1 && month <= 3) {
          periodStart = new Date(year, 0, 1); // Jan 1
          periodEnd = new Date(year, 2, 31);  // Mar 31
        } else if (month >= 4 && month <= 6) {
          periodStart = new Date(year, 3, 1); // Apr 1
          periodEnd = new Date(year, 5, 30);  // Jun 30
        } else if (month >= 7 && month <= 9) {
          periodStart = new Date(year, 6, 1); // Jul 1
          periodEnd = new Date(year, 8, 30);  // Sep 30
        } else {
          periodStart = new Date(year, 9, 1); // Oct 1
          periodEnd = new Date(year, 11, 31); // Dec 31
        }

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

    // ✅ 4D. VAT totals per period (Output, Input, Net)
    function addVatTotalsToPeriods(vatPeriods) {
      return vatPeriods.map((period) => {
        let outputVat = 0;
        let inputVat = 0;

        period.transactions.forEach((tx) => {
          const vat = Number(tx.vat_amount || 0);

          if (!vat) return;

          // Sales → Output VAT
          if (tx.category === "sales") {
            outputVat += vat;
          } else {
            // Everything else → Input VAT
            inputVat += vat;
          }
        });

        const netVat = outputVat - inputVat;

        return {
          ...period,
          outputVat,
          inputVat,
          netVat,
        };
      });
    }

    let vatPeriods = buildVATPeriods(grouped.vat);
    vatPeriods = addVatTotalsToPeriods(vatPeriods);

    // ✅ 5. Return clean JSON
    return res.status(200).json({
      vat: vatPeriods,
      cis: cisPeriods,
      corp: makePeriods(grouped.corp),
      sa: makePeriods(grouped.sa),
    });

  } catch (err) {
    console.error("Tax Hub periods error:", err);
    return res.status(500).json({ error: err.message });
  }
}
