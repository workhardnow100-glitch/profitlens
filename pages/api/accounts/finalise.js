// pages/api/accounts/finalise.js

import { supabase } from "../../../lib/supabase-client";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const { versionId } = req.body;

    if (!versionId) {
      return res.status(400).json({
        success: false,
        message: "Missing versionId",
      });
    }

    // ⭐ Mark version as final
    const { error } = await supabase
      .from("accounts_versions")
      .update({
        is_final: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", versionId);

    if (error) {
      console.error("Supabase finalise error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to finalise accounts version",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Version finalised",
    });
  } catch (err) {
    console.error("Unhandled finalise error:", err);
    return res.status(500).json({
      success: false,
      message: "Unexpected server error",
    });
  }
}
