import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";
import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";

// ⭐ NEW: Import the onboarding helper
import { ensureClientCoa } from "../../lib/onboarding";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    let userId = session?.user?.id ?? null;
    let email = session?.user?.email ?? null;
    let clientId = session?.user?.clientId ?? null;

    const isAuthenticated = Boolean(session?.user);

    // ============================================================
    // 1. Guest trial creation (no session)
    // ============================================================
    if (!isAuthenticated) {
      const { guestEmail } = req.body || {};
      if (!guestEmail) {
        return res.status(400).json({ error: "Email required to start trial" });
      }

      email = guestEmail.trim().toLowerCase();
      userId = randomUUID();
      clientId = randomUUID();

      // Create stub client
      const { error: clientError } = await supabaseAdmin.from("clients").insert({
        id: clientId,
        name: `Trial Client for ${email}`,
        owner_id: userId,
        email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (clientError) {
        console.error("Supabase client insert error:", clientError.message);
        return res.status(500).json({ error: clientError.message });
      }

      // ⭐ NEW: Clone default COA for this client
      await ensureClientCoa(clientId);

      // Create stub user
      const { error: userInsertError } = await supabaseAdmin.from("app_users").insert({
        id: userId,
        email,
        role: "user",
        subscription_status: "trialing",
        default_client_id: clientId,
        client_id: clientId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (userInsertError) {
        console.error("Supabase app_users insert error:", userInsertError.message);
        return res.status(500).json({ error: userInsertError.message });
      }
    }

    // ============================================================
    // 2. Check existing subscription
    // ============================================================
    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("status, trial_end")
      .eq("user_id", userId)
      .maybeSingle();

    const now = new Date();

    if (
      existing &&
      (
        existing.status === "active" ||
        (existing.trial_end && new Date(existing.trial_end) > now)
      )
    ) {
      return res.status(200).json({
        success: true,
        trialActive: true,
        trialEndsAt: existing.trial_end,
        status: existing.status,
      });
    }

    // ============================================================
    // 3. Create new 24h trial
    // ============================================================
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

    // ============================================================
    // 4. Audit log
    // ============================================================
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId ?? null,
        actor_email: email,
        action: "TRIAL_STARTED",
        details: `Trial started until ${trialEnd.toISOString()}`,
        timestamp: new Date().toISOString(),
      },
    ]);

    // ============================================================
    // 5. Response
    // ============================================================
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
