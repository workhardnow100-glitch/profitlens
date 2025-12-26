// pages/api/accountant/clear-client.js
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user)
    return res.status(401).json({ error: "Unauthorized" });

  const role = session.user.role;
  const accountantEmail = session.user.email;
  const accountantId = session.user.userId; // ⭐ Correct session field

  // ⭐ Allow accountant, founder, admin
  if (!["accountant", "founder", "admin"].includes(role)) {
    return res.status(403).json({
      error: "Only accountants can clear client context",
    });
  }

  try {
    // ⭐ Log the exit
    await supabaseAdmin.from("audit").insert([
      {
        client_id: null,
        actor_email: accountantEmail,
        action: "ACCOUNTANT_CLEAR_CLIENT",
        details: "Exited client context",
        timestamp: new Date().toISOString(),
      },
    ]);

    // ⭐ Clear acting client in DB
    const { error: updateErr } = await supabaseAdmin
      .from("app_users")
      .update({ acting_client_id: null })
      .eq("id", accountantId);

    if (updateErr) {
      console.error("Failed to clear acting client:", updateErr);
      return res.status(500).json({ error: "Failed to clear acting client" });
    }

    return res.status(200).json({
      success: true,
      actingAsClientId: null,
    });
  } catch (err) {
    console.error("Clear client error:", err);
    return res.status(500).json({ error: err.message });
  }
}
