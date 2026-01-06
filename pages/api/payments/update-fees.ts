// pages/api/payments/update-fees.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  // Founder/Admin only
if (session.user.role !== "FOUNDER" && session.user.role !== "ADMIN") {
  return res.status(403).json({ error: "Forbidden" });
}


  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      platformFeePercent,
      platformFeeMin,
      platformFeeMax
    } = req.body;

    const { error } = await supabaseAdmin
      .from("payment_settings")
      .update({
        platform_fee_percent: platformFeePercent,
        platform_fee_min: platformFeeMin,
        platform_fee_max: platformFeeMax,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", session.user.id);

    if (error) {
      console.error("update-fees error:", error);
      return res.status(500).json({ error: "Failed to save platform fees" });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("UPDATE FEES ERROR:", err);
    return res.status(500).json({ error: "Failed to update platform fees" });
  }
}
