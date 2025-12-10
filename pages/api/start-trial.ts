export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    // If no session, allow trial creation for guest email
    if (!session?.user?.id) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { data: existing } = await supabaseAdmin
      .from("subscriptions")
      .select("status, trial_end")
      .eq("user_id", session.user.id)
      .single();

    // If already active or trialing, return existing
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
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
