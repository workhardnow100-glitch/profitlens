import { getServerSession } from "next-auth/next";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import type { NextApiRequest, NextApiResponse } from "next";

export async function getClientFromSession(
  req?: NextApiRequest,
  res?: NextApiResponse
): Promise<string> {
  const session = req && res
    ? await getServerSession(req, res, authOptions)
    : await getServerSession(authOptions);

  const rawClientId =
    (session as any)?.user?.clientId ?? (session as any)?.clientId;

  if (!rawClientId || typeof rawClientId !== "string") {
    throw new Error("Missing or invalid clientId in session");
  }

  return rawClientId;
}
