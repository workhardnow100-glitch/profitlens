import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";
import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto"; // ✅ import randomUUID directly

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    let userId = session?.user?.id;
    let email = session?.user?.email;

    // If no session, allow guest trial creation by email
    if (!userId) {
      const { guestEmail } = req.body;
      if (!guestEmail) {
        return res.status(400).json({ error: "Email required to start trial" });
      }
      email = guestEmail.trim().toLowerCase();
      userId = randomUUID(); // ✅ pure UUID

      // Insert stub user to satisfy FK constraint
      const { error: userInsertError } = await supabaseAdmin.from("users").insert({
        id: userId,
        email,
        created_at: new Date().toISOString(),
      });
      if (userInsertError) {
        console.error("Supabase user insert error:", userInsertError.message);
        return res.status(500).json({ error: userInsertError.message });
      }
    }

    // Check existing subscription
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("status, trial_end")
      .eq("user_id", userId)
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
          user_id: userId,
          email,
          status: "trialing",
          trial_end: trialEnd.toISOString(),
          stripe_customer_id: `trial-${userId}`,
          stripe_subscription_id: `trial-sub-${userId}`,
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
        client_id: session?.user?.clientId ?? "guest-client",
        actor_email: email,
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
