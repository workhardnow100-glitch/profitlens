// pages/api/external-clients/create.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = session.user.id as string;

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

    if (!contact_email) {
      return res.status(400).json({ error: "Client email is required" });
    }

    const { data, error } = await supabaseAdmin
      .from("external_clients")
      .insert({
        owner_id: userId,
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
      })
      .select()
      .single();

    if (error || !data) {
      console.error("External client create error:", error);
      return res.status(500).json({ error: "Failed to create external client" });
    }

    return res.status(201).json({ externalClient: data });
  } catch (err) {
    console.error("Create external client error:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
