// pages/api/mtd/cis/receipt.js
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

  const { submissionId } = req.body || {};

  if (!submissionId)
    return res.status(400).json({ error: "Missing submissionId" });

  try {
    const mtd = await createClient(clientId);

    // ⭐ Fetch CIS receipt from HMRC
    const receipt = await mtd.getCISReceipt(submissionId);

    return res.status(200).json({
      success: true,
      receipt
    });

  } catch (err) {
    console.error("CIS MTD receipt error:", err);
    return res.status(500).json({ error: err.message });
  }
}
