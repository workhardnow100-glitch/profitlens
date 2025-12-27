import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  // ⭐ Normalize role
  const role = (session.user.role || "").toUpperCase();
  const accountantEmail = session.user.email.toLowerCase();
  const actingAs = session.user.actingAsClientId;

  const { clientId } = req.body || {};
  if (!clientId)
    return res.status(400).json({ error: "Missing clientId" });

  // ⭐ Founder/Admin bypass
  if (!["ADMIN", "FOUNDER"].includes(role)) {

    // ⭐ Only accountants allowed
    if (role !== "ACCOUNTANT")
      return res.status(403).json({ error: "Only accountants allowed" });

    // ⭐ Accountant must be acting as a client
    if (!actingAs)
      return res.status(403).json({ error: "No client selected" });

    if (actingAs !== clientId)
      return res.status(403).json({ error: "Not acting as this client" });

    // ⭐ Validate accountant-client relationship
    const { data: access, error: accessErr } = await supabaseAdmin
      .from("accountant_clients")
      .select("client_id")
      .eq("accountant_email", accountantEmail)
      .eq("client_id", clientId)
      .maybeSingle();

    if (accessErr)
      return res.status(500).json({ error: "Access validation failed" });

    if (!access)
      return res.status(403).json({ error: "No permission for this client" });
  }

  // ⭐ Fetch client profile
  const { data: client, error: clientErr } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (clientErr)
    return res.status(500).json({ error: "Failed to load client profile" });

  if (!client)
    return res.status(404).json({ error: "Client not found" });

  // ⭐ Audit log
  await supabaseAdmin.from("audit").insert([
    {
      client_id: clientId,
      actor_email: accountantEmail,
      action: "ACCOUNTANT_VIEW_CLIENT_PROFILE",
      details: `Viewed client profile for ${clientId}`,
      timestamp: new Date().toISOString(),
    },
  ]);

  return res.status(200).json({
    success: true,
    client,
  });
}
