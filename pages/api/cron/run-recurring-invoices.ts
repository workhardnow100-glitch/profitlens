import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { processRecurringSchedule } from "../../../lib/recurring/processRecurringSchedule";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Optional: simple auth token check for cron
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const { data: schedules, error } = await supabaseAdmin
      .from("recurring_invoices")
      .select("*")
      .eq("active", true)
      .lte("next_run_date", today);

    if (error) {
      console.error("Error fetching due schedules:", error);
      return res.status(500).json({ error: "Failed to fetch due schedules" });
    }

    for (const schedule of schedules || []) {
      try {
        await processRecurringSchedule(schedule);
      } catch (err) {
        console.error("Error processing schedule", schedule.id, err);
      }
    }

    return res.status(200).json({ processed: (schedules || []).length });
  } catch (err) {
    console.error("Unexpected cron error:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
