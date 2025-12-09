// pages/api/start-trial.ts
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]"; // adjust path if needed
import { supabaseAdmin } from "../../lib/supabase-admin";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Only allow POST
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Get current session
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Check if user already has a subscription row
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("subscriptions")
      .select("status, trial_end")
      .eq("user_id", session.user.id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = no rows found
      console.error("Supabase fetch error:", fetchError.message);
      return res.status(500).json({ error: fetchError.message });
    }

    // If subscription already exists and is still active/trialing, just return it
    if (existing && (existing.status === "active" || (existing.trial_end && new Date(existing.trial_end) > new Date()))) {
      return res.status(200).json({
        success: true,
        trialActive: true,
        trialEndsAt: existing.trial_end,
        status: existing.status,
      });
    }

    // Otherwise, create or overwrite with a new trial
    const trialEnd = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h from now

    const { error: upsertError } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: session.user.id,
          status: "trialing",
          trial_end: trialEnd.toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("Supabase upsert error:", upsertError.message);
      return res.status(500).json({ error: upsertError.message });
    }

    // Audit log entry
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
