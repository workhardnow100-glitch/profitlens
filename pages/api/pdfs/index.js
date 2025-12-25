// pages/api/pdfs/index.js
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { clientId } = req.query;

  if (!clientId || typeof clientId !== "string") {
    return res.status(400).json({ error: "Missing or invalid clientId" });
  }

  const { data, error } = await supabaseAdmin
    .from("pdf_documents")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching pdf_documents:", error);
    return res.status(500).json({ error: "Failed to fetch PDFs" });
  }

  return res.status(200).json({ pdfs: data || [] });
}
