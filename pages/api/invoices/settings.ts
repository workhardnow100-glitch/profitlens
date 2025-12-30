// pages/api/invoices/settings.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);

  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  const userId = session.user.id as string;

  if (req.method === "GET") {
    try {
      const { data, error } = await supabaseAdmin
        .from("user_invoice_settings")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = row not found for single()
        console.error(error);
        return res.status(500).json({ error: "Failed to fetch invoice settings" });
      }

      // Provide sensible defaults if no row yet
      const settings = data || {
        user_id: userId,
        default_payment_terms: "Payment due within 14 days.",
        default_vat_rate: 20,
        default_notes: "",
        default_payment_instructions: "",
        default_footer: "",
        default_invoice_prefix: "INV-",
      };

      return res.status(200).json({ settings });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  if (req.method === "PUT") {
    try {
      const {
        default_payment_terms,
        default_vat_rate,
        default_notes,
        default_payment_instructions,
        default_footer,
        default_invoice_prefix,
      } = req.body;

      const { data, error } = await supabaseAdmin
        .from("user_invoice_settings")
        .upsert(
          {
            user_id: userId,
            default_payment_terms,
            default_vat_rate,
            default_notes,
            default_payment_instructions,
            default_footer,
            default_invoice_prefix,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to update invoice settings" });
      }

      return res.status(200).json({ settings: data });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
