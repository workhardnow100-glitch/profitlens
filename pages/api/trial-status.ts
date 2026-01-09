import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    // ⭐ Guest mode — no session means no trial
    if (!session?.user?.id) {
      return res.status(200).json({
        trialActive: false,
        trialEndsAt: null,
        status: "guest",
      });
    }

    const userId = session.user.id;

    // ⭐ Fetch subscription
    const { data: sub, error } = await supabaseAdmin
      .from("subscriptions")
      .select("status, trial_end")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Supabase error:", error.message);
      return res.status(500).json({
        trialActive: false,
        status: "error",
        error: error.message,
      });
    }

    // ⭐ No subscription row yet
    if (!sub) {
      return res.status(200).json({
        trialActive: false,
        trialEndsAt: null,
        status: "none",
      });
    }

    const now = new Date();
    const trialActive =
      sub.status === "active" ||
      (sub.trial_end && new Date(sub.trial_end) > now);

    return res.status(200).json({
      trialActive,
      trialEndsAt: sub.trial_end,
      status: sub.status,
    });
  } catch (err: any) {
    console.error("Handler error:", err);
    return res.status(500).json({
      trialActive: false,
      status: "error",
      error: "Internal server error",
    });
  }
}
