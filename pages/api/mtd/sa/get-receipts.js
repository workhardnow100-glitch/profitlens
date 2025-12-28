// pages/api/mtd/sa/get-receipt.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";
import { createClient } from "../../../../lib/mtd-client";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // Validate session
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  const role = (session.user.role || "").toUpperCase();

  // Determine clientId (accountant‑aware)
  let clientId = null;
  if (role === "ACCOUNTANT") {
    clientId = session.user.actingAsClientId;
  } else {
    clientId = session.user.clientId || session.user.defaultClientId;
  }

  if (!clientId)
    return res.status(400).json({ error: "No client selected" });

  const { submissionId } = req.body;

  if (!submissionId)
    return res.status(400).json({ error: "Missing submissionId" });

  try {
    const mtd = await createClient(clientId);

    // ⭐ HMRC does not provide a dedicated SA receipt endpoint.
    // Instead, we fetch the SA return details and extract the receipt info.
    const returnsData = await mtd.getSAReturns();

    const match = returnsData?.returns?.find(
      (r) => r.submissionId === submissionId
    );

    if (!match) {
      return res.status(404).json({
        error: "Receipt not found for this submissionId"
      });
    }

    return res.status(200).json({
      success: true,
      receipt: match
    });

  } catch (err) {
    console.error("SA MTD get receipt error:", err);
    return res.status(500).json({ error: err.message });
  }
}
