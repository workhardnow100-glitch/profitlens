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

    // ✅ 4. Convert transactions → period objects
    const makePeriods = (txs) =>
      txs.map((tx) => ({
        periodLabel: tx.date,
        periodStart: tx.date,
        periodEnd: tx.date,
        locked: tx.tax_locked,
        hmrcAuthorized: !!tx.hmrc_category_id,
      }));

    // ✅ 5. Return clean JSON
    return res.status(200).json({
      vat: makePeriods(grouped.vat),
      cis: makePeriods(grouped.cis),
      corp: makePeriods(grouped.corp),
      sa: makePeriods(grouped.sa),
    });

  } catch (err) {
    console.error("Tax Hub periods error:", err);
    return res.status(500).json({ error: err.message });
  }
}
