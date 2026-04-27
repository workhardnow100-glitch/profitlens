// pages/api/accounts/create-version.js

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

    // ⭐ 1) Get latest version number
    const { data: latest, error: latestErr } = await supabase
      .from("accounts_versions")
      .select("version_number")
      .eq("client_id", clientId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .eq("framework", framework)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestErr) {
      console.error("Supabase version lookup error:", latestErr);
      return res.status(500).json({
        success: false,
        message: "Failed to check existing versions",
      });
    }

    const nextVersionNumber = latest?.version_number
      ? latest.version_number + 1
      : 1;

    // ⭐ 2) Insert new version
    const { data: inserted, error: insertErr } = await supabase
      .from("accounts_versions")
      .insert([
        {
          client_id: clientId,
          period_start: periodStart,
          period_end: periodEnd,
          framework,
          version_number: nextVersionNumber,
          is_final: false,
          policies: {},
          pandl: null,
          directors_report: null,
          notes: [],
          approval: {},
        },
      ])
      .select()
      .single();

    if (insertErr) {
      console.error("Supabase insert error:", insertErr);
      return res.status(500).json({
        success: false,
        message: "Failed to create accounts version",
      });
    }

    return res.status(200).json({
      success: true,
      versionId: inserted.id,
      versionNumber: inserted.version_number,
      createdAt: inserted.created_at,
      isFinal: inserted.is_final,
    });
  } catch (err) {
    console.error("Unhandled create-version error:", err);
    return res.status(500).json({
      success: false,
      message: "Unexpected server error",
    });
  }
}
