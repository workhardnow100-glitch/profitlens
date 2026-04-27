// pages/api/accounts/save.js

import { supabase } from "../../../lib/supabase-client";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const {
      versionId,
      policies,
      pandl,
      directorsReport,
      notes,
      approval,
    } = req.body;

    if (!versionId) {
      return res.status(400).json({
        success: false,
        message: "Missing versionId",
      });
    }

    // ⭐ Build update payload
    const updatePayload = {
      policies: policies || {},
      pandl: pandl || null,
      directors_report: directorsReport || null,
      notes: notes || [],
      approval: approval || {},
      updated_at: new Date().toISOString(),
    };

    // ⭐ Update the version row
    const { error } = await supabase
      .from("accounts_versions")
      .update(updatePayload)
      .eq("id", versionId);

    if (error) {
      console.error("Supabase save error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to save accounts version",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Version saved",
    });
  } catch (err) {
    console.error("Unhandled save error:", err);
    return res.status(500).json({
      success: false,
      message: "Unexpected server error",
    });
  }
}
