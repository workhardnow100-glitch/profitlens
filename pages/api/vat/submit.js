// pages/api/vat/submit.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]"; // adjust path if needed
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // ✅ Validate session
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ✅ Accountant-aware client ID
  const actingClientId =
    session.user.actingAsClientId || session.user.clientId;

  const { clientId, periodStart, periodEnd } = req.body;

  if (!clientId || !periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // ✅ Prevent accountants from spoofing clientId
  if (session.user.role === "accountant" && clientId !== actingClientId) {
    return res.status(403).json({
      error: "Accountants cannot submit VAT for unauthorized clients",
    });
  }

  try {
    // ✅ AUDIT LOG — Accountant submitting VAT
    if (session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_SUBMIT_VAT",
          details: `Submitted VAT return for ${periodStart} → ${periodEnd}`,
        },
      ]);
    }

    // ✅ 1. Fetch all VAT transactions for this period
    const { data: vatTxs, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("id, category, vat_amount, tax_locked, date")
      .eq("client_id", clientId)
      .eq("hmrc_category_id", "vat") // canonical VAT category
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (txError) throw txError;

    if (!vatTxs || vatTxs.length === 0) {
      return res.status(400).json({ error: "No VAT transactions in this period" });
    }

    // ✅ 2. Recalculate totals server-side
    let outputVat = 0;
    let inputVat = 0;

    vatTxs.forEach((tx) => {
      const vat = Number(tx.vat_amount || 0);

      if (tx.category === "sales") {
        outputVat += vat;
      } else {
        inputVat += vat;
      }
    });

    const netVat = outputVat - inputVat;

    // ✅ 3. Insert submission record
    const { error: insertError } = await supabaseAdmin
      .from("vat_submissions")
      .insert({
        client_id: clientId,
        period_start: periodStart,
        period_end: periodEnd,
        output_vat: outputVat,
        input_vat: inputVat,
        net_vat: netVat,
      });

    if (insertError) throw insertError;

    // ✅ 4. Lock all VAT transactions in this period
    const { error: lockError } = await supabaseAdmin
      .from("transactions")
      .update({ tax_locked: true })
      .eq("client_id", clientId)
      .eq("hmrc_category_id", "vat")
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (lockError) throw lockError;

    // ✅ 5. Return success + totals
    return res.status(200).json({
      success: true,
      message: "VAT return submitted successfully",
      totals: {
        outputVat,
        inputVat,
        netVat,
      },
    });

  } catch (err) {
    console.error("VAT submission error:", err);
    return res.status(500).json({ error: err.message });
  }
}
