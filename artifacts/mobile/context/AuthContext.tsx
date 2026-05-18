import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";

const CREDS_KEY = "finance_creds_v1";
const SESSION_KEY = "finance_session_v1";
export const BIOMETRIC_PREF_KEY = "finance_biometric_v1";
export const PIN_SECURE_KEY = "finance_pin_secure_v1";

export interface StoredCredentials {
  name: string;
  email: string;
  passwordHash: string;
}

export type BiometricType = "face" | "fingerprint" | "none";

interface AuthContextType {
  isLoading: boolean;
  hasAccount: boolean;
  isLoggedIn: boolean;
  userEmail: string | null;
  userName: string | null;
  biometricAvailable: boolean;
  biometricType: BiometricType;
  biometricEnabled: boolean;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signInWithBiometric: () => Promise<boolean>;
  signOut: () => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") { localStorage.setItem(key, value); return; }
  return SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === "web") { localStorage.removeItem(key); return; }
  return SecureStore.deleteItemAsync(key);
}

async function hashPassword(email: string, password: string): Promise<string> {
  const text = `financeapp:${email.toLowerCase().trim()}:${password}`;
  const encoded = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccount, setHasAccount] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [credentials, setCredentials] = useState<StoredCredentials | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>("none");
  const [biometricEnabled, setBiometricEnabledState] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        if (Platform.OS !== "web") {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHardware && isEnrolled) {
            setBiometricAvailable(true);
            const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
            if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
              setBiometricType("face");
            } else {
              setBiometricType("fingerprint");
            }
          }
        }

        const credsRaw = await secureGet(CREDS_KEY);
        if (credsRaw) {
          const creds = JSON.parse(credsRaw) as StoredCredentials;
          setCredentials(creds);
          setHasAccount(true);
        }

        const session = await secureGet(SESSION_KEY);
        if (session === "1") setIsLoggedIn(true);

        const bio = await secureGet(BIOMETRIC_PREF_KEY);
        setBiometricEnabledState(bio === "1");
      } catch {
        // keep defaults
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const passwordHash = await hashPassword(email, password);
    const creds: StoredCredentials = { name, email: email.toLowerCase().trim(), passwordHash };
    await secureSet(CREDS_KEY, JSON.stringify(creds));
    await secureSet(SESSION_KEY, "1");
    setCredentials(creds);
    setHasAccount(true);
    setIsLoggedIn(true);
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (!credentials) return false;
    const hash = await hashPassword(email, password);
    if (hash === credentials.passwordHash && email.toLowerCase().trim() === credentials.email) {
      await secureSet(SESSION_KEY, "1");
      setIsLoggedIn(true);
      return true;
    }
    return false;
  }, [credentials]);

  const signInWithBiometric = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web" || !biometricAvailable) return false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to access FinanceApp",
        fallbackLabel: "Use Password",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      if (result.success) {
        await secureSet(SESSION_KEY, "1");
        setIsLoggedIn(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [biometricAvailable]);

  const signOut = useCallback(async () => {
    await secureDelete(SESSION_KEY);
    setIsLoggedIn(false);
  }, []);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    await secureSet(BIOMETRIC_PREF_KEY, enabled ? "1" : "0");
    setBiometricEnabledState(enabled);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        hasAccount,
        isLoggedIn,
        userEmail: credentials?.email ?? null,
        userName: credentials?.name ?? null,
        biometricAvailable,
        biometricType,
        biometricEnabled,
        signUp,
        signIn,
        signInWithBiometric,
        signOut,
        setBiometricEnabled,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { secureGet, secureSet, secureDelete };
