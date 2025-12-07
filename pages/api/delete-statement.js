// pages/api/delete-statements.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";
import { supabaseAdmin } from "../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const isFounder = session.user.role === "admin";
  const isSubscribed = ["basic", "pro"].includes(session.user.subscriptionStatus);

  if (!(isFounder || isSubscribed)) {
    return res.status(403).json({ message: "Upgrade required" });
  }

  const clientId = session.user.clientId;
  if (!clientId || clientId === "unknown-client") {
    return res.status(400).json({ message: "Invalid client ID" });
  }

  try {
    const { uploadId } = req.body;
    let deletedCount;

    if (uploadId) {
      const { count, error } = await supabaseAdmin
        .from("statements")
        .delete({ count: "exact" })
        .match({ client_id: clientId, source: uploadId });

      if (error) throw error;
      deletedCount = count;
    } else {
      const { count, error } = await supabaseAdmin
        .from("statements")
        .delete({ count: "exact" })
        .eq("client_id", clientId);

      if (error) throw error;
      deletedCount = count;
    }

    // ✅ Audit log
    await supabaseAdmin.from("audit").insert([{
      client_id: clientId,
      user: session.user.email,
      action: "DELETE_STATEMENTS",
      details: uploadId
        ? `Deleted statements from upload ${uploadId}`
        : "Deleted all statements for client",
      timestamp: new Date().toISOString(),
    }]);

    res.status(200).json({
      deleted: deletedCount,
      message: uploadId
        ? `Deleted ${deletedCount} statements from upload ${uploadId}`
        : `Deleted ${deletedCount} statements for client`,
    });
  } catch (err) {
    console.error("❌ Delete error:", err.message);
    res.status(500).json({ message: "Failed to delete statements" });
  }
}
