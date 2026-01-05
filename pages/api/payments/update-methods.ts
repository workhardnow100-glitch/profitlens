// pages/api/payments/update-methods.ts
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
    const { card, applePay, googlePay, bankTransfer, payByLink } = req.body;

    // Store settings in a table called "payment_settings"
    // If you don't have this table yet, we can create it next.
    const { error } = await supabaseAdmin
      .from("payment_settings")
      .upsert(
        {
          client_id: actingAsClientId,
          payment_methods: {
            card,
            applePay,
            googlePay,
            bankTransfer,
            payByLink,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" }
      );

    if (error) {
      console.error("update-methods error:", error);
      return res.status(500).json({ error: "Failed to save payment methods" });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("UPDATE METHODS ERROR:", err);
    return res.status(500).json({ error: "Failed to update payment methods" });
  }
}
