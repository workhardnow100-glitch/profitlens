// pages/api/invoices/next-number.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { requireRole } from "../../../lib/rbac";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // RBAC: Users, Accountants, and Founder can generate next invoice number
  const guard = await requireRole(req, res, ["FOUNDER", "ACCOUNTANT", "USER"]);
  if (!guard.ok) return;

  const { userId, role, accessibleClients } = guard;

  try {
    // -------------------------------------------------------------
    // Fetch invoice numbers with correct access control
    // -------------------------------------------------------------
    let query = supabaseAdmin
      .from("invoices")
      .select("invoice_number, user_id, client_id")
      .order("invoice_number", { ascending: false })
      .limit(50);

    if (role === "USER") {
      query = query.eq("user_id", userId);
    }

    if (role === "ACCOUNTANT") {
      query = query.in("client_id", accessibleClients);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching invoice numbers:", error);
      return res.status(500).json({ error: "Failed to fetch invoice numbers" });
    }

    const numbers = (data || [])
      .map((row) => row.invoice_number)
      .filter((n) => typeof n === "string" && n.trim() !== "");

    if (numbers.length === 0) {
      return res.status(200).json({ nextNumber: "INV-001" });
    }

    // -------------------------------------------------------------
    // Find the highest numeric tail
    // -------------------------------------------------------------
    let best = "";
    let bestNum = -1;
    let bestPadding = 0;

    for (const num of numbers) {
      const match = num.match(/^(.*?)(\d+)$/);
      if (!match) continue;

      const prefix = match[1];
      const numeric = match[2];
      const numericValue = parseInt(numeric, 10);

      if (numericValue > bestNum) {
        best = prefix;
        bestNum = numericValue;
        bestPadding = numeric.length;
      }
    }

    if (bestNum === -1) {
      return res.status(200).json({ nextNumber: "INV-001" });
    }

    const nextNum = bestNum + 1;
    const padded = String(nextNum).padStart(bestPadding, "0");
    const nextNumber = `${best}${padded}`;

    return res.status(200).json({ nextNumber });
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Unexpected server error" });
  }
}
