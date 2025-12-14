import { supabaseAdmin } from "../../lib/supabase-admin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ success: false });

  const { clientId, category, payload, period, idempotencyKey } = req.body;

  const { data: existing } = await supabaseAdmin
    .from("mtd_submissions")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing) {
    return res.json({ success: true, duplicate: true });
  }

  await supabaseAdmin.from("mtd_submissions").insert({
    client_id: clientId,
    category,
    payload,
    period,
    idempotency_key: idempotencyKey,
    status: "success",
  });

  if (category === "vat") {
    await supabaseAdmin.from("vat_periods").upsert({
      client_id: clientId,
      period_start: `${period}-01`,
      locked: true,
      submitted: true,
    });
  }

  res.json({ success: true });
}
