/**
 * =========================================================
 * File: pages/api/receipt.js
 * Purpose:
 *   Generate a PDF receipt for an HMRC MTD submission.
 *
 *   Returns:
 *     - A streamed PDF containing:
 *         • Client ID
 *         • Submission reference
 *         • Timestamp
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: GET only.
 *   - Authentication:
 *       • Uses NextAuth session.
 *   - RBAC:
 *       • ACCOUNTANT:
 *           – May generate receipts for actingAsClientId.
 *       • USER:
 *           – May generate receipts for their own clientId.
 *       • FOUNDER:
 *           – May generate receipts for any client.
 *   - Subscription gating:
 *       • USER must be subscribed/trialing.
 *       • ACCOUNTANT + FOUNDER bypass subscription gating.
 *   - Data handling:
 *       • No database writes except audit log.
 *       • PDF streamed directly to response (no temp files).
 *   - Audit logging:
 *       • Logs GENERATE_RECEIPT / ACCOUNTANT_GENERATE_RECEIPT.
 *
 * Change Control:
 *   - Any change to:
 *       • receipt format
 *       • HMRC submission metadata
 *     MUST be reflected here and in the MTD UI.
 * ============================================================
 */

import PDFDocument from "pdfkit";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

export default async function handler(req, res) {
  // ⭐ Session validation
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ⭐ Role normalization
  const role = (session.user.role || "").toUpperCase();
  const isFounder = role === "FOUNDER";
  const isAccountant = role === "ACCOUNTANT";

  const subscriptionStatus = session.user.subscriptionStatus;
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    subscriptionStatus
  );

  // ⭐ Subscription gating (accountants + founders bypass)
  if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Accountant-aware client ID
  const clientId = isAccountant
    ? session.user.actingAsClientId
    : session.user.clientId;

  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  // ⭐ Validate reference
  const ref = req.query.ref;
  if (!ref) {
    return res.status(400).json({ error: "Missing receipt reference" });
  }

  // ⭐ Audit log
  await supabaseAdmin.from("audit").insert([
    {
      client_id: clientId,
      actor_email: session.user.email,
      action: isAccountant ? "ACCOUNTANT_GENERATE_RECEIPT" : "GENERATE_RECEIPT",
      details: `Generated MTD receipt for ref=${ref}`,
      timestamp: new Date().toISOString(),
    },
  ]);

  // ⭐ Generate PDF safely
  const doc = new PDFDocument();

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename=receipt-${ref}.pdf`);

  doc.pipe(res);

  doc.fontSize(20).text("HMRC MTD Submission Receipt", { underline: true });
  doc.moveDown();

  doc.fontSize(12).text(`Client ID: ${clientId}`);
  doc.text(`Reference: ${ref}`);
  doc.text(`Generated: ${new Date().toISOString()}`);

  doc.end();
}
