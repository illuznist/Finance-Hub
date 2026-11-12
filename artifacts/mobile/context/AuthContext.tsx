import * as LocalAuthentication from "expo-local-authentication";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import {
  ACCOUNT_CREDENTIALS_KEY,
  ACCOUNT_SESSION_KEY,
  BIOMETRIC_PREF_KEY,
  clearPinVerifier,
  randomBytes,
  readSecret,
  savePinVerifier,
  verifyStoredPin,
  writeSecret,
  deleteSecret,
  type PinVerification,
} from "@/security/deviceSecurity";
import {
  createCredentialVerifier,
  legacyPasswordDigest,
  verifyCredentialVerifier,
  type CredentialVerifier,
} from "@/security/credentials";

export interface StoredCredentials {
  name: string;
  email: string;
  passwordHash?: string;
  passwordVerifier?: CredentialVerifier;
}

export type BiometricType = "face" | "fingerprint" | "none";

interface AuthContextType {
  isLoading: boolean;
  authError: string | null;
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
  verifyPin: (pin: string) => Promise<PinVerification>;
  savePin: (pin: string) => Promise<void>;
  clearPin: () => Promise<void>;
  verifyAccountPassword: (password: string) => Promise<boolean>;
  retryAuthStorage: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasAccount, setHasAccount] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [credentials, setCredentials] = useState<StoredCredentials | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>("none");
  const [biometricEnabled, setBiometricEnabledState] = useState(false);

  const loadAuth = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      if (Platform.OS !== "web") {
        try {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          if (hasHardware && isEnrolled) {
            const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
            setBiometricAvailable(true);
            setBiometricType(
              types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
                ? "face"
                : "fingerprint",
            );
          } else {
            setBiometricAvailable(false);
            setBiometricType("none");
          }
        } catch {
          setBiometricAvailable(false);
          setBiometricType("none");
        }
      }

      const credsRaw = await readSecret(ACCOUNT_CREDENTIALS_KEY);
      if (credsRaw) {
        const stored = JSON.parse(credsRaw) as StoredCredentials;
        if (
          typeof stored.email !== "string" ||
          (!stored.passwordHash && !stored.passwordVerifier)
        ) {
          throw new Error("Account security data is invalid.");
        }
        setCredentials(stored);
        setHasAccount(true);
      } else {
        setCredentials(null);
        setHasAccount(false);
      }

      setIsLoggedIn((await readSecret(ACCOUNT_SESSION_KEY)) === "1");
      setBiometricEnabledState((await readSecret(BIOMETRIC_PREF_KEY).catch(() => null)) === "1");
    } catch {
      setAuthError("Account security data could not be read. Retry safely; existing records were not changed.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadAuth(); }, [loadAuth]);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const passwordVerifier = await createCredentialVerifier(password, randomBytes);
    const stored: StoredCredentials = {
      name,
      email: email.toLowerCase().trim(),
      passwordVerifier,
    };
    await writeSecret(ACCOUNT_CREDENTIALS_KEY, JSON.stringify(stored));
    await writeSecret(ACCOUNT_SESSION_KEY, "1");
    setCredentials(stored);
    setHasAccount(true);
    setIsLoggedIn(true);
  }, []);

  const verifyAccountPassword = useCallback(async (password: string): Promise<boolean> => {
    if (!credentials) return false;
    if (credentials.passwordVerifier) {
      return verifyCredentialVerifier(password, credentials.passwordVerifier);
    }
    if (!credentials.passwordHash) return false;
    if (legacyPasswordDigest(credentials.email, password) !== credentials.passwordHash) return false;

    // Existing accounts are upgraded after successful authentication; the
    // plaintext password is never persisted and no password reset is needed.
    const passwordVerifier = await createCredentialVerifier(password, randomBytes);
    const upgraded: StoredCredentials = {
      ...credentials,
      passwordHash: undefined,
      passwordVerifier,
    };
    await writeSecret(ACCOUNT_CREDENTIALS_KEY, JSON.stringify(upgraded));
    setCredentials(upgraded);
    return true;
  }, [credentials]);

  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (!credentials || email.toLowerCase().trim() !== credentials.email.toLowerCase().trim()) return false;
    if (!(await verifyAccountPassword(password))) return false;
    await writeSecret(ACCOUNT_SESSION_KEY, "1");
    setIsLoggedIn(true);
    return true;
  }, [credentials, verifyAccountPassword]);

  const signInWithBiometric = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "web" || !biometricAvailable || !biometricEnabled) return false;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to access FinanceApp",
        fallbackLabel: "Use PIN or password",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      if (!result.success) return false;
      await writeSecret(ACCOUNT_SESSION_KEY, "1");
      setIsLoggedIn(true);
      return true;
    } catch {
      return false;
    }
  }, [biometricAvailable, biometricEnabled]);

  const signOut = useCallback(async () => {
    await deleteSecret(ACCOUNT_SESSION_KEY);
    setIsLoggedIn(false);
  }, []);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    if (enabled && (Platform.OS === "web" || !biometricAvailable)) {
      throw new Error("Biometric authentication is unavailable on this device.");
    }
    await writeSecret(BIOMETRIC_PREF_KEY, enabled ? "1" : "0");
    setBiometricEnabledState(enabled);
  }, [biometricAvailable]);

  const verifyPin = useCallback((pin: string) => verifyStoredPin(pin), []);
  const savePin = useCallback((pin: string) => savePinVerifier(pin), []);
  const clearPin = useCallback(() => clearPinVerifier(), []);

  return (
    <AuthContext.Provider
      value={{
        isLoading,
        authError,
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
        verifyPin,
        savePin,
        clearPin,
        verifyAccountPassword,
        retryAuthStorage: () => { void loadAuth(); },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
