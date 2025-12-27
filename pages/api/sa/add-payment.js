// pages/api/sa/add-payment.js
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

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

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

  if (!paymentDate || !amount) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // ⭐ AUDIT LOG — Accountant adding SA payment
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_ADD_SA_PAYMENT",
          details: `Added SA payment: ${direction || "payment"} £${amount} on ${paymentDate}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // ⭐ Insert SA payment
    const { error } = await supabaseAdmin
      .from("sa_payments")
      .insert([
        {
          client_id: clientId,
          payment_date: paymentDate,
          amount: Number(amount),
          direction: direction || "payment",
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
