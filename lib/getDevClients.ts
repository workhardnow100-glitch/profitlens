import { getServerSession } from "next-auth/next";
import { authOptions } from "../pages/api/auth/[...nextauth]";
import { supabaseAdmin } from "../lib/supabase-admin";

export async function getClientFromSession(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const devEmail = "workhardnow100@gmail.com";

  const sessionEmail =
    process.env.NODE_ENV === "development"
      ? devEmail
      : session?.user?.email;

  if (!sessionEmail) throw new Error("No session email found");

  const { data: client, error } = await supabaseAdmin
    .from("clients")
    .select("*")
    .eq("email", sessionEmail)
    .single();

  if (error || !client) throw new Error("Client not found");
  return client;
}
