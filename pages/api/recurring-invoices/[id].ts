import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorised" });

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid ID" });
  }

  // ⭐ Business owner identity (accountant-aware)
  const businessOwnerId = session.user.actingAsClientId || session.user.id;

  if (req.method === "GET") {
    try {
      const { data, error } = await supabaseAdmin
        .from("recurring_invoices")
        .select("*")
        .eq("id", id)
        .eq("user_id", businessOwnerId)   // ⭐ FIXED: always filter by business owner
        .maybeSingle();

      if (error) {
        console.error("Supabase error:", error);
        return res.status(500).json({ error: "Failed to fetch recurring invoice" });
      }

      if (!data) {
        return res.status(404).json({ error: "Recurring invoice not found" });
      }

      return res.status(200).json({ recurring: data });
    } catch (err) {
      console.error("Unexpected GET error:", err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
