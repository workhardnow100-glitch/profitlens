// pages/api/trial-balance.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../lib/supabase-client"; // ✅ correct import for your project

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const clientId = req.query.clientId as string;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    if (!clientId) {
      return res.status(400).json({ error: "Missing clientId" });
    }

    // ✅ Directly call RPC using your existing supabase client
    const { data, error } = await supabase.rpc("trial_balance_for_client", {
      p_client_id: clientId,
      p_start_date: startDate ?? null,
      p_end_date: endDate ?? null,
    });

    if (error) {
      console.error("TB RPC error:", error);
      return res.status(500).json({ error: "Failed to load trial balance" });
    }

    return res.status(200).json({ rows: data ?? [] });
  } catch (err) {
    console.error("TB route error:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
