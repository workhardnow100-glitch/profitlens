// pages/api/accountants/accept.js
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { token, name } = req.body;

  if (!token)
    return res.status(400).json({ error: "Missing token" });

  try {
    // ✅ 1. Fetch invite token
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

    // ✅ 2. Check if accountant user already exists
    const { data: existingUser } = await supabaseAdmin
      .from("app_users")
      .select("*")
      .eq("email", accountantEmail)
      .maybeSingle();

    let userId;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // ✅ 3. Create new accountant user
      const { data: newUser, error: createError } = await supabaseAdmin
        .from("app_users")
        .insert({
          email: accountantEmail,
          name: name || null,
          role: "accountant",
          subscription_status: "trialing",
          default_client_id: invite.client_id, // safe default
        })
        .select()
        .single();

      if (createError) {
        console.error("User creation error:", createError);
        return res.status(500).json({ error: "Failed to create accountant user" });
      }

      userId = newUser.id;
    }

    // ✅ 4. Grant permanent access in accountant_clients
    const { error: accessError } = await supabaseAdmin
      .from("accountant_clients")
      .insert({
        accountant_email: accountantEmail,
        client_id: invite.client_id,
      });

    if (accessError && accessError.code !== "23505") {
      // 23505 = duplicate (already has access)
      console.error("Access insert error:", accessError);
      return res.status(500).json({ error: "Failed to grant access" });
    }

    // ✅ 5. Mark invite as used
    await supabaseAdmin
      .from("accountant_access")
      .update({ used: true })
      .eq("id", invite.id);

    return res.status(200).json({
      success: true,
      message: "Accountant access granted",
    });
  } catch (err) {
    console.error("Accept invite error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
