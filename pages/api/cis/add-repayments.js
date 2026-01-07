// pages/api/cis/add-repayment.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // 🔐 Session required
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  const role = (session.user.role || "").toUpperCase();
  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );
  if (!(isFounder || isSubscribedOrTrial))
    return res.status(403).json({ error: "Upgrade required" });

  // 🔐 Accountant-aware clientId
  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }
  if (!clientId)
    return res.status(400).json({ error: "No client selected" });

  const {
    paymentDate,
    amount,
    direction = "refund",
    reference,
    clientId: bodyClientId,
  } = req.body;

  // 🔐 Prevent accountants from spoofing clientId
  if (role === "ACCOUNTANT" && bodyClientId && bodyClientId !== clientId) {
    return res.status(403).json({
      error: "Accountants cannot add CIS repayments for unauthorized clients",
    });
  }

  if (!paymentDate || !amount) {
    return res.status(400).json({
      error: "Missing required fields: paymentDate, amount",
    });
  }

  if (!["payment", "refund"].includes(direction)) {
    return res.status(400).json({
      error: "Invalid direction. Must be 'payment' or 'refund'.",
    });
  }

  try {
    // 📝 Audit log — Accountant adding CIS repayment/payment
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_ADD_CIS_PAYMENT",
          details: `Added CIS ${direction}: £${amount} on ${paymentDate}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // Insert CIS payment/repayment
    const { data: payment, error: insertError } = await supabaseAdmin
      .from("cis_payments")
      .insert([
        {
          client_id: clientId,
          payment_date: paymentDate,
          amount: Number(amount),
          direction,
          reference: reference || null,
        },
      ])
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    // Fetch updated payments
    const { data: payments, error: fetchError } = await supabaseAdmin
      .from("cis_payments")
      .select("*")
      .eq("client_id", clientId)
      .order("payment_date", { ascending: true });

    if (fetchError) throw new Error(fetchError.message);

    let totalPaid = 0;
    (payments || []).forEach((p) => {
      if (p.direction === "payment") totalPaid += Number(p.amount);
      if (p.direction === "refund") totalPaid -= Number(p.amount);
    });

    return res.status(200).json({
      success: true,
      payment,
      totals: {
        totalPaid,
      },
    });
  } catch (err) {
    console.error("CIS add repayment error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
