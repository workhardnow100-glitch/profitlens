// pages/api/tax-hub/periods.js
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { clientId } = req.body;
  if (!clientId) return res.status(400).json({ error: "Missing clientId" });

  try {
    // Fetch all transactions for this client
    const { data: transactions, error } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("client_id", clientId);

    if (error) throw error;

    // Group by tax type (hmrc_category_id)
    const grouped = { vat: [], cis: [], corp: [], sa: [] };

    transactions.forEach((tx) => {
      // Example: Map specific UUIDs to tax types
      // Replace these with your real mappings
      if (tx.hmrc_category_id === "6157554f-3107-4116-b989-f5f4a44866b7") grouped.vat.push(tx);
      else if (tx.hmrc_category_id === "ff989cd7-269c-43fd-85cb-647751d98e22") grouped.cis.push(tx);
      else if (tx.hmrc_category_id === "638f87a3-63a0-4a04-bc68-9dd55f917732") grouped.corp.push(tx);
      else if (tx.hmrc_category_id === "3734faf6-4ce4-4580-94aa-368cb891ff9e") grouped.sa.push(tx);
    });

    // Transform into periods array
    const makePeriods = (txs) =>
      txs.map((tx) => ({
        periodLabel: tx.date,
        periodStart: tx.date,
        periodEnd: tx.date,
        locked: tx.tax_locked,
        hmrcAuthorized: !!tx.hmrc_category_id,
      }));

    res.status(200).json({
      vat: makePeriods(grouped.vat),
      cis: makePeriods(grouped.cis),
      corp: makePeriods(grouped.corp),
      sa: makePeriods(grouped.sa),
    });
  } catch (err) {
    console.error("Tax Hub periods error:", err);
    res.status(500).json({ error: err.message });
  }
}
