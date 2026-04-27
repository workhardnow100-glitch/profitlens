// pages/api/accounts/load.js

import { supabase } from "../../../lib/supabase-client";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { clientId, periodStart, periodEnd, framework } = req.body;

    if (!clientId || !periodStart || !periodEnd || !framework) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // ⭐ Load latest version for this client + period + framework
    const { data, error } = await supabase
      .from("accounts_versions")
      .select("*")
      .eq("client_id", clientId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .eq("framework", framework)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Supabase load error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load accounts version",
      });
    }

    if (!data) {
      // No version exists yet
      return res.status(200).json({
        success: true,
        version: null,
      });
    }

    // ⭐ Return the version exactly as UI expects
    const version = {
      versionId: data.id,
      versionNumber: data.version_number,
      createdAt: data.created_at,
      isFinal: data.is_final,
      policies: data.policies || {},
      pandl: data.pandl || null,
      directorsReport: data.directors_report || null,
      notes: data.notes || [],
      approval: data.approval || {},
    };

    return res.status(200).json({
      success: true,
      version,
    });
  } catch (err) {
    console.error("Unhandled load error:", err);
    return res.status(500).json({
      success: false,
      message: "Unexpected server error",
    });
  }
}
