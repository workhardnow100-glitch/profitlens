import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET or HEAD for a health check
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Optional: session check (keeps ping consistent with platform security)
  const session = await getServerSession(req, res, authOptions);

  // If no session, still return ok=true — this endpoint is a health check.
  // But we include a flag so founders can see if the user is authenticated.
  const isAuthenticated = Boolean(session?.user);

  return res.status(200).json({
    ok: true,
    authenticated: isAuthenticated,
    time: new Date().toISOString(),
  });
}
