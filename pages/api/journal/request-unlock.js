// pages/api/journal/request-unlock.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { sendEmail } from "../../../lib/email";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  const role = (session.user.role || "").toUpperCase();

  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId) return res.status(400).json({ error: "Invalid client ID" });

  const { periodStart, periodEnd, reason } = req.body || {};
  if (!periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing period range" });
  }

  try {
    const accountantId = session.user.id;

    // 1) Check global trust
    const { data: globalTrust, error: globalTrustErr } = await supabaseAdmin
      .from("accountant_unlock_trust")
      .select("id, global_trusted")
      .eq("accountant_id", accountantId)
      .is("client_id", null)
      .eq("global_trusted", true)
      .maybeSingle();

    if (globalTrustErr) {
      console.error("Global trust lookup error:", globalTrustErr);
    }

    // 2) Check per-client trust
    const { data: clientTrust, error: clientTrustErr } = await supabaseAdmin
      .from("accountant_unlock_trust")
      .select("id, trusted")
      .eq("accountant_id", accountantId)
      .eq("client_id", clientId)
      .eq("trusted", true)
      .maybeSingle();

    if (clientTrustErr) {
      console.error("Client trust lookup error:", clientTrustErr);
    }

    const isTrusted =
      (globalTrust && globalTrust.global_trusted) ||
      (clientTrust && clientTrust.trusted);

    let status = "pending";

    // 3) Insert unlock request
    const { data: reqRow, error: insertErr } = await supabaseAdmin
      .from("journal_unlock_requests")
      .insert([
        {
          client_id: clientId,
          period_start: periodStart,
          period_end: periodEnd,
          requested_by: accountantId,
          reason: reason || null,
          status: isTrusted ? "auto_approved" : "pending",
        },
      ])
      .select("*")
      .single();

    if (insertErr) throw insertErr;

    status = reqRow.status;

    // 4) If trusted → auto-approve: delete lock + mark reviewed
    if (isTrusted) {
      const { error: deleteErr } = await supabaseAdmin
        .from("journal_period_locks")
        .delete()
        .eq("client_id", clientId)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd);

      if (deleteErr) {
        console.error("Auto-approve delete error:", deleteErr);
      }

      const { error: updateReqErr } = await supabaseAdmin
        .from("journal_unlock_requests")
        .update({
          reviewed_by: accountantId, // system uses requester as reviewer for auto
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", reqRow.id);

      if (updateReqErr) {
        console.error("Auto-approve request update error:", updateReqErr);
      }
    }

    // 5) Notify admins by email
    const { data: admins, error: adminsErr } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("role", "admin");

    if (!adminsErr && admins && admins.length > 0) {
      const adminEmails = admins.map((a) => a.email).filter(Boolean);

      const subjectBase = `Unlock Request: ${periodStart} → ${periodEnd}`;
      const subject = isTrusted
        ? `[AUTO-APPROVED] ${subjectBase}`
        : subjectBase;

      const html = `
        <p>An unlock request has been submitted.</p>
        <p><strong>Client ID:</strong> ${clientId}</p>
        <p><strong>Period:</strong> ${periodStart} → ${periodEnd}</p>
        <p><strong>Requested by:</strong> ${session.user.email}</p>
        <p><strong>Status:</strong> ${status}</p>
        ${
          reason
            ? `<p><strong>Reason:</strong> ${reason}</p>`
            : "<p><strong>Reason:</strong> (none provided)</p>"
        }
        <p>You can review unlock requests in the admin dashboard.</p>
      `;

      await sendEmail({
        to: adminEmails.join(","),
        subject,
        html,
        text: `Unlock request for ${periodStart} → ${periodEnd} (status: ${status}).`,
      });
    }

    // 6) Notify accountant if auto-approved
    if (isTrusted) {
      await sendEmail({
        to: session.user.email,
        subject: `Unlock Auto-Approved: ${periodStart} → ${periodEnd}`,
        html: `
          <p>Your unlock request has been <strong>auto-approved</strong> as a trusted accountant.</p>
          <p><strong>Period:</strong> ${periodStart} → ${periodEnd}</p>
        `,
        text: `Your unlock request for ${periodStart} → ${periodEnd} was auto-approved.`,
      });
    }

    return res.status(200).json({
      requested: true,
      autoApproved: isTrusted,
      status,
      message: isTrusted
        ? "Unlock auto-approved for this period."
        : "Unlock requested and pending admin review.",
    });
  } catch (err) {
    console.error("Request unlock error:", err);
    return res.status(500).json({ error: "Failed to request unlock" });
  }
}
