import { getServerSession } from "next-auth";
import { supabaseAdmin } from "../../lib/supabase-admin";

export default async function handler(req, res) {
  const session = await getServerSession(req, res);
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

  res.status(200).json({
    trialActive,
    trialEndsAt: sub.trial_end,
    status: sub.status,
  });
}