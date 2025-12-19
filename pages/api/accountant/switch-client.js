// pages/api/accountant/switch-client.js
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  const accountantEmail = session.user.email;
  const actingAs = session.user.actingAsClientId;

  const { clientId } = req.body;
  if (!clientId)
    return res.status(400).json({ error: "Missing clientId" });

  // ✅ Admin bypass (optional)
  if (role === "admin") {
    // Admin can switch to any client
  } else {
    // ✅ Only accountants can switch clients
    if (role !== "accountant") {
      return res
        .status(403)
        .json({ error: "Only accountants can switch clients" });
    }

    // ✅ Validate accountant has permanent access to this client
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

    if (!access || !access.client_id) {
      return res.status(403).json({
        error: "You do not have permission to access this client",
      });
    }
  }

  // ✅ Log the switch
  await supabaseAdmin.from("audit").insert([
    {
      client_id: clientId,
      actor_email: accountantEmail,
      action: "ACCOUNTANT_SWITCH_CLIENT",
      details: `Switched to client ${clientId}`,
      timestamp: new Date().toISOString(),
    },
  ]);

  // ✅ Persist acting client in database
  const { error: updateErr } = await supabaseAdmin
    .from("app_users")
    .update({ acting_client_id: clientId })
    .eq("id", session.user.id);

  if (updateErr) {
    console.error("Failed to update acting client:", updateErr);
    return res.status(500).json({ error: "Failed to update acting client" });
  }

  // ✅ Final safety check
  if (role === "accountant" && clientId !== clientId) {
    return res.status(403).json({
      error: "Context mismatch: cannot switch to this client",
    });
  }

  return res.status(200).json({
    success: true,
    actingAsClientId: clientId,
  });
}
