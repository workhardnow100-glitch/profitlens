// pages/api/sa/analytics.js
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { clientId, periodStart, periodEnd } = req.body;

  if (!clientId || !periodStart || !periodEnd)
    return res.status(400).json({ error: "Missing required fields" });

  try {
    const { data: tx, error } = await supabaseAdmin
      .from("transactions")
      .select("date, amount, category, hmrc_category_id")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (error) throw error;

    // ✅ Filter SA transactions
    const saTx = tx.filter(
      (t) => t.hmrc_category_id && t.category === "self_assessment"
    );

    // ✅ Build monthly buckets
    const buckets = {};

    saTx.forEach((t) => {
      const month = t.date.slice(0, 7); // YYYY-MM

      if (!buckets[month]) {
        buckets[month] = { income: 0, expenses: 0 };
      }

      const amt = Number(t.amount);

      if (amt > 0) buckets[month].income += amt;
      else buckets[month].expenses += Math.abs(amt);
    });

    // ✅ Convert to array
    const analytics = Object.keys(buckets).map((month) => ({
      month,
      income: buckets[month].income,
      expenses: buckets[month].expenses,
      profit: buckets[month].income - buckets[month].expenses,
    }));

    return res.status(200).json({ analytics });
  } catch (err) {
    console.error("SA analytics error:", err);
    return res.status(500).json({ error: err.message });
  }
}
