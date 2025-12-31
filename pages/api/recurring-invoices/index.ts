import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorised" });

  // ⭐ Who owns the business?
  // If accountant is acting for a business → use that business ID
  // If normal user → use their own user ID
  const businessOwnerId = session.user.actingAsClientId || session.user.id;

  // ============================================================
  // GET — List recurring schedules for the business owner
  // ============================================================
  if (req.method === "GET") {
    try {
      const { data, error } = await supabaseAdmin
        .from("recurring_invoices")
        .select("*")
        .eq("user_id", businessOwnerId)   // ⭐ Always filter by business owner
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

  // ============================================================
  // POST — Create a new recurring schedule
  // ============================================================
  if (req.method === "POST") {
    try {
      const {
        clientId,                       // ⭐ This is the CUSTOMER
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

      const now = new Date().toISOString();

      // ⭐ CRITICAL FIX:
      // user_id = business owner
      // client_id = customer
      const { data, error } = await supabaseAdmin
        .from("recurring_invoices")
        .insert({
          user_id: businessOwnerId,           // ⭐ Always the business owner
          client_id: clientId,                // ⭐ Always the customer
          template_line_items: templateLineItems,
          template_payment_instructions: templatePaymentInstructions,
          template_notes: templateNotes,
          frequency_type: frequencyType,
          interval,
          day_of_week: dayOfWeek,
          day_of_month: dayOfMonth,
          custom_rule: customRule,
          start_date: startDate,
          next_run_date: startDate,
          end_date: endDate || null,
          active: true,
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
