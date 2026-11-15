import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null | undefined;

export function isSupabaseSecretKey(value: string | undefined): value is string {
  const prefix = "sb_secret_";
  return Boolean(value?.startsWith(prefix) && value.length > prefix.length);
}

export function createSupabaseAdminClient(
  url: string | undefined,
  secretKey: string | undefined,
): SupabaseClient | null {
  if (!url || !isSupabaseSecretKey(secretKey)) return null;

  try {
    return createClient(url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  } catch {
    return null;
  }
}

/**
 * Supabase sb_secret keys map to the privileged service_role and bypass RLS.
 * Keep this client in the API server and use it only after server-side identity
 * and authorization checks.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient;
  const url = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  adminClient = createSupabaseAdminClient(url, secretKey);
  return adminClient;
}

export function resetSupabaseAdminClientForTests(): void {
  adminClient = undefined;
}
