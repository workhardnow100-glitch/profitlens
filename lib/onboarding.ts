import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function ensureClientCoa(clientId: string) {
  const { error } = await supabaseAdmin.rpc("clone_default_coa_for_client", {
    p_client_id: clientId,
  });

  if (error) {
    console.error("Failed to clone default COA for client", clientId, error);
    throw error;
  }
}
