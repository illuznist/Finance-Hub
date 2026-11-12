import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { equalBytes } from "@noble/ciphers/utils.js";
import {
  createPasswordVerifier,
  verifyPasswordVerifier,
  utf8,
  type RandomBytes,
} from "./crypto.ts";
import type { JournalStorage } from "./restoreJournal.ts";

export const LEGACY_PIN_STORAGE_KEY = "@finance_pin_v1";
export const LEGACY_PIN_SECURE_KEY = "finance_pin_secure_v1";
export const PIN_VERIFIER_KEY = "finance_pin_verifier_v2";
export const PIN_ATTEMPTS_KEY = "finance_pin_attempts_v1";
export const ACCOUNT_CREDENTIALS_KEY = "finance_creds_v1";
export const ACCOUNT_SESSION_KEY = "finance_session_v1";
export const BIOMETRIC_PREF_KEY = "finance_biometric_v1";
export const FINANCE_STATE_STORAGE_KEY = "@finance_state_v4";
export const PIN_LENGTH = 4;

export type PinVerification = {
  ok: boolean;
  retryAfterMs?: number;
  warning?: string;
};

export type PinVerifierRecord = {
  version: 1;
  algorithm: "PBKDF2-HMAC-SHA256";
  iterations: number;
  salt: string;
  verifier: string;
};

type LegacyPinRecord = {
  pinEnabled?: boolean;
  pin?: string;
  autoLockMinutes?: number;
};

type PinAttempts = { failures: number; lockedUntil: number };

export const randomBytes: RandomBytes = (length) => Crypto.getRandomBytesAsync(length);

export async function readSecret(key: string): Promise<string | null> {
  return Platform.OS === "web" ? globalThis.localStorage.getItem(key) : SecureStore.getItemAsync(key);
}

export async function writeSecret(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") globalThis.localStorage.setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}

export async function deleteSecret(key: string): Promise<void> {
  if (Platform.OS === "web") globalThis.localStorage.removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}

export async function savePinVerifier(pin: string): Promise<void> {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) throw new Error(`Enter a ${PIN_LENGTH}-digit PIN.`);
  const verifier = await createPasswordVerifier(pin, randomBytes);
  await writeSecret(PIN_VERIFIER_KEY, JSON.stringify({ version: 1, ...verifier }));
  await deleteSecret(PIN_ATTEMPTS_KEY);
  await removeLegacyPinRecords();
}

export async function clearPinVerifier(): Promise<void> {
  await deleteSecret(PIN_VERIFIER_KEY);
  await deleteSecret(PIN_ATTEMPTS_KEY);
  await removeLegacyPinRecords();
}

export async function verifyStoredPin(pin: string): Promise<PinVerification> {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) return { ok: false };
  const attempts = await readAttempts();
  const now = Date.now();
  if (attempts.lockedUntil > now) return { ok: false, retryAfterMs: attempts.lockedUntil - now };

  let verifierRaw: string | null = null;
  let secureReadFailed = false;
  try {
    verifierRaw = await readSecret(PIN_VERIFIER_KEY);
  } catch {
    secureReadFailed = true;
  }
  let matches = false;
  let legacyRecord: LegacyPinRecord | null = null;
  if (verifierRaw) {
    let verifier: PinVerifierRecord;
    try {
      verifier = parseVerifier(verifierRaw);
    } catch {
      throw new Error("PIN protection data is unreadable. Use account-password recovery; your finance data is unchanged.");
    }
    matches = await verifyPasswordVerifier(pin, verifier);
  } else {
    legacyRecord = await readLegacyPinRecord();
    if (legacyRecord?.pin) {
      matches = equalBytes(utf8(pin), utf8(legacyRecord.pin));
    } else {
      throw new Error(secureReadFailed
        ? "Secure PIN data could not be read. Retry or use account-password recovery; your finance data is unchanged."
        : "PIN protection data is unavailable. Use account-password recovery; your finance data is unchanged.");
    }
  }

  if (!matches) {
    const failures = attempts.failures + 1;
    const retryAfterMs = pinDelayMs(failures);
    await writeSecret(PIN_ATTEMPTS_KEY, JSON.stringify({ failures, lockedUntil: now + retryAfterMs } satisfies PinAttempts));
    return { ok: false, retryAfterMs };
  }

  await deleteSecret(PIN_ATTEMPTS_KEY);
  if (legacyRecord) {
    try {
      await savePinVerifier(pin);
      return { ok: true };
    } catch {
      return {
        ok: true,
        warning: "PIN verified. Secure storage could not finish upgrading the old PIN, so the app kept its existing lock data for retry.",
      };
    }
  }
  return { ok: true };
}

export function pinDelayMs(failureCount: number): number {
  const exponent = Math.max(0, Math.min(5, Math.floor(failureCount) - 1));
  return Math.min(30_000, 1_000 * 2 ** exponent);
}

/**
 * Upgrade old plaintext PIN records before finance migration removes the raw
 * field. If secure storage is temporarily unavailable, preserve a retriable
 * legacy record rather than weakening the lock or discarding the only copy.
 */
export async function migrateLegacyPinBeforeFinanceLoad(
  storage: JournalStorage,
): Promise<void> {
  const financeRaw = await storage.getItem(FINANCE_STATE_STORAGE_KEY);
  let financeRecord: LegacyPinRecord | null = null;
  if (financeRaw) {
    try {
      const parsed = JSON.parse(financeRaw) as { securitySettings?: unknown };
      financeRecord = parseLegacyObject(parsed.securitySettings);
    } catch {
      // The normal finance migration reports malformed documents without writing.
      financeRecord = null;
    }
  }

  const [secureRaw, asyncRaw, existingVerifier] = await Promise.all([
    readSecret(LEGACY_PIN_SECURE_KEY).catch(() => null),
    storage.getItem(LEGACY_PIN_STORAGE_KEY),
    readSecret(PIN_VERIFIER_KEY).catch(() => null),
  ]);
  const candidates = [
    parseLegacyPinRecord(secureRaw),
    parseLegacyPinRecord(asyncRaw),
    financeRecord,
  ].filter((record): record is LegacyPinRecord => record !== null);

  if (existingVerifier) {
    try {
      parseVerifier(existingVerifier);
      await removeLegacyPinRecords(storage);
      return;
    } catch {
      // Rebuild a malformed verifier from the old PIN when a recoverable copy exists.
    }
  }

  const enabled = candidates.some(record => record.pinEnabled === true);
  const pins = [...new Set(candidates.map(record => record.pin).filter((pin): pin is string => typeof pin === "string" && /^\d{4}$/.test(pin)))];
  if (pins.length > 1) {
    throw new Error("Older PIN records do not agree. Your saved finance data is unchanged; retry or contact support.");
  }
  if (!enabled || pins.length === 0) return;

  const legacy = candidates.find(record => record.pin === pins[0]);
  try {
    const verifier = await createPasswordVerifier(pins[0], randomBytes);
    await writeSecret(PIN_VERIFIER_KEY, JSON.stringify({ version: 1, ...verifier }));
    await removeLegacyPinRecords(storage);
  } catch {
    if (!asyncRaw) {
      await storage.setItem(LEGACY_PIN_STORAGE_KEY, JSON.stringify({
        pinEnabled: true,
        pin: pins[0],
        autoLockMinutes: legacy?.autoLockMinutes ?? financeRecord?.autoLockMinutes ?? 5,
      }));
    }
  }
}

export async function verifyCurrentAccountPassword(
  password: string,
  credentialsRaw: string | null,
  verify: (password: string, credentials: unknown) => Promise<boolean>,
): Promise<boolean> {
  if (!credentialsRaw) return false;
  let credentials: unknown;
  try {
    credentials = JSON.parse(credentialsRaw);
  } catch {
    throw new Error("Account credentials could not be read. Your finance records are unchanged.");
  }
  return verify(password, credentials);
}

export async function createProtectedRestoreJournal(
  storage: JournalStorage,
  currentFinanceJson: string | null,
): Promise<void> {
  const { createRestoreJournal } = await import("./restoreJournal.ts");
  await createRestoreJournal(storage, {
    get: readSecret,
    set: writeSecret,
    remove: deleteSecret,
  }, currentFinanceJson, randomBytes);
}

export async function recoverProtectedRestoreJournal(
  storage: JournalStorage,
): Promise<"none" | "rolled-back" | "committed"> {
  const { recoverInterruptedRestore } = await import("./restoreJournal.ts");
  return recoverInterruptedRestore(storage, {
    get: readSecret,
    set: writeSecret,
    remove: deleteSecret,
  });
}

export async function commitProtectedRestoreJournal(storage: JournalStorage): Promise<void> {
  const { commitRestoreJournal } = await import("./restoreJournal.ts");
  await commitRestoreJournal(storage);
}

export async function clearProtectedRestoreJournal(storage: JournalStorage): Promise<void> {
  const { clearRestoreJournal } = await import("./restoreJournal.ts");
  await clearRestoreJournal(storage, {
    get: readSecret,
    set: writeSecret,
    remove: deleteSecret,
  });
}

export const financeStorageAdapter: JournalStorage = {
  getItem: key => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: key => AsyncStorage.removeItem(key),
};

async function readAttempts(): Promise<PinAttempts> {
  const raw = await readSecret(PIN_ATTEMPTS_KEY);
  if (!raw) return { failures: 0, lockedUntil: 0 };
  try {
    const value = JSON.parse(raw) as Partial<PinAttempts>;
    if (!Number.isSafeInteger(value.failures) || Number(value.failures) < 0 || !Number.isFinite(value.lockedUntil)) {
      throw new Error();
    }
    return { failures: Number(value.failures), lockedUntil: Number(value.lockedUntil) };
  } catch {
    throw new Error("PIN retry protection could not be read. Retry before unlocking.");
  }
}

async function readLegacyPinRecord(): Promise<LegacyPinRecord | null> {
  const [secureRaw, asyncRaw] = await Promise.all([
    readSecret(LEGACY_PIN_SECURE_KEY).catch(() => null),
    AsyncStorage.getItem(LEGACY_PIN_STORAGE_KEY),
  ]);
  const records = [parseLegacyPinRecord(secureRaw), parseLegacyPinRecord(asyncRaw)]
    .filter((record): record is LegacyPinRecord => record !== null && record.pinEnabled === true && typeof record.pin === "string");
  const pins = [...new Set(records.map(record => record.pin))];
  if (pins.length > 1) throw new Error("PIN protection records conflict. Use account-password recovery.");
  return records[0] ?? null;
}

async function removeLegacyPinRecords(storage: JournalStorage = financeStorageAdapter): Promise<void> {
  await Promise.all([
    storage.removeItem(LEGACY_PIN_STORAGE_KEY),
    deleteSecret(LEGACY_PIN_SECURE_KEY),
  ]);
}

function parseLegacyPinRecord(raw: string | null): LegacyPinRecord | null {
  if (!raw) return null;
  try {
    return parseLegacyObject(JSON.parse(raw));
  } catch {
    return null;
  }
}

function parseLegacyObject(value: unknown): LegacyPinRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return {
    pinEnabled: record.pinEnabled === true,
    pin: typeof record.pin === "string" ? record.pin : undefined,
    autoLockMinutes: Number.isInteger(record.autoLockMinutes) ? Number(record.autoLockMinutes) : undefined,
  };
}

function parseVerifier(raw: string): PinVerifierRecord {
  const value = JSON.parse(raw) as Partial<PinVerifierRecord>;
  if (
    value.version !== 1 ||
    value.algorithm !== "PBKDF2-HMAC-SHA256" ||
    !Number.isInteger(value.iterations) ||
    Number(value.iterations) < 100_000 ||
    Number(value.iterations) > 2_000_000 ||
    typeof value.salt !== "string" ||
    typeof value.verifier !== "string"
  ) {
    throw new Error("Invalid verifier");
  }
  return value as PinVerifierRecord;
}
