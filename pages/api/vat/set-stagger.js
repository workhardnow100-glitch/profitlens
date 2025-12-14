import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { clientId, stagger } = req.body;

  if (!clientId || !stagger)
    return res.status(400).json({ error: "Missing clientId or stagger" });

  if (![1, 2, 3].includes(Number(stagger)))
    return res.status(400).json({ error: "Invalid stagger value" });

  try {
    const { error } = await supabaseAdmin
      .from("vat_settings")
      .upsert({
        client_id: clientId,
        stagger: Number(stagger),
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("VAT stagger update error:", err);
    return res.status(500).json({ error: err.message });
  }
}
