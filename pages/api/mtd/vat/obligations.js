// pages/api/mtd/vat/obligations.js
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { mtdClient } from "../../../../lib/mtd-client"; // adjust if needed

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Load session
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const actingClientId = session.user.actingAsClientId;
  if (!actingClientId) {
    return res.status(400).json({ error: "No client selected" });
  }

  // Load client VAT number
  const { data: client, error: clientErr } = await supabaseAdmin
    .from("clients")
    .select("vat_number")
    .eq("id", actingClientId)
    .maybeSingle();

  if (clientErr || !client) {
    return res.status(500).json({ error: "Failed to load client VAT number" });
  }

  const vrn = client.vat_number;
  if (!vrn) {
    return res.status(400).json({ error: "Client has no VAT number" });
  }

  try {
    // Call HMRC MTD VAT obligations
    const obligations = await mtdClient.getVATObligations(vrn);

    return res.status(200).json({
      success: true,
      obligations,
    });
  } catch (err) {
    console.error("MTD VAT obligations error:", err);
    return res.status(500).json({
      error: "Failed to fetch VAT obligations",
      details: err?.message || err,
    });
  }
}
