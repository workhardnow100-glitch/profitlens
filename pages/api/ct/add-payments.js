// pages/api/ct/add-payment.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { clientId, paymentDate, amount, direction, reference } = req.body;

  if (!clientId || !paymentDate || !amount) {
    return res.status(400).json({
      error: "Missing required fields: clientId, paymentDate, amount"
    });
  }

  try {
    // ✅ 1. Insert CT payment record
    const { data: payment, error: insertError } = await supabase
      .from("ct_payments")
      .insert([
        {
          client_id: clientId,
          payment_date: paymentDate,
          amount: Number(amount),
          direction: direction || "payment",
          reference: reference || null
        }
      ])
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    // ✅ 2. Fetch updated totals
    const { data: payments, error: fetchError } = await supabase
      .from("ct_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("payment_date", { ascending: true });

    if (fetchError) throw new Error(fetchError.message);

    // ✅ 3. Compute totals
    let totalPaid = 0;
    let totalRefunded = 0;

    payments.forEach((p) => {
      if (p.direction === "payment") totalPaid += Number(p.amount);
      if (p.direction === "refund") totalRefunded += Number(p.amount);
    });

    return res.status(200).json({
      success: true,
      payment,
      totals: {
        totalPaid,
        totalRefunded,
        netPaid: totalPaid - totalRefunded
      }
    });

  } catch (err) {
    console.error("CT payment error:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
