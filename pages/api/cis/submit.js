// pages/api/cis/submit.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]"; // adjust path if needed
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../lib/supabase-admin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
    return res.status(400).json({ error: "Missing required parameters" });
  }

  // ✅ Prevent accountants from spoofing clientId
  if (session.user.role === "accountant" && clientId !== actingClientId) {
    return res.status(403).json({
      error: "Accountants cannot submit CIS for unauthorized clients",
    });
  }

  try {
    // ✅ AUDIT LOG — Accountant submitting CIS
    if (session.user.role === "accountant") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_SUBMIT_CIS",
          details: `Submitted CIS for ${periodStart} → ${periodEnd}`,
        },
      ]);
    }

    // ✅ 1. Fetch CIS transactions for this period
    const { data: cisTxs, error: fetchError } = await supabase
      .from("transactions")
      .select("id, date, category, vat_amount, cis_amount, tax_locked")
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .order("date", { ascending: true });

    if (fetchError) throw new Error(fetchError.message);

    if (!cisTxs || cisTxs.length === 0) {
      return res.status(400).json({
        error: "No CIS transactions found for this period."
      });
    }

    // ✅ 2. Check for missing CIS amounts
    const missing = cisTxs.filter((tx) => tx.cis_amount == null);
    if (missing.length > 0) {
      return res.status(400).json({
        error: "Cannot submit. Some CIS transactions have missing CIS amounts."
      });
    }

    // ✅ 3. Compute CIS totals
    let cisDeducted = 0; // you withheld from subcontractors
    let cisSuffered = 0; // contractors withheld from you

    cisTxs.forEach((tx) => {
      if (tx.category === "cis_deducted") {
        cisDeducted += Number(tx.cis_amount || 0);
      }
      if (tx.category === "cis_suffered") {
        cisSuffered += Number(tx.cis_amount || 0);
      }
    });

    const netCis = cisDeducted - cisSuffered;

    // ✅ 4. Lock CIS transactions for the period
    const { error: lockError } = await supabase
      .from("transactions")
      .update({ tax_locked: true })
      .eq("client_id", clientId)
      .gte("date", periodStart)
      .lte("date", periodEnd);

    if (lockError) throw new Error(lockError.message);

    // ✅ 5. Insert CIS submission record
    const { data: submission, error: insertError } = await supabase
      .from("cis_submissions")
      .insert([
        {
          client_id: clientId,
          period_start: periodStart,
          period_end: periodEnd,
          cis_deducted: cisDeducted,
          cis_suffered: cisSuffered,
          net_cis: netCis,
          hmrc_response: {
            status: "SUCCESS",
            processingDate: new Date().toISOString(),
            message: "CIS return accepted (simulated HMRC response)"
          }
        }
      ])
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    // ✅ 6. Return HMRC-style response
    return res.status(200).json({
      success: true,
      hmrcResponse: submission.hmrc_response,
      cisDeducted,
      cisSuffered,
      netCis
    });

  } catch (err) {
    console.error("CIS submission error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
