// pages/api/external-clients/index.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const userId = session.user.id as string;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { q } = req.query;

    let query = supabaseAdmin
      .from("external_clients")
      .select("*")
      .eq("owner_id", userId)
      .neq("deleted", true); // soft-delete safe

    // Optional search
    if (q && typeof q === "string") {
      const search = q.trim();
      if (search.length > 0) {
        query = query.or(
          `contact_name.ilike.%${search}%,business_name.ilike.%${search}%,contact_email.ilike.%${search}%`
        );
      }
    }

    // Order by created_at if present, else business_name
    query = query.order("created_at", { ascending: false }).order("business_name");

    const { data, error } = await query;

    if (error) {
      console.error("External clients fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch external clients" });
    }

    return res.status(200).json({ externalClients: data ?? [] });
  } catch (err) {
    console.error("External clients list error:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
