// pages/api/payments/webhook-status.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorised" });
  }

  try {
    // 🔹 OPTIONAL: If you have a webhook_logs table, load real data
    const { data: logs, error } = await supabaseAdmin
      .from("webhook_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("webhook-status error:", error);
    }

    // 🔹 If table doesn't exist yet, return mock values
    const lastEventAt = logs?.find((l: any) => l.status === "success")?.created_at || null;
    const lastErrorAt = logs?.find((l: any) => l.status === "error")?.created_at || null;
    const errorCount = logs?.filter((l: any) => l.status === "error").length || 0;

    return res.status(200).json({
      lastEventAt,
      lastErrorAt,
      errorCount,
    });
  } catch (err: any) {
    console.error("WEBHOOK STATUS ERROR:", err);
    return res.status(200).json({
      lastEventAt: null,
      lastErrorAt: null,
      errorCount: 0,
    });
  }
}
