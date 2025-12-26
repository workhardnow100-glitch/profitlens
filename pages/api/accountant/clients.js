// pages/api/accountant/clients.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  const accountantEmail = session.user.email.toLowerCase();

  // ⭐ Allow accountant, admin, founder
  if (!["ACCOUNTANT", "admin", "founder"].includes(role)) {
    return res.status(403).json({
      error: "Only accountants can view their client list",
    });
  }

  try {
    // ⭐ Fetch all client IDs this accountant has access to
    const { data: accessRows, error: accessErr } = await supabaseAdmin
      .from("accountant_clients")
      .select("client_id")
      .eq("accountant_email", accountantEmail);

    if (accessErr) {
      console.error("Accountant access fetch error:", accessErr);
      throw accessErr;
    }

    const clientIds = accessRows?.map((r) => r.client_id) || [];

    // ⭐ No clients yet
    if (clientIds.length === 0) {
      return res.status(200).json({ success: true, clients: [] });
    }

    // ⭐ Fetch client metadata
    const { data: clients, error: clientErr } = await supabaseAdmin
      .from("app_users")
      .select(
        "id, email, name, business_name, subscription_status, client_id"
      )
      .in("client_id", clientIds);

    if (clientErr) {
      console.error("Client metadata fetch error:", clientErr);
      throw clientErr;
    }

    // ⭐ Audit log
    await supabaseAdmin.from("audit").insert([
      {
        client_id: null,
        actor_email: accountantEmail,
        action: "ACCOUNTANT_LIST_CLIENTS",
        details: `Fetched ${clients?.length ?? 0} clients`,
        timestamp: new Date().toISOString(),
      },
    ]);

    return res.status(200).json({
      success: true,
      clients: clients || [],
    });
  } catch (err) {
    console.error("Accountant clients error:", err);
    return res.status(500).json({ error: err.message });
  }
}
