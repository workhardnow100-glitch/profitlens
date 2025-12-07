// pages/api/clients/create.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "POST") {
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

  const { name } = req.body;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ message: "Invalid client name" });
  }

  try {
    // ✅ Check for existing client by name
    const { data: existing, error: findError } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("name", name)
      .single();

    if (existing) {
      return res.status(409).json({ message: "Client already exists" });
    }

    // ✅ Create new client
    const { data: client, error: insertError } = await supabaseAdmin
      .from("clients")
      .insert([{ name }])
      .select("*")
      .single();

    if (insertError) throw insertError;

    // ✅ Link user to client in join table
    await supabaseAdmin.from("user_clients").insert([{
      user_id: session.user.id,
      client_id: client.id,
      role: "owner",
    }]);

    // ✅ Audit log
    await supabaseAdmin.from("audit").insert([{
      client_id: client.id,
      user: session.user.email,
      action: "CREATE_CLIENT",
      details: `Created client "${name}"`,
      timestamp: new Date().toISOString(),
    }]);

    res.status(200).json({ message: `Client "${name}" added successfully`, client });
  } catch (err) {
    console.error("Client creation error:", err.message);
    res.status(500).json({ message: "Failed to add client" });
  }
}
