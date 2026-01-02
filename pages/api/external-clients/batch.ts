// pages/api/external-clients/batch.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 🔥 STOP VERCEL FROM CACHING THIS ROUTE
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = session.user.id as string;
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Missing or invalid ids array" });
  }

  try {
    const { data: externalClients, error } = await supabaseAdmin
      .from("external_clients")
      .select("*")
      .eq("owner_id", userId)
      .in("id", ids);

    if (error) {
      console.error("Batch external clients fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch external clients" });
    }

    return res.status(200).json({ externalClients });
  } catch (err) {
    console.error("Batch external clients error:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
