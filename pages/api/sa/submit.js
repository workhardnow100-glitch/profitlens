// pages/api/sa/submit.js
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { clientId, periodStart, periodEnd } = req.body;

  if (!clientId || !periodStart || !periodEnd)
    return res.status(400).json({ error: "Missing required fields" });

  try {
    // ✅ Lock SA transactions
    const { error: lockError } = await supabaseAdmin
      .from("transactions")
      .update({ tax_locked: true })
      .eq("client_id", clientId)
      .eq("category", "self_assessment")
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (lockError) throw lockError;

    // ✅ Create submission record
    const { error: subError } = await supabaseAdmin
      .from("sa_submissions")
      .insert([
        {
          client_id: clientId,
          period_start: periodStart,
          period_end: periodEnd,
          created_at: new Date().toISOString(),
        },
      ]);

    if (subError) throw subError;

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("SA submit error:", err);
    return res.status(500).json({ error: err.message });
  }
}
