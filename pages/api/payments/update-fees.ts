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

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const actingAsClientId =
    (session.user as any).actingAsClientId ||
    (session.user as any).clientId ||
    null;

  if (!actingAsClientId) {
    return res.status(400).json({ error: "No active client selected" });
  }

  try {
    const {
      platformFeePercent,
      platformFeeMin,
      platformFeeMax
    } = req.body;

    // Store settings in the same "payment_settings" table
    const { error } = await supabaseAdmin
      .from("payment_settings")
      .upsert(
        {
          client_id: actingAsClientId,
          platform_fee_percent: platformFeePercent,
          platform_fee_min: platformFeeMin,
          platform_fee_max: platformFeeMax,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" }
      );

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
