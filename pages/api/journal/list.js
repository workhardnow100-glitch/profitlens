// pages/api/journal/list.js
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

function getAllMonthsForYear(year) {
  const months = [];
  for (let m = 0; m < 12; m++) {
    const start = new Date(year, m, 1).toISOString().slice(0, 10);
    const end = new Date(year, m + 1, 0).toISOString().slice(0, 10);
    const label = new Date(year, m, 1).toLocaleString("en-GB", {
      month: "long",
      year: "numeric",
    });
    months.push({ label, start, end, monthIndex: m });
  }
  return months;
}

export default async function handler(req, res) {
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

  // Determine client ID
  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId) return res.status(400).json({ error: "Invalid client ID" });

  // -------------------------------------------------------------
  // TRUST LOOKUP (for accountants only)
  // -------------------------------------------------------------
  let trustStatus = "none"; // "none" | "client" | "global"
  let pendingUnlockRequest = false;

  if (role === "ACCOUNTANT") {
    const accountantId = session.user.id;

    // 1. GLOBAL TRUST
    const { data: globalTrust } = await supabaseAdmin
      .from("accountant_unlock_trust")
      .select("id")
      .eq("accountant_id", accountantId)
      .is("client_id", null)
      .eq("global_trusted", true)
      .maybeSingle();

    if (globalTrust) {
      trustStatus = "global";
    }

    // 2. PER-CLIENT TRUST
    if (trustStatus === "none") {
      const { data: clientTrust } = await supabaseAdmin
        .from("accountant_unlock_trust")
        .select("id")
        .eq("accountant_id", accountantId)
        .eq("client_id", clientId)
        .eq("trusted", true)
        .maybeSingle();

      if (clientTrust) {
        trustStatus = "client";
      }
    }

    // 3. PENDING UNLOCK REQUEST FOR CURRENT PERIOD
    const { start: currentStart, end: currentEnd } = getMonthRange();

    const { data: pendingReq } = await supabaseAdmin
      .from("journal_unlock_requests")
      .select("id")
      .eq("client_id", clientId)
      .eq("requested_by", accountantId)
      .eq("period_start", currentStart)
      .eq("period_end", currentEnd)
      .eq("status", "pending")
      .maybeSingle();

    pendingUnlockRequest = !!pendingReq;
  }

  // -------------------------------------------------------------
  // LOAD JOURNALS
  // -------------------------------------------------------------
  const yearParam = req.query.year;
  const now = new Date();
  const currentYear = yearParam ? Number(yearParam) : now.getFullYear();

  const { data: journals, error } = await supabaseAdmin.rpc(
    "list_journals_for_client",
    { p_client_id: clientId }
  );

  if (error) {
    console.error("Journal list error:", error);
    return res.status(500).json({ error: "Failed to load journals" });
  }

  // -------------------------------------------------------------
  // CURRENT MONTH LOCK STATE
  // -------------------------------------------------------------
  const { start, end } = getMonthRange();

  const { data: lockRecord } = await supabaseAdmin
    .from("journal_period_locks")
    .select("id")
    .eq("client_id", clientId)
    .eq("period_start", start)
    .eq("period_end", end)
    .maybeSingle();

  const periodLocked = !!lockRecord;

  // -------------------------------------------------------------
  // FULL LOCK HISTORY
  // -------------------------------------------------------------
  const { data: history } = await supabaseAdmin
    .from("journal_period_locks")
    .select("period_start, period_end, locked_at, locked_by, note")
    .eq("client_id", clientId)
    .order("period_start", { ascending: false });

  // Locked months map
  const lockedMonthsMap = {};
  (history || []).forEach((h) => {
    lockedMonthsMap[`${h.period_start}_${h.period_end}`] = true;
  });

  // Month selector options
  const availableMonths = getAllMonthsForYear(currentYear);

  // Timeline
  const timeline = availableMonths.map((m) => {
    const match = (history || []).find(
      (h) => h.period_start === m.start && h.period_end === m.end
    );
    return {
      label: m.label,
      start: m.start,
      end: m.end,
      locked: !!match,
      note: match?.note || null,
    };
  });

  // -------------------------------------------------------------
  // FINAL RESPONSE
  // -------------------------------------------------------------
  return res.status(200).json({
    journals: journals || [],
    periodLocked,
    periodStart: start,
    periodEnd: end,
    history: history || [],
    availableMonths,
    lockedMonthsMap,
    year: currentYear,
    timeline,

    // NEW FIELDS FOR UI
    trustStatus,             // "none" | "client" | "global"
    pendingUnlockRequest,    // true | false
  });
}
