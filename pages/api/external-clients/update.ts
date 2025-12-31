// pages/api/external-clients/update.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = session.user.id as string;
  const {
    id,
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

  if (!id) {
    return res.status(400).json({ error: "Missing client ID" });
  }

  if (!contact_email) {
    return res.status(400).json({ error: "Client email is required" });
  }

  try {
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
      .eq("id", id)
      .eq("owner_id", userId)
      .select()
      .single();

    if (error || !data) {
      console.error("External client update error:", error);
      return res.status(500).json({ error: "Failed to update external client" });
    }

    return res.status(200).json({ externalClient: data });
  } catch (err) {
    console.error("Update external client error:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
