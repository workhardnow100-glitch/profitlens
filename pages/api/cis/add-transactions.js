// pages/api/cis/add-transaction.js
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
    date,
    amount,
    description,
    cisType,
    cisAmount,
    cisRate,
    clientId: bodyClientId,
  } = req.body;

  // 🔐 Prevent accountants from spoofing clientId
  if (role === "ACCOUNTANT" && bodyClientId && bodyClientId !== clientId) {
    return res.status(403).json({
      error: "Accountants cannot add CIS transactions for unauthorized clients",
    });
  }

  if (!date || amount == null || !cisType || cisAmount == null) {
    return res.status(400).json({
      error:
        "Missing required fields: date, amount, cisType, cisAmount",
    });
  }

  if (!["deducted", "suffered"].includes(cisType)) {
    return res.status(400).json({
      error: "Invalid cisType. Must be 'deducted' or 'suffered'.",
    });
  }

  try {
    // 📝 Audit log — Accountant adding CIS transaction
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_ADD_CIS_TRANSACTION",
          details: `Added CIS transaction: ${cisType} £${cisAmount} on ${date}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    const { data: tx, error: insertError } = await supabaseAdmin
      .from("transactions")
      .insert([
        {
          client_id: clientId,
          date,
          amount: Number(amount),
          description: description || null,
          cis_type: cisType,
          cis_amount: Number(cisAmount),
          cis_rate: cisRate != null ? Number(cisRate) : null,
        },
      ])
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    return res.status(200).json({
      success: true,
      transaction: tx,
    });
  } catch (err) {
    console.error("CIS add transaction error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
