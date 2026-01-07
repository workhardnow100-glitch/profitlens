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

  const role = session.user.role;
  const isFounder = role === "admin";
  const isUser = role === "user";

  // Only founders and users can create clients — NOT accountants
  if (!(isFounder || isUser)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  // Subscription check (trial allowed)
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    session.user.subscriptionStatus
  );

  if (!(isFounder || isSubscribedOrTrial)) {
    return res.status(403).json({ message: "Upgrade required" });
  }

  const { name } = req.body;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ message: "Invalid client name" });
  }

  try {
    // Check for existing client *owned by this user*
    const { data: existing } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("name", name)
      .eq("owner_id", session.user.id)
      .single();

    if (existing) {
      return res.status(409).json({ message: "Client already exists" });
    }

    // Create new client
    const { data: client, error: insertError } = await supabaseAdmin
      .from("clients")
      .insert([
        {
          name,
          owner_id: session.user.id,
        },
      ])
      .select("*")
      .single();

    if (insertError) throw insertError;

    // Link user to client
    await supabaseAdmin.from("user_clients").insert([
      {
        user_id: session.user.id,
        client_id: client.id,
        role: "owner",
      },
    ]);

    // Audit log
    await supabaseAdmin.from("audit").insert([
      {
        client_id: client.id,
        actor_email: session.user.email,
        action: "CREATE_CLIENT",
        details: `Created client "${name}"`,
        timestamp: new Date().toISOString(),
      },
    ]);

    return res.status(200).json({
      message: `Client "${name}" added successfully`,
      client,
    });
  } catch (err) {
    console.error("Client creation error:", err.message);
    return res.status(500).json({ message: "Failed to add client" });
  }
}
