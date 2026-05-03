//// pages/api/accountant/accept.js
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { token, name } = req.body;

  if (!token)
    return res.status(400).json({ error: "Missing token" });

  try {
    // 1. Fetch invite token
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("accountant_access")
      .select("*")
      .eq("token", token)
      .single();

    if (inviteError || !invite)
      return res.status(400).json({ error: "Invalid invite token" });

    if (invite.used)
      return res.status(400).json({ error: "Invite already used" });

    if (new Date(invite.expires_at) < new Date())
      return res.status(400).json({ error: "Invite expired" });

    const accountantEmail = invite.accountant_email.toLowerCase();

    // 2. Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from("app_users")
      .select("*")
      .eq("email", accountantEmail)
      .maybeSingle();

    let userId;

    if (!existingUser) {
      // 3. Create new accountant user with PRO subscription
      const { data: newUser, error: createError } = await supabaseAdmin
        .from("app_users")
        .insert({
          email: accountantEmail,
          name: name || null,
          role: "ACCOUNTANT",
          subscription_status: "pro",
          client_id: null,
          default_client_id: null,
          acting_client_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        console.error("User creation error:", createError);
        return res.status(500).json({ error: "Failed to create accountant user" });
      }

      userId = newUser.id;
    } else {
      // 4. Existing user — upgrade to accountant safely
      userId = existingUser.id;

      // Founder protection
      if (existingUser.role === "FOUNDER") {
        await supabaseAdmin
          .from("accountant_access")
          .update({ used: true })
          .eq("id", invite.id);

        return res.status(200).json({
          success: true,
          message: "Founder already has full access",
        });
      }

      // Upgrade role + give PRO access + clear client fields
      await supabaseAdmin
        .from("app_users")
        .update({
          role: "ACCOUNTANT",
          subscription_status: "pro",
          client_id: null,
          default_client_id: null,
          acting_client_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingUser.id);
    }

    // 5. Grant access in accountant_clients
    const { error: accessError } = await supabaseAdmin
      .from("accountant_clients")
      .upsert(
        {
          accountant_email: accountantEmail,
          client_id: invite.client_id,
        },
        { onConflict: "accountant_email,client_id" }
      );

    if (accessError) {
      console.error("Access insert error:", accessError);
      return res.status(500).json({ error: "Failed to grant access" });
    }

    // 6. Mark invite as used
    await supabaseAdmin
      .from("accountant_access")
      .update({ used: true })
      .eq("id", invite.id);

    // 7. ⭐ BULLETPROOF: Return NextAuth login URL
    const loginUrl = `/api/auth/signin?email=${encodeURIComponent(
      accountantEmail
    )}`;

    return res.status(200).json({
      success: true,
      message: "Accountant access granted. Please log in.",
      loginUrl,
    });
  } catch (err) {
    console.error("Accept invite error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
