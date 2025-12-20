// pages/api/sa/analytics.js
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { CT_MAP } from "../../../lib/constants/ctMap";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { clientId, periodStart, periodEnd } = req.body;

  if (!clientId || !periodStart || !periodEnd)
    return res.status(400).json({ error: "Missing required fields" });

  try {
    // ✅ Load transactions using the REAL schema
    const { data: tx, error } = await supabaseAdmin
      .from("transactions")
      .select("date, amount, business_category")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (error) throw error;

    // ✅ Build lowercase CT_MAP sets
    const MAP = {
      income: new Set(CT_MAP.income.map((c) => c.toLowerCase())),
      allowable: new Set(CT_MAP.allowable.map((c) => c.toLowerCase())),
      disallowable: new Set(CT_MAP.disallowable.map((c) => c.toLowerCase())),
    };

    // ✅ Filter SA‑relevant transactions using CT_MAP
    const saTx = tx.filter((t) => {
      const cat = (t.business_category || "").toLowerCase();
      return (
        MAP.income.has(cat) ||
        MAP.allowable.has(cat) ||
        MAP.disallowable.has(cat)
      );
    });

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
