// pages/api/accountant/switch-client.js
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { unstable_update } from "next-auth"; // ⭐ REQUIRED

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  const role = (session.user.role || "").toUpperCase();
  const accountantEmail = session.user.email.toLowerCase();
  const userId = session.user.id;

  const { clientId } = req.body;
  if (!clientId)
    return res.status(400).json({ error: "Missing clientId" });

  const allowedRoles = ["ACCOUNTANT", "FOUNDER", "ADMIN"];
  if (!allowedRoles.includes(role)) {
    return res.status(403).json({
      error: "You do not have permission to switch clients",
    });
  }

  if (role === "ACCOUNTANT") {
    const { data: access, error: accessErr } = await supabaseAdmin
      .from("accountant_clients")
      .select("client_id")
      .eq("accountant_email", accountantEmail)
      .eq("client_id", clientId)
      .maybeSingle();

    if (accessErr) {
      console.error("Access check error:", accessErr);
      return res.status(500).json({ error: "Failed to validate access" });
    }

    if (!access) {
      return res.status(403).json({
        error: "You do not have permission to access this client",
      });
    }
  }

  await supabaseAdmin.from("audit").insert([
    {
      client_id: clientId,
      actor_email: accountantEmail,
      action: "ACCOUNTANT_SWITCH_CLIENT",
      details: `Switched to client ${clientId}`,
      timestamp: new Date().toISOString(),
    },
  ]);

  // ⭐ Update DB (optional but fine)
  await supabaseAdmin
    .from("app_users")
    .update({ acting_client_id: clientId })
    .eq("id", userId);

  // ⭐ CRITICAL: Update NextAuth session
  await unstable_update({
    user: {
      ...session.user,
      actingAsClientId: clientId,
    },
  });

  return res.status(200).json({
    success: true,
    actingAsClientId: clientId,
  });
}
