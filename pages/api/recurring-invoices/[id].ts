// pages/api/recurring-invoices/[id].ts
// PURPOSE:
// Handles a single recurring invoice schedule for the authenticated business owner.
// - GET:    Load one recurring schedule (including template_line_items stored in pence).
// - PUT:    EITHER:
//           • runNow === true → execute the recurring engine (processRecurringSchedule),
//             create an invoice, PDF, run log, and return all artefacts.
//           • normal update → persist schedule/template changes (template_line_items expected in pence).
// - DELETE: Soft-cancel the schedule by setting active = false.
// MONEY MODEL:
// - This route does NOT perform any pounds↔pence conversion itself.
// - It expects template_line_items.unit_price to already be in pence (handled by the UI).
// - processRecurringSchedule is responsible for creating invoices in pence, which downstream
//   PDF/email generators then convert to pounds by dividing by 100.

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { processRecurringSchedule } from "../../../lib/recurring/processRecurringSchedule";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorised" });

  const { id } = req.query;
  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Invalid ID" });
  }

  const businessOwnerId = session.user.id; // ALWAYS the real user


  // -------------------------------------------------------------
  // GET — Fetch schedule
  // -------------------------------------------------------------
  if (req.method === "GET") {
    try {
      const { data, error } = await supabaseAdmin
        .from("recurring_invoices")
        .select("*")
        .eq("id", id)
        .eq("user_id", businessOwnerId)
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

  // -------------------------------------------------------------
  // PUT — Update OR Run Now
  // -------------------------------------------------------------
  if (req.method === "PUT") {
    const body = req.body;

    // -------------------------------------------------------------
    // MODE 1: RUN NOW (full engine)
    // -------------------------------------------------------------
    if (body.runNow === true) {
      try {
        // Load schedule fresh
        const { data: schedule, error: scheduleError } = await supabaseAdmin
          .from("recurring_invoices")
          .select("*")
          .eq("id", id)
          .eq("user_id", businessOwnerId)
          .single();

        if (scheduleError || !schedule) {
          console.error("Schedule load error:", scheduleError);
          return res.status(404).json({ error: "Schedule not found" });
        }

        // Mark as processing
        await supabaseAdmin
          .from("recurring_invoices")
          .update({ processing: true })
          .eq("id", schedule.id);

        // Run engine (returns invoice created from this schedule)
        const invoice = await processRecurringSchedule(schedule);

        // Fetch PDF metadata
        const { data: pdf } = await supabaseAdmin
          .from("pdf_documents")
          .select("*")
          .eq("invoice_id", invoice.id)
          .maybeSingle();

        // Fetch latest run log
        const { data: runLog } = await supabaseAdmin
          .from("recurring_invoice_runs")
          .select("*")
          .eq("recurring_invoice_id", schedule.id)
          .order("run_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // Reload updated schedule
        const { data: updatedSchedule } = await supabaseAdmin
          .from("recurring_invoices")
          .select("*")
          .eq("id", schedule.id)
          .maybeSingle();

        return res.status(200).json({
          success: true,
          message: "Schedule executed immediately",
          invoice,
          pdf,
          runLog,
          schedule: updatedSchedule,
        });
      } catch (err: any) {
        console.error("RunNow error:", err);
        return res.status(500).json({ error: err?.message || "Run failed" });
      }
    }

    // -------------------------------------------------------------
    // MODE 2: NORMAL UPDATE
    // -------------------------------------------------------------
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
        nextRunDate,
        endDate,
        active,
      } = body;

      const now = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from("recurring_invoices")
        .update({
          client_id: clientId,
          // EXPECTATION: templateLineItems.unit_price is already in pence (UI converts pounds → pence)
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
        .eq("user_id", businessOwnerId)
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

  // -------------------------------------------------------------
  // DELETE — Cancel schedule
  // -------------------------------------------------------------
  if (req.method === "DELETE") {
    try {
      const { error } = await supabaseAdmin
        .from("recurring_invoices")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", businessOwnerId);

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

  return res.status(405).json({ error: "Method not allowed" });
}
