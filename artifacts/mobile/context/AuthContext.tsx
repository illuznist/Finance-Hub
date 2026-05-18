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

// Pure-JS SHA-256 — no native modules, no Web Crypto API, works in all Hermes versions
function _sha256(message: string): string {
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];
  const ror = (n: number, x: number) => (x >>> n) | (x << (32 - n));
  const bytes: number[] = [];
  for (let i = 0; i < message.length; i++) {
    const c = message.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  const msgLen = bytes.length;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const bitLen = msgLen * 8;
  bytes.push(0, 0, 0, 0, (bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);
  const h = [...H];
  for (let off = 0; off < bytes.length; off += 64) {
    const w = Array(64).fill(0);
    for (let i = 0; i < 16; i++) w[i] = (bytes[off+i*4]<<24)|(bytes[off+i*4+1]<<16)|(bytes[off+i*4+2]<<8)|bytes[off+i*4+3];
    for (let i = 16; i < 64; i++) {
      const s0 = ror(7, w[i-15]) ^ ror(18, w[i-15]) ^ (w[i-15] >>> 3);
      const s1 = ror(17, w[i-2]) ^ ror(19, w[i-2]) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = ror(6, e) ^ ror(11, e) ^ ror(25, e);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = ror(2, a) ^ ror(13, a) ^ ror(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0;
      d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h[0]=(h[0]+a)|0; h[1]=(h[1]+b)|0; h[2]=(h[2]+c)|0; h[3]=(h[3]+d)|0;
    h[4]=(h[4]+e)|0; h[5]=(h[5]+f)|0; h[6]=(h[6]+g)|0; h[7]=(h[7]+hh)|0;
  }
  return h.map((x) => x.toString(16).padStart(8, "0")).join("");
}

async function hashPassword(email: string, password: string): Promise<string> {
  return _sha256(`financeapp:${email.toLowerCase().trim()}:${password}`);
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
