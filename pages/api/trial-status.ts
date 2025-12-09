import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]"; // ✅ adjust if your NextAuth config is elsewhere
import { supabaseAdmin } from "../../lib/supabase-admin";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Get the current session
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return res.status(401).json({ trialActive: false });
    }

    // Query subscriptions table for this user
    const { data: sub, error } = await supabaseAdmin
      .from("subscriptions")
      .select("status, trial_end")
      .eq("user_id", session.user.id)
      .single();

    if (error) {
      console.error("Supabase error:", error.message);
      return res.status(500).json({
        trialActive: false,
        error: error.message,
      });
    }

    if (!sub) {
      return res.status(200).json({ trialActive: false });
    }

    const now = new Date();
    const trialActive =
      sub.status === "active" || (sub.trial_end && new Date(sub.trial_end) > now);

    return res.status(200).json({
      trialActive,
      trialEndsAt: sub.trial_end,
      status: sub.status,
    });
  } catch (err: any) {
    console.error("Handler error:", err);
    return res.status(500).json({
      trialActive: false,
      error: "Internal server error",
    });
  }
}
