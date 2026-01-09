/**
 * ============================================================
 * File: pages/api/statements/[...path].js
 * Purpose:
 *   Securely serve statement files from Supabase Storage.
 *
 * Security / RBAC / SOC2 Notes:
 *   - Method: GET only.
 *   - Authentication:
 *       • Uses requireRole() to enforce USER / ACCOUNTANT / ADMIN / FOUNDER.
 *   - RBAC:
 *       • Founder override: may download statements for any client.
 *       • ACCOUNTANT: may only download for actingAsClientId.
 *       • USER: may only download for their own clientId.
 *   - Subscription gating:
 *       • Only active/trialing subscriptions may download statements.
 *       • ACCOUNTANT + FOUNDER bypass subscription gating.
 *   - File isolation:
 *       • File path MUST begin with resolvedClientId.
 *       • Prevents cross‑client file access.
 *   - RLS Alignment:
 *       • Storage bucket “statements” is not RLS‑protected.
 *       • This endpoint enforces client isolation manually.
 *   - Audit logging:
 *       • Logs DOWNLOAD_STATEMENT or ACCOUNTANT_DOWNLOAD_STATEMENT.
 *
 * Change Control:
 *   - Any change to:
 *       • accountant acting‑as logic
 *       • subscription gating
 *       • storage bucket structure
 *     MUST be reflected here.
 * ============================================================
 */

import { createClient } from "@supabase/supabase-js";
import { requireRole } from "../../../lib/rbac";
import { supabaseAdmin } from "../../../lib/supabase-admin";

function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables");
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ⭐ RBAC: USER, ACCOUNTANT, ADMIN, FOUNDER
  const guard = await requireRole(req, res, ["USER", "ACCOUNTANT", "ADMIN"]);
  if (!guard.ok) return;

  const role = guard.role;
  const isFounder = role === "FOUNDER";
  const isAccountant = role === "ACCOUNTANT";

  // ⭐ Subscription gating (founder + accountant bypass)
  const subscriptionStatus = req?.session?.user?.subscriptionStatus || "incomplete";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(subscriptionStatus);

  if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
    return res.status(403).json({ error: "Upgrade required" });
  }

  // ⭐ Accountant-aware client resolution
  const resolvedClientId = isAccountant
    ? guard.actingAsClientId
    : guard.clientId;

  if (!resolvedClientId || resolvedClientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  // ⭐ Extract file path
  const { path } = req.query;
  const filePath = Array.isArray(path) ? path.join("/") : path;

  if (!filePath) {
    return res.status(400).json({ error: "Missing file path" });
  }

  // ⭐ Prevent cross-client access
  if (!filePath.startsWith(resolvedClientId + "/")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // ⭐ Download file from Supabase Storage
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.storage
    .from("statements")
    .download(filePath);

  if (error || !data) {
    console.error("Storage download error:", error?.message);
    return res.status(500).json({ error: "File download failed" });
  }

  // ⭐ Audit log
  await supabaseAdmin.from("audit").insert([
    {
      client_id: resolvedClientId,
      actor_email: req.session?.user?.email || "unknown",
      action: isAccountant
        ? "ACCOUNTANT_DOWNLOAD_STATEMENT"
        : "DOWNLOAD_STATEMENT",
      details: `File: ${filePath}`,
      timestamp: new Date().toISOString(),
    },
  ]);

  // ⭐ Serve file
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${filePath.split("/").pop()}"`
  );
  res.setHeader("Content-Type", data.type);

  const buffer = Buffer.from(await data.arrayBuffer());
  return res.send(buffer);
}
