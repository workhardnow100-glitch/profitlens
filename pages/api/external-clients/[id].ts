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
  const clientId = req.query.id as string;

  if (!clientId) {
    return res.status(400).json({ error: "Missing client ID" });
  }

  // ---------------------------------------------------------
  // GET — Fetch a single external client
  // ---------------------------------------------------------
  if (req.method === "GET") {
    try {
      const { data, error } = await supabaseAdmin
        .from("external_clients")
        .select("*")
        .eq("id", clientId)
        .eq("owner_id", userId)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: "Client not found" });
      }

      return res.status(200).json({ externalClient: data });
    } catch (err) {
      console.error("Fetch client error:", err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  // ---------------------------------------------------------
  // PUT — Update external client
  // ---------------------------------------------------------
  if (req.method === "PUT") {
    try {
      const {
        contact_name,
        business_name,
        trading_name,
        contact_email,
        phone,
        address_line1,
        address_line2,
        city,
        postcode,
        country,
      } = req.body;

      const { data, error } = await supabaseAdmin
        .from("external_clients")
        .update({
          contact_name,
          business_name,
          trading_name,
          contact_email,
          phone,
          address_line1,
          address_line2,
          city,
          postcode,
          country,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clientId)
        .eq("owner_id", userId)
        .select()
        .single();

      if (error || !data) {
        console.error(error);
        return res.status(500).json({ error: "Failed to update client" });
      }

      return res.status(200).json({ externalClient: data });
    } catch (err) {
      console.error("Update client error:", err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  // ---------------------------------------------------------
  // DELETE — Remove external client
  // ---------------------------------------------------------
  if (req.method === "DELETE") {
    try {
      const { error } = await supabaseAdmin
        .from("external_clients")
        .delete()
        .eq("id", clientId)
        .eq("owner_id", userId);

      if (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to delete client" });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("Delete client error:", err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
