import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorised" });

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid ID" });
  }

  // ⭐ Business owner identity (accountant-aware)
  const businessOwnerId = session.user.actingAsClientId || session.user.id;

  // ============================================================
  // GET — Fetch a single recurring schedule
  // ============================================================
  if (req.method === "GET") {
    try {
      const { data, error } = await supabaseAdmin
        .from("recurring_invoices")
        .select("*")
        .eq("id", id)
        .eq("user_id", businessOwnerId)   // ⭐ Always filter by business owner
        .maybeSingle();

      if (error) {
        console.error("Supabase error:", error);
        return res.status(500).json({ error: "Failed to fetch recurring invoice" });
      }

      if (!data) {
        return res.status(404).json({ error: "Recurring invoice not found" });
      }

      return res.status(200).json({ recurring: data });
    } catch (err) {
      console.error("Unexpected GET error:", err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  // ============================================================
  // PUT — Update a recurring schedule
  // ============================================================
  if (req.method === "PUT") {
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
        nextRunDate,
        endDate,
        active,
      } = req.body;

      const now = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from("recurring_invoices")
        .update({
          template_line_items: templateLineItems,
          template_payment_instructions: templatePaymentInstructions,
          template_notes: templateNotes,
          frequency_type: frequencyType,
          interval,
          day_of_week: dayOfWeek,
          day_of_month: dayOfMonth,
          custom_rule: customRule,
          start_date: startDate,
          next_run_date: nextRunDate,
          end_date: endDate || null,
          active,
          updated_at: now,
        })
        .eq("id", id)
        .eq("user_id", businessOwnerId)   // ⭐ Accountant-aware filter
        .select()
        .single();

      if (error) {
        console.error("Supabase update error:", error);
        return res.status(500).json({ error: "Failed to update recurring invoice" });
      }

      return res.status(200).json({ recurring: data });
    } catch (err) {
      console.error("Unexpected PUT error:", err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  // ============================================================
  // DELETE — Cancel a recurring schedule
  // ============================================================
  if (req.method === "DELETE") {
    try {
      const { error } = await supabaseAdmin
        .from("recurring_invoices")
        .delete()
        .eq("id", id)
        .eq("user_id", businessOwnerId);   // ⭐ Accountant-aware filter

      if (error) {
        console.error("Supabase delete error:", error);
        return res.status(500).json({ error: "Failed to cancel recurring invoice" });
      }

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("Unexpected DELETE error:", err);
      return res.status(500).json({ error: "Unexpected error" });
    }
  }

  // ============================================================
  // Unsupported method
  // ============================================================
  return res.status(405).json({ error: "Method not allowed" });
}
