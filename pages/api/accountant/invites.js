// pages/api/accountant/invite.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  const userEmail = session.user.email;
  const clientId = session.user.clientId;

  // ⭐ Allow: user, admin, founder
  if (!["user", "admin", "founder"].includes(role)) {
    return res.status(403).json({
      error: "Only clients can invite accountants",
    });
  }

  // ⭐ Client must have a valid clientId
  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  const { accountantEmail } = req.body || {};
  if (!accountantEmail || !accountantEmail.includes("@")) {
    return res.status(400).json({ error: "Invalid accountant email" });
  }

  const normalizedEmail = accountantEmail.toLowerCase().trim();

  // ⭐ Prevent inviting yourself
  if (normalizedEmail === userEmail.toLowerCase()) {
    return res.status(400).json({
      error: "You cannot invite yourself as your own accountant",
    });
  }

  try {
    // ⭐ Prevent inviting an accountant who already has permanent access
    const { data: existingAccess } = await supabaseAdmin
      .from("accountant_clients")
      .select("id")
      .eq("accountant_email", normalizedEmail)
      .eq("client_id", clientId)
      .maybeSingle();

    if (existingAccess) {
      return res.status(400).json({
        error: "This accountant already has access to your account",
      });
    }

    // ⭐ Prevent duplicate active invites
    const { data: existingInvite, error: inviteCheckErr } =
      await supabaseAdmin
        .from("accountant_access")
        .select("id, used, expires_at")
        .eq("client_id", clientId)
        .eq("accountant_email", normalizedEmail)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (inviteCheckErr) {
      console.error("Invite lookup error:", inviteCheckErr);
      return res.status(500).json({ error: "Failed to validate invite state" });
    }

    if (existingInvite) {
      const expired =
        existingInvite.expires_at &&
        new Date(existingInvite.expires_at) < new Date();

      if (!expired && !existingInvite.used) {
        return res.status(400).json({
          error: "An active invitation already exists for this accountant",
        });
      }
    }

    // ⭐ Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3); // 3 days

    // ⭐ Insert invitation
    const { error: insertErr } = await supabaseAdmin
      .from("accountant_access")
      .insert([
        {
          client_id: clientId,
          accountant_email: normalizedEmail,
          token,
          expires_at: expiresAt.toISOString(),
          used: false,
        },
      ]);

    if (insertErr) {
      console.error("Invite insert error:", insertErr);
      return res.status(500).json({ error: "Failed to create invite" });
    }

    // ⭐ Log the invitation
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: userEmail,
        action: "ACCOUNTANT_INVITE_SENT",
        details: `Invited accountant ${normalizedEmail}`,
        timestamp: new Date().toISOString(),
      },
    ]);

    // ⭐ Real invite link (update domain if needed)
    const inviteLink = `https://profitlens.vercel.app/accountant/accept?token=${token}`;
    console.log("📧 Accountant invite link:", inviteLink);

    return res.status(200).json({
      success: true,
      message: "Invitation sent",
      inviteLink,
    });
  } catch (err) {
    console.error("Invite error:", err);
    return res.status(500).json({ error: "Failed to send invite" });
  }
}
