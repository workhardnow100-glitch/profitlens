// pages/api/corp/history.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { clientId } = req.body;
  if (!clientId)
    return res.status(400).json({ error: "Missing clientId" });

  try {
    // ✅ Load submissions
    const { data: submissions, error: subError } = await supabase
      .from("corp_submissions")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (subError) throw subError;

    // ✅ Load payments
    const { data: payments, error: payError } = await supabase
      .from("ct_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("payment_date", { ascending: false });

    if (payError) throw payError;

    return res.status(200).json({
      submissions,
      payments,
    });
  } catch (err) {
    console.error("CT history error:", err);
    return res.status(500).json({ error: err.message });
  }
}
