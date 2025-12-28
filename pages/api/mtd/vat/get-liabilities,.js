// pages/api/mtd/vat/get-liabilities.js
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

  try {
    const mtd = await createClient(clientId);

    // ⭐ Fetch VAT liabilities from HMRC
    const liabilities = await mtd.getVATLiabilities();

    return res.status(200).json({
      success: true,
      liabilities
    });

  } catch (err) {
    console.error("VAT MTD get liabilities error:", err);
    return res.status(500).json({ error: err.message });
  }
}

