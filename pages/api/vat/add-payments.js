// pages/api/vat/payments.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

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
  if (!paymentDate || !amount || !direction) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!["payment", "refund"].includes(direction)) {
    return res.status(400).json({ error: "Invalid direction" });
  }

  try {
    // ⭐ AUDIT LOG — Accountant adding VAT payment
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_ADD_VAT_PAYMENT",
          details: `Added VAT payment: ${direction} £${amount} on ${paymentDate}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // ⭐ Insert VAT payment
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
