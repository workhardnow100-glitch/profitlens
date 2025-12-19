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
    clientId,
    subscriptionStatus,
    accessibleClients,
    actingAsClientId,
  } = session.user;

  // ✅ Only accountants and admins should ever call this endpoint
  if (role !== "accountant" && role !== "admin") {
    return res.status(403).json({
      error: "Only accountants can access accountant context",
    });
  }

  // ✅ Ensure accessibleClients is always an array
  const safeAccessibleClients = Array.isArray(accessibleClients)
    ? accessibleClients
    : [];

  // ✅ Ensure actingAsClientId is either null or a string
  const safeActingAs = actingAsClientId || null;

  return res.status(200).json({
    success: true,
    user: {
      id,
      email,
      role,
      clientId,
      subscriptionStatus,
      accessibleClients: safeAccessibleClients,
      actingAsClientId: safeActingAs,
    },
  });
}
