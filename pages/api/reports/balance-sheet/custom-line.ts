// pages/api/reports/balance-sheet/custom-line.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  const clientId = session?.user?.clientId;

  if (!clientId) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  if (req.method === "POST") {
    const { section, subsection, label, amount, year } = req.body;

    const { data, error } = await supabaseAdmin
      .from("balance_sheet_custom_lines")
      .insert({
        client_id: clientId,
        section,
        subsection,
        label,
        amount,
        year: year || null,
        sort_order: Date.now(), // simple ordering
      })
      .select()
      .single();

    if (error) {
      console.error("Create custom line error:", error);
      return res.status(500).json({ error: "Failed to create line" });
    }

    return res.status(200).json(data);
  }

  if (req.method === "PUT") {
    const { id, section, subsection, label, amount, sort_order } = req.body;

    const { error } = await supabaseAdmin
      .from("balance_sheet_custom_lines")
      .update({
        section,
        subsection,
        label,
        amount,
        sort_order,
      })
      .eq("id", id)
      .eq("client_id", clientId);

    if (error) {
      console.error("Update custom line error:", error);
      return res.status(500).json({ error: "Failed to update line" });
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { id } = req.body;

    const { error } = await supabaseAdmin
      .from("balance_sheet_custom_lines")
      .delete()
      .eq("id", id)
      .eq("client_id", clientId);

    if (error) {
      console.error("Delete custom line error:", error);
      return res.status(500).json({ error: "Failed to delete line" });
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
