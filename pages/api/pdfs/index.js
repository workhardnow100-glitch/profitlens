// pages/api/pdfs/index.js
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 🔐 Get session
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const user = session.user;
  const userId = user.id;
  const role = user.role;
  const subscription = user.subscriptionStatus;

  // 🔑 Subscription access control
  const isAdmin = role === "admin";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(subscription);

  if (!(isAdmin || isSubscribedOrTrial)) {
    return res.status(403).json({ error: "Subscription required" });
  }

  let query = supabaseAdmin.from("pdf_documents").select("*");

  //
  // ────────────────────────────────────────────────
  // ACCESS LOGIC
  // ────────────────────────────────────────────────
  //

  if (isAdmin) {
    // Admin sees everything
    query = query.order("created_at", { ascending: false });
  } else if (role === "accountant") {
    // Accountant sees PDFs for all clients they manage
    const { data: clientLinks, error: linkErr } = await supabaseAdmin
      .from("user_clients")
      .select("client_id")
      .eq("user_id", userId);

    if (linkErr) {
      console.error("Error fetching user_clients:", linkErr);
      return res.status(500).json({ error: "Failed to fetch accountant clients" });
    }

    const clientIds = clientLinks.map((c) => c.client_id);

    if (clientIds.length === 0) {
      return res.status(200).json({ pdfs: [] });
    }

    query = query
      .in("client_id", clientIds)
      .order("created_at", { ascending: false });
  } else {
    // Normal user → only their own PDFs
    query = query
      .eq("created_by", userId)
      .order("created_at", { ascending: false });
  }

  //
  // ────────────────────────────────────────────────
  // EXECUTE QUERY
  // ────────────────────────────────────────────────
  //
  const { data, error } = await query;

  if (error) {
    console.error("Error fetching pdf_documents:", error);
    return res.status(500).json({ error: "Failed to fetch PDFs" });
  }

  return res.status(200).json({ pdfs: data || [] });
}
