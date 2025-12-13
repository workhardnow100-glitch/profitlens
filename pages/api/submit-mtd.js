import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { clientId, category, payload, period, idempotencyKey } = req.body;

  const { data: existing } = await supabase
    .from("mtd_submissions")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing) {
    return res.json({ success: true, duplicate: true });
  }

  await supabase.from("mtd_submissions").insert({
    client_id: clientId,
    category,
    payload,
    period,
    idempotency_key: idempotencyKey,
    status: "submitted",
  });

  res.json({ success: true });
}
