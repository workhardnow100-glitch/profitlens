// pages/api/ct/add-payment.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ⭐ SESSION REQUIRED
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const role = (session.user.role || "").toUpperCase();

  // ⭐ Resolve clientId safely
  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId) {
    return res.status(400).json({ error: "No client selected" });
  }

  const { paymentDate, amount, direction, reference } = req.body;

  // ⭐ Basic validation
  if (!paymentDate || !amount) {
    return res.status(400).json({
      error: "Missing required fields: paymentDate, amount"
    });
  }

  try {
    // ⭐ AUDIT LOG — Accountant adding CT payment
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_ADD_CT_PAYMENT",
          details: `Added CT payment: ${direction || "payment"} £${amount} on ${paymentDate}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // ⭐ Insert CT payment
    const { data: payment, error: insertError } = await supabaseAdmin
      .from("ct_payments")
      .insert([
        {
          client_id: clientId,
          payment_date: paymentDate,
          amount: Number(amount),
          direction: direction || "payment",
          reference: reference || null,
        },
      ])
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    // ⭐ Fetch updated totals
    const { data: payments, error: fetchError } = await supabaseAdmin
      .from("ct_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("payment_date", { ascending: true });

    if (fetchError) throw new Error(fetchError.message);

    // ⭐ Compute totals
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
        netPaid: totalPaid - totalRefunded,
      },
    });
  } catch (err) {
    console.error("CT payment error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
