// pages/api/cis/summary.js
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { clientId, periodStart, periodEnd } = req.body;

  if (!clientId || !periodStart || !periodEnd)
    return res.status(400).json({ error: "Missing required fields" });

  try {
    // ✅ Load transactions
    const { data: tx, error } = await supabaseAdmin
      .from("transactions")
      .select("id, date, category, cis_amount, tax_locked, hmrc_category_id")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (error) throw error;

    // ✅ Filter CIS‑mapped transactions
    const cisTx = tx.filter(
      (t) => t.hmrc_category_id && t.category === "cis"
    );

    // ✅ Totals
    let cisDeducted = 0;
    let cisSuffered = 0;

    cisTx.forEach((t) => {
      const amt = Number(t.cis_amount || 0);
      if (amt > 0) cisDeducted += amt;
      else cisSuffered += Math.abs(amt);
    });

    const netCis = cisDeducted - cisSuffered;
    const locked = cisTx.some((t) => t.tax_locked);

    return res.status(200).json({
      cisDeducted,
      cisSuffered,
      netCis,
      transactions: cisTx,
      locked,
    });

  } catch (err) {
    console.error("CIS summary error:", err);
    return res.status(500).json({ error: err.message });
  }
}
