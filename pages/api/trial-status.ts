import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ trialActive: false });
    }

    const { data: sub, error } = await supabaseAdmin
      .from("subscriptions")
      .select("status, trial_end")
      .eq("user_id", session.user.id)
      .single();

    if (error) {
      console.error("Supabase error:", error.message);
      return res.status(500).json({ trialActive: false, error: error.message });
    }

    if (!sub) {
      return res.status(200).json({ trialActive: false, status: "none" });
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
    return res.status(500).json({ trialActive: false, error: "Internal server error" });
  }
}
