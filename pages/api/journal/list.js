// pages/api/journal/lock-period.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

function getMonthRange(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();

  const start = new Date(year, month, 1).toISOString().slice(0, 10);
  const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);

  return { start, end };
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const role = (session.user.role || "").toUpperCase();
  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId) return res.status(400).json({ error: "Invalid client ID" });

  const { periodStart, periodEnd, periods, note } = req.body || {};
  let ranges = [];

  if (Array.isArray(periods) && periods.length > 0) {
    ranges = periods
      .map((p) => ({
        start: p.periodStart,
        end: p.periodEnd,
      }))
      .filter((p) => p.start && p.end);
  } else {
    let start = periodStart;
    let end = periodEnd;

    if (!start || !end) {
      const r = getMonthRange();
      start = r.start;
      end = r.end;
    }
    ranges = [{ start, end }];
  }

  if (ranges.length === 0) {
    return res.status(400).json({ error: "No valid periods provided" });
  }

  try {
    for (const r of ranges) {
      const { data: existing } = await supabaseAdmin
        .from("journal_period_locks")
        .select("id")
        .eq("client_id", clientId)
        .eq("period_start", r.start)
        .eq("period_end", r.end)
        .maybeSingle();

      if (existing) {
        continue;
      }

      const { error: insertErr } = await supabaseAdmin
        .from("journal_period_locks")
        .insert([
          {
            client_id: clientId,
            period_start: r.start,
            period_end: r.end,
            locked_by: session.user.id,
            note: note || null,
          },
        ]);

      if (insertErr) throw insertErr;

      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action:
            role === "ACCOUNTANT"
              ? "ACCOUNTANT_JOURNAL_PERIOD_LOCK"
              : "JOURNAL_PERIOD_LOCK",
          details: `Locked journal period ${r.start} → ${r.end}${
            note ? ` (note: ${note})` : ""
          }`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    return res.status(200).json({
      locked: true,
      message: "Periods locked",
    });
  } catch (err) {
    console.error("Lock period error:", err);
    return res.status(500).json({ error: "Failed to lock period" });
  }
}
