import { supabaseAdmin } from "../../lib/supabase-admin";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).end();

  const { clientId, nino } = req.body;

  const valid =
    /^[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]$/i.test(nino || "") &&
    !nino.startsWith("ZZ");

  await supabaseAdmin
    .from("clients")
    .update({ nino, cis_registered: valid })
    .eq("id", clientId)
    .eq("user_id", session.user.id);

  res.json({ registered: valid });
}
