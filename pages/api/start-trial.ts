import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("status, trial_end")
      .eq("user_id", session.user.id)
      .single();

    if (
      existing &&
      (existing.status === "active" ||
        (existing.trial_end && new Date(existing.trial_end) > new Date()))
    ) {
      return res.status(200).json({
        success: true,
        trialActive: true,
        trialEndsAt: existing.trial_end,
        status: existing.status,
      });
    }

    // Create new 24h trial
    const trialEnd = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { error: upsertError } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: session.user.id,
          email: session.user.email,
          status: "trialing",
          trial_end: trialEnd.toISOString(),
          stripe_customer_id: `trial-${session.user.id}`,
          stripe_subscription_id: `trial-sub-${session.user.id}`,
          plan: "trial",
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("Supabase upsert error:", upsertError.message);
      return res.status(500).json({ error: upsertError.message });
    }

    // Audit log
    await supabaseAdmin.from("audit").insert([
      {
        client_id: session.user.clientId ?? "unknown-client",
        actor_email: session.user.email,
        action: "TRIAL_STARTED",
        details: `Trial started until ${trialEnd.toISOString()}`,
      },
    ]);

    return res.status(200).json({
      success: true,
      trialActive: true,
      trialEndsAt: trialEnd.toISOString(),
      status: "trialing",
    });
  } catch (err: any) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
