// pages/api/journal/unlock-period.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  // ⭐ FIX: normalize role to lowercase (matches useUser)
  const role = (session.user.role || "").toLowerCase();

  const isFounder = role === "founder";
  const isAdmin = role === "admin";
  const isAccountant = role === "accountant";

  // ⭐ FIX: trusted accountant override
  const trustStatus = session.user.trustStatus || "none";
  const isTrustedAccountant =
    isAccountant && (trustStatus === "global" || trustStatus === "client");

  const isOverride = isFounder || isAdmin || isTrustedAccountant;

  // ⭐ FIX: allow founder + admin + trusted accountant
  if (!isOverride) {
    return res.status(403).json({ error: "Only admins can unlock periods" });
  }

  // ⭐ FIX: accountant scoping
  let clientId = null;
  if (role === "accountant") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId) return res.status(400).json({ error: "Invalid client ID" });

  const { periodStart, periodEnd } = req.body || {};
  if (!periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing period range" });
  }

  try {
    // Check if locked
    const { data: existing, error: lookupErr } = await supabaseAdmin
      .from("journal_period_locks")
      .select("id")
      .eq("client_id", clientId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    if (lookupErr) {
      console.error("Unlock lookup error:", lookupErr);
      return res.status(500).json({ error: "Failed to check lock status" });
    }

    if (!existing) {
      return res.status(400).json({
        error: "This period is not locked",
      });
    }

    // Delete lock record
    const { error: deleteErr } = await supabaseAdmin
      .from("journal_period_locks")
      .delete()
      .eq("client_id", clientId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd);

    if (deleteErr) {
      console.error("Unlock delete error:", deleteErr);
      return res.status(500).json({ error: "Failed to unlock period" });
    }

    // Audit log
    try {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "JOURNAL_PERIOD_UNLOCK",
          details: `Unlocked journal period ${periodStart} → ${periodEnd}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (auditErr) {
      console.error("Audit log error (unlock period):", auditErr);
    }

    return res.status(200).json({
      unlocked: true,
      periodStart,
      periodEnd,
      message: "Period unlocked",
    });
  } catch (err) {
    console.error("Unlock period error:", err);
    return res.status(500).json({ error: "Failed to unlock period" });
  }
}
