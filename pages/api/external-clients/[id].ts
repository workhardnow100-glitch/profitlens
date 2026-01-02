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
        .neq("deleted", true)
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
      let {
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

      // Normalize + trim
      contact_name = contact_name?.trim();
      business_name = business_name?.trim();
      trading_name = trading_name?.trim();
      contact_email = contact_email?.trim()?.toLowerCase();
      phone = phone?.trim();
      address_line1 = address_line1?.trim();
      address_line2 = address_line2?.trim();
      city = city?.trim();
      postcode = postcode?.trim();
      country = country?.trim();

      // Required fields
      if (!contact_name) {
        return res.status(400).json({ error: "Client name is required" });
      }

      if (!business_name) {
        return res.status(400).json({ error: "Business name is required" });
      }

      if (!contact_email) {
        return res.status(400).json({ error: "Client email is required" });
      }

      // Prevent duplicate emails
      const { data: existing } = await supabaseAdmin
        .from("external_clients")
        .select("id")
        .eq("owner_id", userId)
        .eq("contact_email", contact_email)
        .neq("id", clientId)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({
          error: "Another client with this email already exists",
        });
      }

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
  // DELETE — Soft delete external client
  // ---------------------------------------------------------
  if (req.method === "DELETE") {
    try {
      const { error } = await supabaseAdmin
        .from("external_clients")
        .update({
          deleted: true,
          updated_at: new Date().toISOString(),
        })
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
