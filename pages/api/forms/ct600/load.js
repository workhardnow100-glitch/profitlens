// pages/api/forms/ct600/load.js

import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const { clientId, periodStart, periodEnd } = req.query;

    const { data, error } = await supabaseAdmin
      .from("corp_submissions")
      .select("*")
      .eq("client_id", clientId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    if (error) {
      return res.status(500).json({ success: false, message: "Failed to load adjustments" });
    }

    return res.status(200).json({
      success: true,
      adjustments: data || {},
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Unexpected server error" });
  }
}
