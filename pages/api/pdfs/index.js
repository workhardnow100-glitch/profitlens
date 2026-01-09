// pages/api/pdfs/index.js
// PURPOSE:
//   List all PDF documents the authenticated user is allowed to see.
//
// POSITION IN PIPELINE:
//   • Purely metadata listing.
//   • Does NOT touch money, invoice totals, VAT, or Stripe.
//   • Safe from all monetary drift.
//
// MONEY MODEL:
//   • No monetary fields are read or written.
//   • No pence/pounds conversions.
//   • No risk of affecting invoice totals.

import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]";
import { supabaseAdmin } from "../../../lib/supabase-admin";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const user = session.user;
  const role = (user.role || "").toUpperCase();
  const isFounder = role === "ADMIN" || role === "FOUNDER";
  const isAccountant = role === "ACCOUNTANT";
  const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
    user.subscriptionStatus
  );

  // Subscription gating (accountants + founders bypass)
  if (!isFounder && !isAccountant && !isSubscribedOrTrial) {
    return res.status(403).json({ error: "Subscription required" });
  }

  // Accountant-aware client ID
  const clientId = isAccountant
    ? user.actingAsClientId
    : user.clientId || user.defaultClientId;

  if (!clientId) {
    return res.status(400).json({ error: "No client selected" });
  }

  // Audit log — viewing PDFs
  await supabaseAdmin.from("audit").insert([
    {
      client_id: clientId,
      actor_email: user.email,
      action: isAccountant ? "ACCOUNTANT_VIEW_PDFS" : "VIEW_PDFS",
      details: "Viewed PDF document list",
      timestamp: new Date().toISOString(),
    },
  ]);

  let query = supabaseAdmin.from("pdf_documents").select("*");

  //
  // ACCESS LOGIC
  //
  if (isFounder) {
    query = query.order("created_at", { ascending: false });
  } else if (isAccountant) {
    query = query
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
  } else {
    query = query
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching pdf_documents:", error);
    return res.status(500).json({ error: "Failed to fetch PDFs" });
  }

  return res.status(200).json({ pdfs: data || [] });
}
