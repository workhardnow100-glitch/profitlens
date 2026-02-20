// pages/api/journal/list.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const clientId = session.user.actingAsClientId || session.user.clientId;
  if (!clientId) return res.status(400).json({ error: "Invalid client ID" });

  const { data, error } = await supabaseAdmin.rpc(
    "list_journals_for_client",
    { p_client_id: clientId }
  );

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to load journals" });
  }

  return res.status(200).json({ journals: data });
}
