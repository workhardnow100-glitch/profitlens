import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== "ACCOUNTANT") {
    return res.status(403).json({ error: "Not allowed" });
  }

  const email = session.user.email;

  if (req.method === "GET") {
    const { data } = await supabaseAdmin
      .from("accountant_profiles")
      .select("*")
      .eq("accountant_email", email)
      .maybeSingle();

    return res.status(200).json({ profile: data || null });
  }

  if (req.method === "POST") {
    const body = req.body;

    const { data, error } = await supabaseAdmin
      .from("accountant_profiles")
      .upsert(
        {
          accountant_email: email,
          ...body,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "accountant_email" }
      )
      .select()
      .single();

    if (error) return res.status(500).json({ error });

    return res.status(200).json({ profile: data });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
