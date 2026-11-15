import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { createSecureSessionStorage } from "@/lib/secureSessionStorage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

export const onlineAccountConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const onlineAccountConfigurationError =
  Boolean(supabaseUrl) !== Boolean(supabaseAnonKey)
    ? "Both Supabase URL and public key are required."
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
    ? createClient(supabaseUrl, supabaseAnonKey, {
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
