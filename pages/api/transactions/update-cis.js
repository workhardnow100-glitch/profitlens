// pages/api/transactions/update-cis.js
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id, cisType, amount } = req.body;

  if (!id || !cisType || amount === undefined) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    // ✅ CIS rate is always 20%
    const cis_rate = 20;

    // ✅ CIS amount = 20% of absolute amount
    const cis_amount = Math.abs(Number(amount)) * (cis_rate / 100);

    // ✅ Always use category = "cis"
    const category = "cis";

    // ✅ Fetch CIS HMRC category UUID
    const { data: cisCat, error: catErr } = await supabaseAdmin
      .from("hmrc_categories")
      .select("id")
      .eq("canonical_name", "cis")
      .maybeSingle();

    if (catErr) throw catErr;

    const hmrc_category_id = cisCat?.id || null;

    // ✅ Build update payload
    const updatePayload = {
      category,
      cis_type: cisType,     // "suffered" or "deducted"
      cis_rate,
      cis_amount,
      hmrc_category_id,
    };

    // ✅ Update transaction
    const { error: updateErr } = await supabaseAdmin
      .from("transactions")
      .update(updatePayload)
      .eq("id", id);

    if (updateErr) throw updateErr;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("CIS update error:", err);
    return res.status(500).json({ error: err.message });
  }
}
