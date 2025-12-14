import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { clientId, paymentDate, amount, direction, reference } = req.body;

  // ✅ Basic validation
  if (!clientId || !paymentDate || !amount || !direction) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!["payment", "refund"].includes(direction)) {
    return res.status(400).json({ error: "Invalid direction" });
  }

  try {
    const { error } = await supabaseAdmin
      .from("vat_payments")
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
    console.error("VAT payment insert error:", err);
    return res.status(500).json({ error: err.message });
  }
}
