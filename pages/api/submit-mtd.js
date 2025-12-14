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
      // Audit duplicate attempt
      await supabase.from("audit").insert({
        client_id: clientId,
        actor_email: req.headers["x-user-email"] || "unknown",
        action: "mtd_duplicate_submission",
        details: `Duplicate submission for ${category} period ${period}`,
      });

      return res.json({ success: true, duplicate: true });
    }

    // Insert new submission
    const { error: insertError } = await supabase.from("mtd_submissions").insert({
      client_id: clientId,
      category,
      payload,
      period,
      idempotency_key: idempotencyKey,
      status: "success",
    });

    if (insertError) {
      // Audit failure
      await supabase.from("audit").insert({
        client_id: clientId,
        actor_email: req.headers["x-user-email"] || "unknown",
        action: "mtd_submission_failed",
        details: `Insert failed: ${insertError.message}`,
      });

      return res.status(500).json({ success: false, error: insertError.message });
    }

    // Audit success
    await supabase.from("audit").insert({
      client_id: clientId,
      actor_email: req.headers["x-user-email"] || "unknown",
      action: "mtd_submission_success",
      details: `Submitted ${category} for period ${period}`,
    });

    return res.json({ success: true });
  } catch (err) {
    // Audit unexpected error
    await supabase.from("audit").insert({
      client_id: clientId,
      actor_email: req.headers["x-user-email"] || "unknown",
      action: "mtd_submission_error",
      details: `Unexpected error: ${err.message}`,
    });

    return res.status(500).json({ success: false, error: err.message });
  }
}
