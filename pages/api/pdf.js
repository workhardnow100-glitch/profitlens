/**
 * ============================================================
 * File: pages/api/pdf.js
 * Purpose:
 *   Generate HMRC‑style PDFs for:
 *     - VAT returns
 *     - CT600 summaries
 *     - Profile summaries
 *     - Reports exports
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: POST only.
 *   - Authentication:
 *       • Uses NextAuth session.
 *   - RBAC:
 *       • ACCOUNTANT:
 *           – May generate PDFs for actingAsClientId.
 *       • USER:
 *           – May generate PDFs for their own clientId.
 *       • FOUNDER:
 *           – May generate PDFs for any client.
 *   - Subscription gating:
 *       • USER must be subscribed/trialing.
 *       • ACCOUNTANT + FOUNDER bypass subscription gating.
 *   - Anti‑spoofing:
 *       • Ignores clientId from body; uses session‑resolved clientId only.
 *   - Data handling:
 *       • This endpoint does NOT calculate money.
 *       • All monetary logic lives inside the PDF templates.
 *   - Audit logging:
 *       • Logs GENERATE_PDF / ACCOUNTANT_GENERATE_PDF.
 *
 * Change Control:
 *   - Any change to PDF templates or report structures
 *     MUST be reflected here and in the PDF UI.
 * ============================================================
 */

import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

import { generateVatPdf } from "../../lib/pdf/templates/vat";
import { generateProfilePdf } from "../../lib/pdf/templates/profile";
import { generateCt600Pdf } from "../../lib/pdf/templates/ct600";
import { generateReportsPdf } from "../../lib/pdf/templates/reports";
import { supabaseAdmin } from "../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
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

    // ⭐ Accountant-aware client ID (ignore rawClientId)
    const clientId = isAccountant
      ? session.user.actingAsClientId
      : session.user.clientId || session.user.defaultClientId;

    if (!clientId || clientId === "unknown-client") {
      return res.status(400).json({ error: "Invalid client ID" });
    }

    // ⭐ Extract fields
    const {
      type,
      periodStart,
      periodEnd,
      vatBoxes,
      totals,
      ctSummary,
      client,
      account,
      selectedYear,
      expenseView,
      yearSummary,
      hmrcBreakdown,
      incomeByCategory,
      expensesByCategory,
      filteredTransactions,
      filteredByMonth,
      selectedCategory,
      selectedClient,
      filteredReports,
      transactions,
      companyDetails,
      year,
      taxYear,
      filename,
    } = req.body || {};

    if (!type) {
      return res.status(400).json({ error: "Missing PDF type" });
    }

    // ⭐ Type-specific validation
    if (type === "vat" && (!periodStart || !periodEnd || !vatBoxes)) {
      return res.status(400).json({ error: "Missing VAT fields" });
    }

    if (type === "ct600" && (!ctSummary || !companyDetails)) {
      return res.status(400).json({ error: "Missing CT600 fields" });
    }

    if (type === "reports" && (!filteredReports || !transactions)) {
      return res.status(400).json({ error: "Missing reports fields" });
    }

    if (type === "profile" && (!client || !yearSummary)) {
      return res.status(400).json({ error: "Missing profile fields" });
    }

    // ⭐ Filename
    const baseFilename =
      filename ||
      `${type}-${clientId}-${
        year || periodStart || new Date().toISOString().slice(0, 10)
      }.pdf`;

    const createdBy = session.user.email || null;

    // ⭐ Audit log
    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: session.user.email,
        action: isAccountant ? "ACCOUNTANT_GENERATE_PDF" : "GENERATE_PDF",
        details: `Generated PDF type=${type}, filename=${baseFilename}, period=${periodStart || ""}→${periodEnd || ""}`,
        timestamp: new Date().toISOString(),
      },
    ]);

    // ⭐ Dispatch to correct PDF generator
    let record;

    switch (type) {
      case "vat":
        record = await generateVatPdf({
          clientId,
          periodStart,
          periodEnd,
          year,
          taxYear,
          filename: baseFilename,
          createdBy,
          vatBoxes,
          totals,
          companyDetails,
        });
        break;

      case "profile":
        record = await generateProfilePdf({
          clientId,
          filename: baseFilename,
          createdBy,
          client,
          account,
          selectedYear,
          expenseView,
          yearSummary,
          hmrcBreakdown,
          incomeByCategory,
          expensesByCategory,
          filteredTransactions,
          filteredByMonth,
        });
        break;

      case "ct600":
        record = await generateCt600Pdf({
          clientId,
          year,
          filename: baseFilename,
          createdBy,
          companyDetails,
          ctSummary,
        });
        break;

      case "reports":
        record = await generateReportsPdf({
          clientId,
          filename: baseFilename,
          createdBy,
          selectedCategory,
          selectedClient,
          filteredReports,
          transactions,
        });
        break;

      default:
        return res.status(400).json({ error: `Unsupported PDF type: ${type}` });
    }

    return res.status(200).json({ success: true, pdf: record });
  } catch (err) {
    console.error("❌ PDF API error:", err);
    return res.status(500).json({ error: "Failed to generate PDF" });
  }
}
