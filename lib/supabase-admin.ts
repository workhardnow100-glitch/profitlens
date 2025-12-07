import { createClient } from '@supabase/supabase-js';

// ✅ TEMP DEBUG LOGS
console.log("🛠️ Supabase Admin URL:", process.env.SUPABASE_URL);
console.log("🛠️ Supabase Service Role Key:", process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server-side environment.");
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
