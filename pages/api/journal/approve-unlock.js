// pages/api/journal/approve-unlock.js
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

  const isAdmin = session.user.role === "admin";
  if (!isAdmin) {
    return res.status(403).json({ error: "Only admins can approve unlocks" });
  }

  const { requestId, action } = req.body || {};
  if (!requestId || !["approve", "reject"].includes(action)) {
    return res
      .status(400)
      .json({ error: "Missing request ID or invalid action" });
  }

  try {
    const { data: reqRow, error: reqErr } = await supabaseAdmin
      .from("journal_unlock_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (reqErr || !reqRow) {
      return res.status(404).json({ error: "Unlock request not found" });
    }

    if (reqRow.status !== "pending") {
      return res.status(400).json({ error: "Request already processed" });
    }

    let newStatus = action === "approve" ? "approved" : "rejected";

    if (action === "approve") {
      const { error: deleteErr } = await supabaseAdmin
        .from("journal_period_locks")
        .delete()
        .eq("client_id", reqRow.client_id)
        .eq("period_start", reqRow.period_start)
        .eq("period_end", reqRow.period_end);

      if (deleteErr) {
        console.error("Approve unlock delete error:", deleteErr);
        return res.status(500).json({ error: "Failed to unlock period" });
      }
    }

    const { error: updateReqErr } = await supabaseAdmin
      .from("journal_unlock_requests")
      .update({
        status: newStatus,
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (updateReqErr) throw updateReqErr;

    // Fetch accountant email
    const { data: accountantProfile, error: acctErr } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", reqRow.requested_by)
      .maybeSingle();

    const accountantEmail = accountantProfile?.email;

    // Notify accountant
    if (accountantEmail) {
      const subject =
        newStatus === "approved"
          ? `Unlock Approved: ${reqRow.period_start} → ${reqRow.period_end}`
          : `Unlock Rejected: ${reqRow.period_start} → ${reqRow.period_end}`;

      const html =
        newStatus === "approved"
          ? `
        <p>Your unlock request has been <strong>approved</strong>.</p>
        <p><strong>Period:</strong> ${reqRow.period_start} → ${reqRow.period_end}</p>
      `
          : `
        <p>Your unlock request has been <strong>rejected</strong>.</p>
        <p><strong>Period:</strong> ${reqRow.period_start} → ${reqRow.period_end}</p>
        ${
          reqRow.reason
            ? `<p><strong>Original reason:</strong> ${reqRow.reason}</p>`
            : ""
        }
      `;

      await sendEmail({
        to: accountantEmail,
        subject,
        html,
        text: `Your unlock request for ${reqRow.period_start} → ${reqRow.period_end} was ${newStatus}.`,
      });
    }

    // Notify admins (optional, but keeps everyone in the loop)
    const { data: admins, error: adminsErr } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("role", "admin");

    if (!adminsErr && admins && admins.length > 0) {
      const adminEmails = admins.map((a) => a.email).filter(Boolean);

      await sendEmail({
        to: adminEmails.join(","),
        subject: `Unlock ${newStatus.toUpperCase()}: ${reqRow.period_start} → ${reqRow.period_end}`,
        html: `
          <p>An unlock request has been <strong>${newStatus}</strong> by ${session.user.email}.</p>
          <p><strong>Period:</strong> ${reqRow.period_start} → ${reqRow.period_end}</p>
        `,
        text: `Unlock request for ${reqRow.period_start} → ${reqRow.period_end} was ${newStatus}.`,
      });
    }

    return res.status(200).json({ status: newStatus });
  } catch (err) {
    console.error("Approve unlock error:", err);
    return res.status(500).json({ error: "Failed to process unlock request" });
  }
}
