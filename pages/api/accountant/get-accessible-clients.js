// pages/api/accountant/get-accessible-clients.js
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const role = session.user.role;
  const userId = session.user.userId; // ⭐ Correct session field
  const actingClient = session.user.actingAsClientId;

  try {
    // ⭐ Accountants should NOT use this endpoint
    if (role === "accountant") {
      return res.status(403).json({
        success: false,
        error: "Accountants must use /api/accountant/clients",
      });
    }

    // ⭐ Founder/Admin: return ALL clients in the system
    if (role === "founder" || role === "admin") {
      const { data: allClients, error: allErr } = await supabaseAdmin
        .from("app_users")
        .select("client_id, name, business_name")
        .not("client_id", "is", null);

      if (allErr) {
        console.error("Error fetching all clients:", allErr);
        return res.status(500).json({ success: false });
      }

      return res.status(200).json({
        success: true,
        clients: allClients,
        currentClient: actingClient,
      });
    }

    // ⭐ Normal user: fetch only their assigned clients
    const { data: accessRows, error: accessError } = await supabaseAdmin
      .from("user_clients")
      .select("client_id")
      .eq("user_id", userId);

    if (accessError) {
      console.error("Error fetching user_clients:", accessError);
      return res.status(500).json({ success: false });
    }

    const clientIds = accessRows.map((r) => r.client_id);

    if (clientIds.length === 0) {
      return res.status(200).json({
        success: true,
        clients: [],
        currentClient: actingClient,
      });
    }

    // ⭐ Fetch client metadata from app_users (NOT clients table)
    const { data: clients, error: clientError } = await supabaseAdmin
      .from("app_users")
      .select("client_id, name, business_name")
      .in("client_id", clientIds);

    if (clientError) {
      console.error("Error fetching clients:", clientError);
      return res.status(500).json({ success: false });
    }

    return res.status(200).json({
      success: true,
      clients,
      currentClient: actingClient,
    });
  } catch (err) {
    console.error("get-accessible-clients error:", err);
    return res.status(500).json({ success: false });
  }
}
