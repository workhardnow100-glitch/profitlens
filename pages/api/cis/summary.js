// pages/api/cis/summary.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { clientId, periodStart, periodEnd } = req.body;
  if (!clientId || !periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    // Fetch CIS transactions
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .eq("hmrc_category_id", "CIS"); // your CIS category

    if (error) throw new Error(error.message);

    // Calculate totals
    const totalGross = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalCIS = transactions.reduce((sum, t) => sum + (t.cis_amount || 0), 0);

    res.status(200).json({
      totalGross,
      totalCIS,
      transactions,
      locked: false, // default, frontend can override if needed
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
