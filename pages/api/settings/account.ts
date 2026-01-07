// pages/api/settings/account.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { requireRole } from "../../../lib/rbac";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // RBAC: founder, admin, accountant
  const guard = await requireRole(req, res, ["USER", "ADMIN", "ACCOUNTANT", "FOUNDER"]);

  if (!guard.ok) return;

  const { clientId, role, accessibleClients } = guard;

  // Founders can update ANY client
  // Admins can update ONLY their own client
  // Accountants can update ONLY assigned clients
  const targetClientId = req.body.id;

  const isAllowed =
    role === "FOUNDER" ||
    targetClientId === clientId ||
    accessibleClients.includes(targetClientId);

  if (!isAllowed) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const updateFields = { ...req.body };
  delete updateFields.id;

  const { error } = await supabaseAdmin
    .from("clients")
    .update(updateFields)
    .eq("id", targetClientId);

  if (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to update client" });
  }

  return res.status(200).json({ success: true });
}
