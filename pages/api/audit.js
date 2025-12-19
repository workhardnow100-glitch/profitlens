// pages/api/audit.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  const clientId = session.user.clientId;
  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  if (req.method === "POST") {
    const { action, details } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const entry = {
      id: crypto.randomUUID(),              // UUID for row
      client_id: clientId,                  // UUID
      actor_email: session.user.email,      // text column
      action,
      details: details || "",
      timestamp: new Date().toISOString(),  // timestamptz
      user: null,                           // UUID column, force null
      user_id: null                         // UUID column, force null
    };

    const { error } = await supabaseAdmin.from("audit").insert([entry]);

    if (error) {
      console.error("❌ Audit insert error:", error.message);
      return res.status(500).json({ error: "Failed to log audit entry" });
    }

    return res.status(200).json({ success: true, entry });
  }

  if (req.method === "GET") {
    const { data, error } = await supabaseAdmin
      .from("audit")
      .select("*")
      .eq("client_id", clientId)
      .order("timestamp", { ascending: false });

    if (error) {
      console.error("❌ Audit fetch error:", error.message);
      return res.status(500).json({ error: "Failed to fetch audit logs" });
    }

    return res.status(200).json(data);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
