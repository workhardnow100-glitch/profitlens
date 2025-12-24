// pages/api/pdf.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

import { generateVatPdf } from "../../lib/pdf/templates/vat";
import { generateProfilePdf } from "../../lib/pdf/templates/profile";
import { generateCt600Pdf } from "../../lib/pdf/templates/ct600";
// import others as you create them:
// import { generateSaPdf } from "../../lib/pdf/templates/sa";
// import { generateCisPdf } from "../../lib/pdf/templates/cis";
// import { generateReportsPdf } from "../../lib/pdf/templates/reports";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // 🔵 FULL PAYLOAD (Profile now sends everything)
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

      // Profile (NEW FULL PAYLOAD)
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

      // Shared
      companyDetails,
      year,
      taxYear,
      filename,
    } = req.body || {};

    const clientId =
      rawClientId || session.user.actingAsClientId || session.user.clientId;

    if (!type) {
      return res.status(400).json({ error: "Missing PDF type" });
    }

    if (!clientId || clientId === "unknown-client") {
      return res.status(400).json({ error: "Invalid client ID" });
    }

    const baseFilename =
      filename ||
      `${type}-${clientId}-${year || periodStart || new Date().toISOString().slice(0, 10)}.pdf`;

    const createdBy = session.user.email || null;

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
        // 🔵 SEND FULL PROFILE PAYLOAD TO THE TEMPLATE
        record = await generateProfilePdf({
          clientId,
          filename: baseFilename,
          createdBy,

          // full-page mirror data
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

      // case "sa":
      //   record = await generateSaPdf(...);
      //   break;

      // case "cis":
      //   record = await generateCisPdf(...);
      //   break;

      // case "reports":
      //   record = await generateReportsPdf(...);
      //   break;

      default:
        return res.status(400).json({ error: `Unsupported PDF type: ${type}` });
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

