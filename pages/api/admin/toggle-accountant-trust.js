// pages/api/admin/toggle-accountant-trust.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  if (session.user.role !== "admin") {
    return res.status(403).json({ error: "Admins only" });
  }

  const { accountantId, clientId, global } = req.body || {};

  if (!accountantId) {
    return res.status(400).json({ error: "Missing accountantId" });
  }

  try {
    if (global === true) {
      // GLOBAL TRUST
      const { data: existing } = await supabaseAdmin
        .from("accountant_unlock_trust")
        .select("*")
        .eq("accountant_id", accountantId)
        .is("client_id", null)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from("accountant_unlock_trust")
          .update({ global_trusted: !existing.global_trusted })
          .eq("id", existing.id);

        return res.status(200).json({
          global_trusted: !existing.global_trusted,
        });
      }

      // Create new global trust row
      await supabaseAdmin
        .from("accountant_unlock_trust")
        .insert([
          {
            accountant_id: accountantId,
            client_id: null,
            global_trusted: true,
            trusted: false,
          },
        ]);

      return res.status(200).json({ global_trusted: true });
    }

    // PER-CLIENT TRUST
    if (!clientId) {
      return res.status(400).json({ error: "Missing clientId for per-client trust" });
    }

    const { data: existing } = await supabaseAdmin
      .from("accountant_unlock_trust")
      .select("*")
      .eq("accountant_id", accountantId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("accountant_unlock_trust")
        .update({ trusted: !existing.trusted })
        .eq("id", existing.id);

      return res.status(200).json({
        trusted: !existing.trusted,
      });
    }

    // Create new per-client trust row
    await supabaseAdmin
      .from("accountant_unlock_trust")
      .insert([
        {
          accountant_id: accountantId,
          client_id: clientId,
          trusted: true,
          global_trusted: false,
        },
      ]);

    return res.status(200).json({ trusted: true });
  } catch (err) {
    console.error("Toggle trust error:", err);
    return res.status(500).json({ error: "Failed to toggle trust" });
  }
}
