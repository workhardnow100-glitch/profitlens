import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const userId = session.user.id;
  const actingClient = session.user.actingAsClientId;

  try {
    // ✅ 1. Get all client IDs this user can access
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

    // ✅ 2. Fetch client names
    const { data: clients, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, name")
      .in("id", clientIds);

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
