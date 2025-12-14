// pages/api/sa/payments.js
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { clientId } = req.body;

  if (!clientId)
    return res.status(400).json({ error: "Missing clientId" });

  try {
    const { data: payments, error } = await supabaseAdmin
      .from("sa_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("payment_date", { ascending: false });

    if (error) throw error;

    return res.status(200).json({ payments });
  } catch (err) {
    console.error("SA payments error:", err);
    return res.status(500).json({ error: err.message });
  }
}
