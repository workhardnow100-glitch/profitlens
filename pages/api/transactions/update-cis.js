// pages/api/transactions/update-cis.js
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id, cisType } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Missing transaction ID" });
  }

  try {
    // ✅ Determine category + CIS mapping
    let category = null;
    if (cisType === "deducted") category = "cis_deducted";
    if (cisType === "suffered") category = "cis_suffered";

    // ✅ Fetch CIS HMRC category UUID
    let cisCategoryId = null;

    if (category) {
      const { data: cisCat, error: catErr } = await supabaseAdmin
        .from("hmrc_categories")
        .select("id")
        .eq("canonical_name", "cis")
        .maybeSingle();

      if (catErr) throw catErr;
      cisCategoryId = cisCat?.id || null;
    }

    // ✅ Build update payload
    const updatePayload = {
      category: category, // null if "none"
      hmrc_category_id: cisCategoryId, // null if "none"
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
