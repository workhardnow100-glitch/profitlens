// lib/rbac.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "../pages/api/auth/[...nextauth]";

export type Role = "FOUNDER" | "ACCOUNTANT" | "ADMIN" | "USER";

type GuardResult =
  | {
      ok: true;
      userId: string;
      role: Role;
      clientId: string | null;
      actingAsClientId: string | null;
      accessibleClients: string[]; // ⭐ Added
    }
  | { ok: false };

export async function requireRole(
  req: NextApiRequest,
  res: NextApiResponse,
  allowedRoles: Role[]
): Promise<GuardResult> {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user || !session.user.id) {
    res.status(401).json({ error: "Unauthenticated" });
    return { ok: false };
  }

  const role = (session.user.role || "USER").toUpperCase() as Role;

  if (!allowedRoles.includes(role)) {
    res.status(403).json({ error: "Forbidden" });
    return { ok: false };
  }

  return {
    ok: true,
    userId: session.user.id as string,
    role,
    clientId: (session.user as any).clientId ?? null,
    actingAsClientId: (session.user as any).actingAsClientId ?? null,
    accessibleClients: (session.user as any).accessibleClients ?? [], // ⭐ Added
  };
}

