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
    if (!contact_email) {
      return res.status(400).json({ error: "Client email is required" });
    }

    if (!contact_name) {
      return res.status(400).json({ error: "Client name is required" });
    }

    if (!business_name) {
      return res.status(400).json({ error: "Business name is required" });
    }

    // Prevent duplicates
    const { data: existing } = await supabaseAdmin
      .from("external_clients")
      .select("id")
      .eq("owner_id", userId)
      .eq("contact_email", contact_email)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({
        error: "A client with this email already exists",
      });
    }

    // Insert client
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
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
