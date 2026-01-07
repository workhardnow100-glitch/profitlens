// pages/api/pdf.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

import { generateVatPdf } from "../../lib/pdf/templates/vat";
import { generateProfilePdf } from "../../lib/pdf/templates/profile";
import { generateCt600Pdf } from "../../lib/pdf/templates/ct600";
import { generateReportsPdf } from "../../lib/pdf/templates/reports";
// import { generateSaPdf } from "../../lib/pdf/templates/sa";
// import { generateCisPdf } from "../../lib/pdf/templates/cis";
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

    // 🔵 FULL PAYLOAD (Profile + Reports + VAT + CT600)
    const {
      type,
      clientId: rawClientId,

      // VAT
      periodStart,
      periodEnd,
      vatBoxes,
      totals,

      // CT600
      ctSummary,

      // Profile
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

      // Reports
      selectedCategory,
      selectedClient,
      filteredReports,
      transactions,

      // Shared
      companyDetails,
      year,
      taxYear,
      filename,
    } = req.body || {};

    // ✅ Accountant-aware client resolution — ignore rawClientId for security
    const clientId = isAccountant
      ? session.user.actingAsClientId
      : session.user.clientId || session.user.defaultClientId;

    if (!type) {
      return res.status(400).json({ error: "Missing PDF type" });
    }

    if (!clientId || clientId === "unknown-client") {
      return res.status(400).json({ error: "Invalid client ID" });
    }

    // ✅ Minimal per-type validation
    if (type === "vat") {
      if (!periodStart || !periodEnd || !vatBoxes) {
        return res.status(400).json({
          error: "Missing VAT period or vatBoxes for VAT PDF",
        });
      }
    }

    if (type === "ct600") {
      if (!ctSummary || !companyDetails) {
        return res.status(400).json({
          error: "Missing ctSummary or companyDetails for CT600 PDF",
        });
      }
    }

    if (type === "reports") {
      if (!filteredReports || !transactions) {
        return res.status(400).json({
          error: "Missing filteredReports or transactions for reports PDF",
        });
      }
    }

    if (type === "profile") {
      if (!client || !yearSummary) {
        return res.status(400).json({
          error: "Missing client or yearSummary for profile PDF",
        });
      }
    }

    const baseFilename =
      filename ||
      `${type}-${clientId}-${
        year || periodStart || new Date().toISOString().slice(0, 10)
      }.pdf`;

    const createdBy = session.user.email || null;

    // ✅ Audit log — PDF generation
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

      // case "sa":
      //   record = await generateSaPdf(...);
      //   break;

      // case "cis":
      //   record = await generateCisPdf(...);
      //   break;

      default:
        return res
          .status(400)
          .json({ error: `Unsupported PDF type: ${type}` });
    }

    return res.status(200).json({
      success: true,
      pdf: record,
    });
  } catch (err) {
    console.error("❌ PDF API error:", err);
    return res.status(500).json({ error: "Failed to generate PDF" });
  }
}
