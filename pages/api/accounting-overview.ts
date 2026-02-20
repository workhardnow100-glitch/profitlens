// pages/api/accounting-overview.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);

    const clientId = session?.user?.clientId as string | undefined;
    if (!clientId) {
      return res.status(400).json({ error: "Missing client context" });
    }

    const { data, error } = await supabaseAdmin.rpc("get_accounting_overview", {
      p_client_id: clientId,
    });

    if (error) {
      console.error("get_accounting_overview error:", error);
      return res.status(500).json({ error: "Failed to load accounting overview" });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Accounting overview handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
