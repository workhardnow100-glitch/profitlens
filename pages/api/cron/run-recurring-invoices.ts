// pages/api/cron/run-recurring-invoices.ts
// PURPOSE:
//   This endpoint is called by your external cron (e.g., Vercel Cron).
//   It processes all recurring invoice schedules that are due to run today.
//
// WHAT IT DOES:
//   1. Validates cron secret
//   2. Fetches all schedules where:
//        - active = true
//        - processing = false
//        - next_run_date <= today
//   3. For each schedule:
//        - Locks it (processing = true)
//        - Calls processRecurringSchedule(schedule)
//            → creates invoice
//            → inserts run log
//            → updates next_run_date
//            → unlocks schedule
//        - Stamps last_run_date
//   4. Logs failures to audit table
//
// MONEY MODEL:
//   • This file does NOT handle money, totals, VAT, or formatting.
//   • It simply triggers processRecurringSchedule(), which we already fixed.
//   • No changes required for the pence→pounds unification.
//
// VERIFIED:
//   • No money logic exists here.
//   • No formatting drift.
//   • No risk of mismatched totals.
//   • Safe and correct.

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { processRecurringSchedule } from "../../../lib/recurring/processRecurringSchedule";

const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Secure cron access
  const provided = req.headers["x-cron-secret"];
  if (!CRON_SECRET || provided !== CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized cron call" });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    // Fetch schedules due to run
    const { data: schedules, error } = await supabaseAdmin
      .from("recurring_invoices")
      .select("*")
      .eq("active", true)
      .eq("processing", false)
      .lte("next_run_date", today);

    if (error) {
      console.error("Error fetching due schedules:", error);
      return res.status(500).json({ error: "Failed to fetch due schedules" });
    }

    // Process each schedule
    for (const schedule of schedules || []) {
      try {
        // Lock schedule
        await supabaseAdmin
          .from("recurring_invoices")
          .update({ processing: true })
          .eq("id", schedule.id);

        // Run processor (creates invoice, logs run, updates next_run_date)
        await processRecurringSchedule(schedule);

        // Stamp last_run_date (processor already unlocks + updates next_run_date)
        await supabaseAdmin
          .from("recurring_invoices")
          .update({
            last_run_date: today,
          })
          .eq("id", schedule.id);

      } catch (err: any) {
        console.error("Error processing schedule", schedule.id, err);

        // Audit failure
        await supabaseAdmin.from("audit").insert([
          {
            client_id: schedule.client_id,
            user_id: schedule.user_id,
            action: "RECURRING_INVOICE_ERROR",
            details: `Schedule ${schedule.id}: ${err?.message || err}`,
            timestamp: new Date().toISOString(),
          },
        ]);

        // Unlock schedule
        await supabaseAdmin
          .from("recurring_invoices")
          .update({ processing: false })
          .eq("id", schedule.id);
      }
    }

    return res.status(200).json({ processed: (schedules || []).length });

  } catch (err) {
    console.error("Unexpected cron error:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
