// pages/api/recurring-invoices/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorised" });

  // Business owner (or acting-as client business)
  const businessOwnerId = session.user.actingAsClientId || session.user.id;

  if (req.method === "GET") {
    try {
      const { data, error } = await supabaseAdmin
        .from("recurring_invoices")
        .select("*")
        .eq("user_id", businessOwnerId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase error:", error);
        return res.status(500).json({ error: "Failed to fetch recurring invoices" });
      }

      return res.status(200).json({ recurring: data || [] });
    } catch (err) {
      console.error("Unexpected GET error:", err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  if (req.method === "POST") {
    try {
      const {
        clientId,
        templateLineItems,
        templatePaymentInstructions,
        templateNotes,
        frequencyType,
        interval,
        dayOfWeek,
        dayOfMonth,
        customRule,
        startDate,
        endDate,
      } = req.body;

      if (!clientId) {
        return res.status(400).json({ error: "Client is required" });
      }

      const now = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from("recurring_invoices")
        .insert({
          user_id: businessOwnerId,
          client_id: clientId,
          template_line_items: templateLineItems,
          template_payment_instructions: templatePaymentInstructions,
          template_notes: templateNotes,
          frequency_type: frequencyType,
          interval,
          day_of_week: dayOfWeek,
          day_of_month: dayOfMonth,
          custom_rule: customRule,
          start_date: startDate,
          next_run_date: startDate, // v1: first run on start date
          end_date: endDate || null,
          active: true,
          processing: false,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        return res.status(500).json({ error: "Failed to create recurring invoice" });
      }

      return res.status(201).json({ recurring: data });
    } catch (err) {
      console.error("Unexpected POST error:", err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
