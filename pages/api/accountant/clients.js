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

  const role = session.user.role?.toUpperCase();
  const accountantEmail = session.user.email.toLowerCase();

  // ⭐ DEBUG LOG — this is the key
  console.log("SESSION EMAIL:", accountantEmail);
  console.log("ACCESS ROWS:", accessRows);


  if (!["ACCOUNTANT", "ADMIN", "FOUNDER"].includes(role)) {
    return res.status(403).json({
      error: "Only accountants can view their client list",
    });
  }

  try {
    // 1. Fetch client IDs this accountant can access
    const { data: accessRows, error: accessErr } = await supabaseAdmin
      .from("accountant_clients")
      .select("client_id")
      .eq("accountant_email", accountantEmail);

    if (accessErr) throw accessErr;

    const clientIds = accessRows?.map((r) => r.client_id) || [];

    if (clientIds.length === 0) {
      return res.status(200).json({ success: true, clients: [] });
    }

    // 2. Fetch client metadata from the CORRECT table
    const { data: clients, error: clientErr } = await supabaseAdmin
      .from("clients")
      .select("*")
      .in("id", clientIds);

    if (clientErr) throw clientErr;

    return res.status(200).json({
      success: true,
      clients: clients || [],
    });
  } catch (err) {
    console.error("Accountant clients error:", err);
    return res.status(500).json({ error: err.message });
  }
}
