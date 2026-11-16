import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as Linking from "expo-linking";
import type { Session, User } from "@supabase/supabase-js";

import {
  onlineAccountConfigured,
  onlineAccountConfigurationError,
  supabaseClient,
} from "@/lib/supabase";
import type { AuthCallbackOutcome } from "@/security/emailVerificationFlow";
import { createSingleUseAuthCodeExchange } from "@/security/singleUseAuthCodeExchange";

type OnlineAccountContextValue = {
  configured: boolean;
  configurationError: string | null;
  loading: boolean;
  busy: boolean;
  user: User | null;
  isVerified: boolean;
  signUp: (email: string, password: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordRecovery: (email: string) => Promise<void>;
  completePasswordRecovery: (password: string) => Promise<void>;
  handleAuthCallback: (code: string) => Promise<AuthCallbackOutcome>;
  needsPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  setBusy: (busy: boolean) => void;
};

const OnlineAccountContext = createContext<OnlineAccountContextValue | null>(null);

function getRedirectUrl(): string {
  const configuredRedirect = process.env.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL?.trim();
  return configuredRedirect || Linking.createURL("auth/callback");
}

export function OnlineAccountProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(onlineAccountConfigured);
  const [busy, setBusy] = useState(false);
  const [needsPasswordRecovery, setNeedsPasswordRecovery] = useState(false);
  const authCodeExchange = useRef<((code: string) => Promise<AuthCallbackOutcome>) | null>(null);
  const lastAuthCallback = useRef<{ code: string; promise: Promise<AuthCallbackOutcome> } | null>(null);

  if (!authCodeExchange.current) {
    authCodeExchange.current = createSingleUseAuthCodeExchange(async (code) => {
      if (!supabaseClient) throw new Error("Online accounts are not configured.");
      const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code);
      if (error) throw error;
      setSession(data.session);
      // auth-js returns redirectType at runtime after code exchange, though
      // its current public AuthTokenResponse type omits that field.
      const redirectType = (data as typeof data & { redirectType?: string }).redirectType;
      if (redirectType === "recovery") {
        setNeedsPasswordRecovery(true);
        return "recovery";
      }
      return "confirmed";
    });
  }

  useEffect(() => {
    if (!supabaseClient) {
      setLoading(false);
      return;
    }

    let active = true;
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") setNeedsPasswordRecovery(true);
    });
    void supabaseClient.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    }).catch(() => {
      if (active) setSession(null);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabaseClient) throw new Error("Online accounts are not configured.");
    const { data, error } = await supabaseClient.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: getRedirectUrl() },
    });
    if (error) throw error;
    if (data.session) setSession(data.session);
    return Boolean(data.session);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabaseClient) throw new Error("Online accounts are not configured.");
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
    setSession(data.session);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabaseClient) return;
    const { error } = await supabaseClient.auth.signOut({ scope: "local" });
    if (error) throw error;
    setSession(null);
  }, []);

  const sendPasswordRecovery = useCallback(async (email: string) => {
    if (!supabaseClient) throw new Error("Online accounts are not configured.");
    const { error } = await supabaseClient.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: getRedirectUrl() },
    );
    if (error) throw error;
  }, []);

  const completePasswordRecovery = useCallback(async (password: string) => {
    if (!supabaseClient) throw new Error("Online accounts are not configured.");
    const { error } = await supabaseClient.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const handleAuthCallback = useCallback((code: string) => {
    if (!supabaseClient) return Promise.reject(new Error("Online accounts are not configured."));
    if (lastAuthCallback.current?.code === code) return lastAuthCallback.current.promise;
    const promise = authCodeExchange.current!(code);
    lastAuthCallback.current = { code, promise };
    return promise;
  }, []);

  const value = useMemo<OnlineAccountContextValue>(() => ({
    configured: onlineAccountConfigured,
    configurationError: onlineAccountConfigurationError,
    loading,
    busy,
    user: session?.user ?? null,
    isVerified: Boolean(session?.user.email_confirmed_at),
    needsPasswordRecovery,
    signUp,
    signIn,
    signOut,
    sendPasswordRecovery,
    completePasswordRecovery,
    handleAuthCallback,
    clearPasswordRecovery: () => setNeedsPasswordRecovery(false),
    setBusy,
  }), [
    loading,
    busy,
    session,
    needsPasswordRecovery,
    signUp,
    signIn,
    signOut,
    sendPasswordRecovery,
    completePasswordRecovery,
    handleAuthCallback,
  ]);

  return <OnlineAccountContext.Provider value={value}>{children}</OnlineAccountContext.Provider>;
}

export function useOnlineAccount(): OnlineAccountContextValue {
  const context = useContext(OnlineAccountContext);
  if (!context) throw new Error("useOnlineAccount must be used within OnlineAccountProvider");
  return context;
}
