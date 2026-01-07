// pages/api/vat/submit.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

// Reuse the same classification logic as vat/summary.js
const EXPENSE_TYPE_HINTS = ["DEB","DR","DB","D","PAY","POS","CARD","CPT","DD","SO","ATM","CHG","FEE","PUR","WITHDRAWAL"];
const INCOME_TYPE_HINTS = ["CR","CRD","C","BGC","FPI","FPS","DEP","REV","REFUND","SAL","INT"];
const TRANSFER_TYPE_HINTS = ["TFR","TRANSFER","TFR IN","TFR OUT"];

function classifyTransactionType(rawType, amount) {
  const type = (rawType || "").toUpperCase().trim();
  const gross = Number(amount || 0);

  if (TRANSFER_TYPE_HINTS.includes(type)) return "transfer";
  if (INCOME_TYPE_HINTS.includes(type)) return "income";
  if (EXPENSE_TYPE_HINTS.includes(type)) return "expense";

  if (gross > 0) return "income";
  if (gross < 0) return "expense";

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // 🔐 Validate session
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  const role = (session.user.role || "").toUpperCase();
  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // 🔐 Accountant-aware client ID
  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId) {
    return res.status(400).json({ error: "No client selected" });
  }

  const { periodStart, periodEnd, clientId: bodyClientId } = req.body;

  if (!periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // 🔐 Prevent accountants from spoofing clientId
  if (role === "ACCOUNTANT" && bodyClientId && bodyClientId !== clientId) {
    return res.status(403).json({
      error: "Accountants cannot submit VAT for unauthorized clients",
    });
  }

  try {
    // 📝 AUDIT LOG — Accountant submitting VAT
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_SUBMIT_VAT",
          details: `Submitted VAT return for ${periodStart} → ${periodEnd}`,
        },
      ]);
    }

    // ---------------------------------------------------------
    // 1. Fetch VAT-relevant transactions (same filter as VAT summary)
    // ---------------------------------------------------------
    const { data: vatTxs, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("id, amount, vat_amount, vat_rate, type, business_category, tax_locked, date")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .or("vat_rate.not.is.null,vat_amount.not.eq.0");

    if (txError) throw txError;

    if (!vatTxs || vatTxs.length === 0) {
      return res.status(400).json({ error: "No VAT transactions in this period" });
    }

    // ---------------------------------------------------------
    // 2. Recalculate totals using the SAME logic as vat/summary.js
    // ---------------------------------------------------------
    let outputVat = 0;
    let inputVat = 0;

    for (const tx of vatTxs) {
      const gross = Number(tx.amount || 0);
      const vat = Number(tx.vat_amount || 0);
      const classification = classifyTransactionType(tx.type, gross);

      if (!classification || classification === "transfer") continue;

      if (classification === "income") {
        outputVat += Math.abs(vat);
      } else if (classification === "expense") {
        inputVat += Math.abs(vat);
      }
    }

    const netVat = outputVat - inputVat;

    // ---------------------------------------------------------
    // 3. Insert submission record
    // ---------------------------------------------------------
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

    // ---------------------------------------------------------
    // 4. Lock ALL VAT-relevant transactions (same filter as VAT summary)
    // ---------------------------------------------------------
    const { error: lockError } = await supabaseAdmin
      .from("transactions")
      .update({ tax_locked: true })
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .or("vat_rate.not.is.null,vat_amount.not.eq.0");

    if (lockError) throw lockError;

    // ---------------------------------------------------------
    // 5. Return success + totals
    // ---------------------------------------------------------
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
