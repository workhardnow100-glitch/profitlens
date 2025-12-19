// pages/api/cis/summary.js
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

  if (!clientId || !periodStart || !periodEnd)
    return res.status(400).json({ error: "Missing required fields" });

  // ✅ Prevent accountants from spoofing clientId
  if (session.user.role === "accountant" && clientId !== actingClientId) {
    return res.status(403).json({
      error: "Accountants cannot request CIS summaries for unauthorized clients",
    });
  }

  try {
    // ✅ AUDIT LOG — Accountant viewing CIS summary
    if (session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_VIEW_CIS_SUMMARY",
          details: `Viewed CIS summary for ${periodStart} → ${periodEnd}`,
        },
      ]);
    }

    // ✅ Load transactions
    const { data: tx, error } = await supabaseAdmin
      .from("transactions")
      .select("id, date, category, cis_amount, tax_locked, hmrc_category_id")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (error) throw error;

    // ✅ Filter CIS‑mapped transactions
    const cisTx = tx.filter(
      (t) => t.hmrc_category_id && t.category === "cis"
    );

    // ✅ Totals
    let cisDeducted = 0;
    let cisSuffered = 0;

    cisTx.forEach((t) => {
      const amt = Number(t.cis_amount || 0);
      if (amt > 0) cisDeducted += amt;
      else cisSuffered += Math.abs(amt);
    });

    const netCis = cisDeducted - cisSuffered;
    const locked = cisTx.some((t) => t.tax_locked);

    return res.status(200).json({
      cisDeducted,
      cisSuffered,
      netCis,
      transactions: cisTx,
      locked,
    });

  } catch (err) {
    console.error("CIS summary error:", err);
    return res.status(500).json({ error: err.message });
  }
}
