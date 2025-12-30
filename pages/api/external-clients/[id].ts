// pages/api/external-clients/[id].ts

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
  const externalClientId = req.query.id as string;

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { data: externalClient, error } = await supabaseAdmin
    .from("external_clients")
    .select("*")
    .eq("id", externalClientId)
    .eq("owner_id", userId)
    .single();

  if (error || !externalClient) {
    return res.status(404).json({ error: "External client not found" });
  }

  return res.status(200).json({ externalClient });
}
