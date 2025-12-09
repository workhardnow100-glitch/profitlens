import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]"; // adjust path if your NextAuth file is elsewhere
import { supabaseAdmin } from "../../lib/supabase-admin";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // getServerSession now requires (req, res, authOptions)
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user?.id) {
    return res.status(401).json({ trialActive: false });
  }

  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("status, trial_end")
    .eq("user_id", session.user.id)
    .single();

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
}
