import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { createSecureSessionStorage } from "@/lib/secureSessionStorage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
const hasSupabaseUrl = Boolean(supabaseUrl);
const hasSupabasePublishableKey = Boolean(supabasePublishableKey);
const publishableKeyPrefix = "sb_publishable_";
const hasValidSupabasePublishableKey =
  supabasePublishableKey.startsWith(publishableKeyPrefix) &&
  supabasePublishableKey.length > publishableKeyPrefix.length;

export const onlineAccountConfigured = Boolean(supabaseUrl && hasValidSupabasePublishableKey);
export const onlineAccountConfigurationError =
  hasSupabaseUrl !== hasSupabasePublishableKey
    ? "Both Supabase URL and publishable key are required."
    : hasSupabasePublishableKey && !hasValidSupabasePublishableKey
      ? "A Supabase publishable key using the sb_publishable_ format is required."
    : null;

const secureStorage = createSecureSessionStorage(SecureStore);

const browserSessionStorage = {
  getItem: async (key: string) =>
    typeof window === "undefined" ? null : window.sessionStorage.getItem(key),
  setItem: async (key: string, value: string) => {
    if (typeof window !== "undefined") window.sessionStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(key);
  },
};

const storage = Platform.OS === "web" ? browserSessionStorage : secureStorage;

export const supabaseClient =
  onlineAccountConfigured
    ? createClient(supabaseUrl, supabasePublishableKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
          persistSession: true,
          storage,
          storageKey: "finance-hub-online-auth",
        },
      })
    : null;

export async function getOnlineAccessToken(): Promise<string | null> {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}
