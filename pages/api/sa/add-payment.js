// pages/api/sa/add-payment.js
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { clientId, paymentDate, amount, direction, reference } = req.body;

  if (!clientId || !paymentDate || !amount)
    return res.status(400).json({ error: "Missing required fields" });

  try {
    const { error } = await supabaseAdmin
      .from("sa_payments")
      .insert([
        {
          client_id: clientId,
          payment_date: paymentDate,
          amount: Number(amount),
          direction,
          reference: reference || null,
        },
      ]);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("SA add payment error:", err);
    return res.status(500).json({ error: err.message });
  }
}
