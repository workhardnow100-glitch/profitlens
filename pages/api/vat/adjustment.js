// pages/api/vat/adjustment.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]"; // adjust path if needed
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "../../../lib/supabase-admin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
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

  /* -------------------------------------------------------
     ✅ POST — Add VAT Adjustment
  ------------------------------------------------------- */
  if (req.method === "POST") {
    const { clientId, vatPeriodId, box, amount, reason } = req.body;

    if (!clientId || !box || amount === undefined) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ Prevent accountants from spoofing clientId
    if (session.user.role === "accountant" && clientId !== actingClientId) {
      return res.status(403).json({
        error: "Accountants cannot add VAT adjustments for unauthorized clients",
      });
    }

    try {
      // ✅ AUDIT LOG — Accountant adding VAT adjustment
      if (session.user.role === "accountant") {
        await supabaseAdmin.from("audit").insert([
          {
            client_id: clientId,
            actor_email: session.user.email,
            action: "ACCOUNTANT_ADD_VAT_ADJUSTMENT",
            details: `Added VAT adjustment: box ${box}, amount ${amount}, reason "${reason || "none"}"`,
          },
        ]);
      }

      const { data, error } = await supabase
        .from("vat_adjustments")
        .insert([
          {
            client_id: clientId,
            vat_period_id: vatPeriodId || null,
            box,
            amount,
            reason: reason || null,
            created_by: session.user.id,
          },
        ])
        .select("*")
        .single();

      if (error) throw error;

      return res.status(200).json({ success: true, adjustment: data });
    } catch (err) {
      console.error("VAT adjustment insert error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  /* -------------------------------------------------------
     ✅ DELETE — Remove VAT Adjustment
  ------------------------------------------------------- */
  if (req.method === "DELETE") {
    const { id, clientId } = req.body;

    if (!id || !clientId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // ✅ Prevent accountants from spoofing clientId
    if (session.user.role === "accountant" && clientId !== actingClientId) {
      return res.status(403).json({
        error: "Accountants cannot delete VAT adjustments for unauthorized clients",
      });
    }

    try {
      // ✅ AUDIT LOG — Accountant deleting VAT adjustment
      if (session.user.role === "accountant") {
        await supabaseAdmin.from("audit").insert([
          {
            client_id: clientId,
            actor_email: session.user.email,
            action: "ACCOUNTANT_DELETE_VAT_ADJUSTMENT",
            details: `Deleted VAT adjustment ID ${id}`,
          },
        ]);
      }

      const { error } = await supabase
        .from("vat_adjustments")
        .delete()
        .match({ id, client_id: clientId });

      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("VAT adjustment delete error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
