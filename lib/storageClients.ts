import { createClient } from '@supabase/supabase-js';

// Lazy-initialize Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase environment variables are missing.");
  }

  return createClient(url, key);
}

// Upload function
export async function uploadStatement(file, user) {
  const supabase = getSupabaseClient();

  const filePath = `${user.id}/${Date.now()}-${file.name}`;

  const { data, error } = await supabase.storage
    .from('statements')
    .upload(filePath, file);

  if (error) {
    console.error("Upload failed:", error.message);
    throw error;
  }

  return data; // returns file info
}

// List files
export async function listStatements(user) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.storage
    .from('statements')
    .list(user.id);

  if (error) throw error;
  return data;
}

// Get public URL (if you want a signed URL for download)
export async function getStatementUrl(path) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.storage
    .from('statements')
    .createSignedUrl(path, 60 * 60); // 1 hour expiry

  if (error) throw error;
  return data.signedUrl;
}
