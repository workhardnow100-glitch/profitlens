import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { clientId, category, payload, period, idempotencyKey } = req.body;

  try {
    // Check for duplicate submission
    const { data: existing, error: selectError } = await supabase
      .from("mtd_submissions")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (selectError) {
      return res.status(500).json({ success: false, error: selectError.message });
    }

    if (existing) {
      return res.json({ success: true, duplicate: true });
    }

    // Insert new submission
    const { error: insertError } = await supabase.from("mtd_submissions").insert({
      client_id: clientId,
      category,
      payload,
      period,
      idempotency_key: idempotencyKey,
      status: "success", // ✅ mark as success if insert worked
    });

    if (insertError) {
      return res.status(500).json({ success: false, error: insertError.message });
    }

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
