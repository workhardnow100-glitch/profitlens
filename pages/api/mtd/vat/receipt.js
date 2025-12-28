// pages/api/mtd/vat/receipt.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import PDFDocument from "pdfkit";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ⭐ SESSION REQUIRED
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const role = (session.user.role || "").toUpperCase();

  const isFounder = session.user.role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Resolve clientId safely
  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId) {
    return res.status(400).json({ error: "No client selected" });
  }

  const { periodStart, periodEnd } = req.body;

  if (!periodStart || !periodEnd) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // ⭐ AUDIT LOG — Accountant downloading VAT receipt
    if (role === "ACCOUNTANT") {
      await supabaseAdmin.from("audit").insert([
        {
          client_id: clientId,
          actor_email: session.user.email,
          action: "ACCOUNTANT_DOWNLOAD_VAT_RECEIPT",
          details: `Downloaded VAT receipt for ${periodStart} → ${periodEnd}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    }

    // ⭐ Fetch the MTD submission record
    const { data: submission, error } = await supabaseAdmin
      .from("vat_mtd_submissions")
      .select("*")
      .eq("client_id", clientId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (!submission) {
      return res.status(404).json({
        error: "No HMRC submission found for this VAT period",
      });
    }

    // ⭐ Create PDF
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="VAT-Receipt-${periodStart}-to-${periodEnd}.pdf"`
    );

    doc.pipe(res);

    // Header
    doc
      .fontSize(20)
      .text("HMRC VAT Submission Receipt", { align: "center" })
      .moveDown(1);

    // Period
    doc
      .fontSize(12)
      .text(`Client ID: ${clientId}`)
      .text(`VAT Period: ${periodStart} → ${periodEnd}`)
      .moveDown(1);

    // Submission details
    doc
      .fontSize(14)
      .text("Submission Details", { underline: true })
      .moveDown(0.5);

    doc
      .fontSize(12)
      .text(`HMRC Reference: ${submission.hmrc_reference || "N/A"}`)
      .text(`Processing Date: ${submission.updated_at || "N/A"}`)
      .text(`Status: ${submission.status || "submitted"}`)
      .moveDown(1);

    // Raw HMRC response (pretty JSON)
    doc
      .fontSize(14)
      .text("HMRC Response Payload", { underline: true })
      .moveDown(0.5);

    doc
      .fontSize(10)
      .text(JSON.stringify(submission.hmrc_response || {}, null, 2), {
        width: 500,
      });

    // Footer
    doc
      .moveDown(2)
      .fontSize(10)
      .text(
        "This receipt confirms that your VAT return was successfully submitted to HMRC via Making Tax Digital.",
        { align: "center" }
      );

    doc.end();
  } catch (err) {
    console.error("Receipt generation error:", err);
    return res.status(500).json({ error: err.message });
  }
}

