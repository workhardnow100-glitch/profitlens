// pages/api/external-clients/delete.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = session.user.id as string;
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Missing client ID" });
  }

  try {
    const { error } = await supabaseAdmin
      .from("external_clients")
      .delete()
      .eq("id", id)
      .eq("owner_id", userId);

    if (error) {
      console.error("External client delete error:", error);
      return res.status(500).json({ error: "Failed to delete external client" });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Delete external client error:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
