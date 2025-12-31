// pages/api/invoices/bulk-update.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

type BulkAction = "send" | "mark_paid" | "cancel";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorised" });

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = session.user.id as string;
  const { invoiceIds, action } = req.body as {
    invoiceIds: string[];
    action: BulkAction;
  };

  if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
    return res.status(400).json({ error: "No invoices selected" });
  }

  if (!["send", "mark_paid", "cancel"].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }

  try {
    // Fetch invoices to ensure ownership + current state
    const { data: invoices, error: invError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .in("id", invoiceIds)
      .eq("user_id", userId);

    if (invError) {
      console.error(invError);
      return res.status(500).json({ error: "Failed to fetch invoices" });
    }

    if (!invoices || invoices.length === 0) {
      return res.status(404).json({ error: "No invoices found" });
    }

    const results: {
      id: string;
      success: boolean;
      message?: string;
    }[] = [];

    // Process each invoice
    for (const inv of invoices) {
      try {
        if (action === "cancel") {
          const { error } = await supabaseAdmin
            .from("invoices")
            .update({
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", inv.id)
            .eq("user_id", userId);

          if (error) throw error;

          results.push({ id: inv.id, success: true });
        }

        if (action === "mark_paid") {
          const { error } = await supabaseAdmin
            .from("invoices")
            .update({
              status: "paid",
              payment_status: "paid",
              updated_at: new Date().toISOString(),
            })
            .eq("id", inv.id)
            .eq("user_id", userId);

          if (error) throw error;

          results.push({ id: inv.id, success: true });
        }

        if (action === "send") {
          // Reuse existing send endpoint logic via RPC-style call
          // or inline minimal behaviour: mark as sent + updated_at
          const { error } = await supabaseAdmin
            .from("invoices")
            .update({
              status: "sent",
              updated_at: new Date().toISOString(),
            })
            .eq("id", inv.id)
            .eq("user_id", userId);

          if (error) throw error;

          results.push({ id: inv.id, success: true });
        }
      } catch (err: any) {
        console.error(`Bulk action failed for invoice ${inv.id}`, err);
        results.push({
          id: inv.id,
          success: false,
          message: err?.message || "Failed to apply action",
        });
      }
    }

    return res.status(200).json({ results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}
