// pages/api/sa/summary.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]"; // adjust path if needed
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // ✅ Session validation
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

  if (!clientId || !periodStart || !periodEnd)
    return res.status(400).json({ error: "Missing required fields" });

  // ✅ Prevent accountants from spoofing clientId
  if (session.user.role === "accountant" && clientId !== actingClientId) {
    return res.status(403).json({
      error: "Accountants cannot request SA summaries for unauthorized clients",
    });
  }

  try {
    // ✅ AUDIT LOG — Accountant viewing SA summary
    if (session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_SA_SUMMARY",
          details: `Viewed SA summary for ${periodStart} → ${periodEnd}`,
        },
      ]);
    }

    // ✅ Load SA transactions
    const { data: transactions, error: txError } = await supabaseAdmin
      .from("transactions")
      .select(
        "id, date, description, amount, category, tax_locked, hmrc_category_id"
      )
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (txError) throw txError;

    // ✅ Filter SA‑mapped transactions
    const saTx = transactions.filter(
      (t) => t.hmrc_category_id && t.category === "self_assessment"
    );

    // ✅ Compute totals
    let totalIncome = 0;
    let totalExpenses = 0;

    saTx.forEach((tx) => {
      const amt = Number(tx.amount || 0);
      if (amt > 0) totalIncome += amt;
      else totalExpenses += Math.abs(amt);
    });

    const profit = totalIncome - totalExpenses;

    // ✅ ✅ ✅ FULL UK TAX BAND CALCULATION
    let personalAllowance = 12570;

    // ✅ Personal allowance tapering above £100k
    if (profit > 100000) {
      const reduction = Math.floor((profit - 100000) / 2);
      personalAllowance = Math.max(0, personalAllowance - reduction);
    }

    const taxableIncome = Math.max(0, profit - personalAllowance);

    let taxLiability = 0;
    let remaining = taxableIncome;

    // ✅ 20% basic rate (up to £50,270)
    const basicLimit = 50270 - personalAllowance;
    if (remaining > 0) {
      const basicTaxable = Math.min(remaining, basicLimit);
      taxLiability += basicTaxable * 0.20;
      remaining -= basicTaxable;
    }

    // ✅ 40% higher rate (up to £125,140)
    const higherLimit = 125140 - 50270;
    if (remaining > 0) {
      const higherTaxable = Math.min(remaining, higherLimit);
      taxLiability += higherTaxable * 0.40;
      remaining -= higherTaxable;
    }

    // ✅ 45% additional rate (above £125,140)
    if (remaining > 0) {
      taxLiability += remaining * 0.45;
    }

    // ✅ Determine lock status
    const locked = saTx.some((tx) => tx.tax_locked);

    return res.status(200).json({
      totalIncome,
      totalExpenses,
      profit,
      taxableIncome,
      personalAllowance,
      taxLiability,
      transactions: saTx,
      locked,
    });

  } catch (err) {
    console.error("SA summary error:", err);
    return res.status(500).json({ error: err.message });
  }
}
