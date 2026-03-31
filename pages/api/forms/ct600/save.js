// pages/api/forms/ct600/save.js

import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const {
      clientId,
      periodStart,
      periodEnd,
      lossCarryback,
      groupRelief,
      aiaClaimed,
      rAndDMultiplier,
      mainPoolBF,
      specialPoolBF,
      carsPoolBF,
    } = req.body;

    if (!clientId || !periodStart || !periodEnd) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (clientId, periodStart, periodEnd)",
      });
    }

    // Ensure a corp_submissions row exists
    const { data: existing } = await supabaseAdmin
      .from("corp_submissions")
      .select("*")
      .eq("client_id", clientId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    if (!existing) {
      // Create a new row if none exists
      await supabaseAdmin.from("corp_submissions").insert({
        client_id: clientId,
        period_start: periodStart,
        period_end: periodEnd,
      });
    }

    // Update adjustments
    const { error } = await supabaseAdmin
      .from("corp_submissions")
      .update({
        loss_carryback: Number(lossCarryback || 0),
        group_relief: Number(groupRelief || 0),
        ca_aia_claimed: Number(aiaClaimed || 0),
        r_and_d_multiplier: Number(rAndDMultiplier || 0),
        ca_main_pool_bf: Number(mainPoolBF || 0),
        ca_special_pool_bf: Number(specialPoolBF || 0),
        ca_cars_pool_bf: Number(carsPoolBF || 0),
      })
      .eq("client_id", clientId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd);

    if (error) {
      console.error("CT600 SAVE ERROR:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to save CT adjustments",
      });
    }

    return res.status(200).json({
      success: true,
      message: "CT adjustments saved successfully",
    });
  } catch (err) {
    console.error("CT600 SAVE API ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Unexpected server error",
    });
  }
}
