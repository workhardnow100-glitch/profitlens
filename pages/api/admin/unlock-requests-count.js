// pages/api/admin/unlock-requests-count.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  if (session.user.role !== "admin") {
    return res.status(403).json({ error: "Admins only" });
  }

  const { data, error } = await supabaseAdmin
    .from("journal_unlock_requests")
    .select("id", { count: "exact" })
    .eq("status", "pending");

  if (error) {
    console.error("Count error:", error);
    return res.status(500).json({ error: "Failed to count requests" });
  }

  return res.status(200).json({ pending: data.length });
}
