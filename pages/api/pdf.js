// pages/api/pdf.js
// PURPOSE:
//   Generate various PDF types (VAT, CT600, Profile, Reports).
//
// POSITION IN PIPELINE:
//   • This endpoint orchestrates PDF generation.
//   • It does NOT calculate money, VAT, totals, or invoice amounts.
//   • All monetary logic lives inside the individual PDF templates.
//
// MONEY MODEL:
//   • No monetary fields are read or written here.
//   • No pence/pounds conversions.
//   • Safe and correct.

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
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const role = (session.user.role || "").toUpperCase();
    const isFounder = role === "ADMIN" || role === "FOUNDER";
    const isAccountant = role === "ACCOUNTANT";
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
      session.user.subscriptionStatus
    );

    if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
      return res.status(403).json({ error: "Upgrade required" });
    }

    const {
      type,
      clientId: rawClientId,
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

    const clientId = isAccountant
      ? session.user.actingAsClientId
      : session.user.clientId || session.user.defaultClientId;

    if (!type) {
      return res.status(400).json({ error: "Missing PDF type" });
    }

    if (!clientId || clientId === "unknown-client") {
      return res.status(400).json({ error: "Invalid client ID" });
    }

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

    const baseFilename =
      filename ||
      `${type}-${clientId}-${
        year || periodStart || new Date().toISOString().slice(0, 10)
      }.pdf`;

    const createdBy = session.user.email || null;

    await supabaseAdmin.from("audit").insert([
      {
        client_id: clientId,
        actor_email: session.user.email,
        action: isAccountant ? "ACCOUNTANT_GENERATE_PDF" : "GENERATE_PDF",
        details: `Generated PDF type=${type}, filename=${baseFilename}, period=${periodStart || ""}→${periodEnd || ""}`,
        timestamp: new Date().toISOString(),
      },
    ]);

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
