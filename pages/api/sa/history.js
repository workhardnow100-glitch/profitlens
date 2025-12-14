// pages/api/sa/history.js
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { clientId } = req.body;

  if (!clientId)
    return res.status(400).json({ error: "Missing clientId" });

  try {
    const { data: submissions, error } = await supabaseAdmin
      .from("sa_submissions")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({ submissions });
  } catch (err) {
    console.error("SA history error:", err);
    return res.status(500).json({ error: err.message });
  }
}
