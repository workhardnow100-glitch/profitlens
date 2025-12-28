// pages/api/mtd/sa/submit-final-declaration.js
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

  const { taxYear, declarationDetails } = req.body;

  if (!taxYear)
    return res.status(400).json({ error: "Missing taxYear" });

  try {
    const mtd = await createClient(clientId);

    // ⭐ Build HMRC Final Declaration payload
    const body = {
      taxYear,
      ...declarationDetails
    };

    // ⭐ Submit Final Declaration to HMRC
    const response = await mtd.submitFinalDeclaration(body);

    return res.status(200).json({
      success: true,
      response
    });

  } catch (err) {
    console.error("SA MTD submit final declaration error:", err);
    return res.status(500).json({ error: err.message });
  }
}
