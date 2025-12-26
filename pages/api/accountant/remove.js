// pages/api/accountant/remove.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  const userEmail = session.user.email.toLowerCase();
  const clientId = session.user.default_client_id; // ⭐ Correct session field

  // ⭐ Allow: user, admin, founder
  if (!["user", "admin", "founder"].includes(role)) {
    return res.status(403).json({
      error: "Only clients can revoke accountant access",
    });
  }

  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  const { accountantEmail } = req.body || {};
  if (!accountantEmail || !accountantEmail.includes("@")) {
    return res.status(400).json({ error: "Invalid accountant email" });
  }

  const normalizedEmail = accountantEmail.toLowerCase().trim();

  // ⭐ Prevent revoking yourself
  if (normalizedEmail === userEmail) {
    return res.status(400).json({
      error: "You cannot revoke yourself as your own accountant",
    });
  }

  try {
    // ⭐ 1. Check if accountant currently has access
    const { data: accessRow, error: accessErr } = await supabaseAdmin
      .from("accountant_clients")
      .select("*")
      .eq("accountant_email", normalizedEmail)
      .eq("client_id", clientId)
      .maybeSingle();

    if (accessErr) {
      console.error("Access check error:", accessErr);
      return res.status(500).json({ error: "Failed to validate access" });
    }

    if (!accessRow) {
      return res.status(404).json({
        error: "This accountant does not have access to your account",
      });
    }

    // ⭐ 2. Remove access
    const { error: deleteErr } = await supabaseAdmin
      .from("accountant_clients")
      .delete()
      .eq("id", accessRow.id);

    if (deleteErr) {
      console.error("Access removal error:", deleteErr);
      return res.status(500).json({ error: "Failed to remove access" });
    }

    // ⭐ 3. Clear acting_client_id if accountant is currently acting as this client
    const { error: clearErr } = await supabaseAdmin
      .from("app_users")
      .update({ acting_client_id: null })
      .eq("email", normalizedEmail)
      .eq("acting_client_id", clientId);

    if (clearErr) {
      console.error("Failed to clear acting_client_id:", clearErr);
      // Non‑fatal
    }

    // ⭐ 4. Audit log
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: userEmail,
        action: "ACCOUNTANT_ACCESS_REVOKED",
        details: `Revoked access for accountant ${normalizedEmail}`,
        timestamp: new Date().toISOString(),
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Accountant access removed",
    });
  } catch (err) {
    console.error("Remove accountant access error:", err);
    return res.status(500).json({ error: "Server error" });
  }
}
