// pages/api/admin/unlock-requests.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  if (session.user.role !== "admin") {
    return res.status(403).json({ error: "Admins only" });
  }

  const statusFilter = req.query.status || null;

  try {
    let query = supabaseAdmin
      .from("journal_unlock_requests")
      .select("*")
      .order("requested_at", { ascending: false });

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data: requests, error } = await query;
    if (error) throw error;

    // Collect accountant + client IDs
    const accountantIds = [...new Set(requests.map((r) => r.requested_by))];
    const clientIds = [...new Set(requests.map((r) => r.client_id))];

    // Fetch accountants
    const { data: accountants } = await supabaseAdmin
      .from("app_users")
      .select("id, email, name")
      .in("id", accountantIds);

    // Fetch clients
    const { data: clients } = await supabaseAdmin
      .from("clients")
      .select("id, name")
      .in("id", clientIds);

    const accountantMap = Object.fromEntries(
      (accountants || []).map((a) => [a.id, a])
    );

    const clientMap = Object.fromEntries(
      (clients || []).map((c) => [c.id, c])
    );

    const enriched = requests.map((r) => ({
      ...r,
      accountant: accountantMap[r.requested_by] || null,
      client: clientMap[r.client_id] || null,
    }));

    return res.status(200).json({ requests: enriched });
  } catch (err) {
    console.error("Unlock requests error:", err);
    return res.status(500).json({ error: "Failed to load unlock requests" });
  }
}
