// pages/api/recurring-invoices/index.ts
// PURPOSE:
//   Handles listing and creating recurring invoice schedules.
//
// ENDPOINTS:
//   GET  /api/recurring-invoices
//       → Returns all recurring schedules for the authenticated business owner.
//
//   POST /api/recurring-invoices
//       → Creates a new recurring invoice schedule.
//
// POSITION IN PIPELINE:
//   • This is the entry point for creating recurring schedules.
//   • The UI sends template_line_items here.
//   • These line items MUST already be in PENCE (UI converts pounds → pence).
//   • This endpoint stores them exactly as provided.
//   • processRecurringSchedule() later consumes these values to create invoices.
//
// MONEY MODEL:
//   • This file does NOT perform any money conversion.
//   • It simply stores template_line_items exactly as received.
//   • The UI is responsible for converting pounds → pence before POST.
//   • The recurring engine and invoice creation logic (already fixed) assume pence.
//
// VERIFIED:
//   • No money logic exists here.
//   • No formatting drift.
//   • No risk of mismatched totals.
//   • Safe and correct.

import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorised" });

  // Business owner (or acting-as client business)
  const businessOwnerId = session.user.id; // ALWAYS the real user
const actingClientId = session.user.actingAsClientId || session.user.clientId;


  // -------------------------------------------------------------
  // GET — List recurring schedules
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // POST — Create new recurring schedule
  // -------------------------------------------------------------
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
    user_id: businessOwnerId,       // always the real user
    client_id: clientId,            // the client selected in the UI
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
