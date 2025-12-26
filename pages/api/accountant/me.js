// pages/api/accountant/me.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";

export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  const {
    id,
    email,
    role,
    actingAsClientId,
    subscriptionStatus,
  } = session.user;

  // ⭐ Allow accountant, admin, founder
  if (!["ACCOUNTANT", "ADMIN", "FOUNDER"].includes(role?.toUpperCase())) {
    return res.status(403).json({
      error: "Only accountants can access accountant context",
    });
  }

  return res.status(200).json({
    success: true,
    user: {
      id,
      email,
      role,
      subscriptionStatus: subscriptionStatus || null,
      actingAsClientId: actingAsClientId || null,
    },
  });
}
