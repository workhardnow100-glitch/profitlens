import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorised" });

  // ⭐ Determine who we are acting for
  const actingFor = session.user.actingAsClientId || session.user.id;
  const filterColumn = session.user.actingAsClientId ? "client_id" : "user_id";

  // ============================================================
  // GET — List recurring schedules for the acting identity
  // ============================================================
  if (req.method === "GET") {
    try {
      const { data, error } = await supabaseAdmin
        .from("recurring_invoices")
        .select("*")
        .eq(filterColumn, actingFor)
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
      // Insert using the SAME identity logic as GET.
      // This ensures GET will find the row immediately after creation.
      const { data, error } = await supabaseAdmin
        .from("recurring_invoices")
        .insert({
          [filterColumn]: actingFor, // ⭐ MATCHES GET FILTER
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
