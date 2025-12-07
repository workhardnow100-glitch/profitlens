import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const clientId = session.user.clientId;
  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ error: "Invalid client ID" });
  }

  const { path } = req.query;
  const filePath = Array.isArray(path) ? path.join("/") : path;

  // 🔒 Security check: path must start with the client_id
  if (!filePath.startsWith(clientId)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.storage.from("statements").download(filePath);

  if (error || !data) {
    console.error("Storage download error:", error?.message);
    return res.status(500).json({ error: "File download failed" });
  }

  // ✅ Audit log
  await supabaseAdmin.from("audit").insert([{
    client_id: clientId,
    user: session.user.email,
    action: "DOWNLOAD_STATEMENT",
    details: `File: ${filePath}`,
    timestamp: new Date().toISOString(),
  }]);

  res.setHeader("Content-Disposition", `inline; filename="${filePath.split("/").pop()}"`);
  res.setHeader("Content-Type", data.type);

  const buffer = Buffer.from(await data.arrayBuffer());
  res.send(buffer);
}
