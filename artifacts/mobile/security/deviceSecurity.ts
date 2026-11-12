import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { equalBytes } from "@noble/ciphers/utils.js";
import {
  createPasswordVerifier,
  utf8,
  type RandomBytes,
} from "./crypto.ts";
import {
  clearPinVerifier as clearDerivedPinVerifier,
  PIN_ATTEMPTS_KEY,
  PIN_LENGTH,
  PIN_VERIFIER_KEY,
  savePinVerifier as saveDerivedPinVerifier,
  verifyPinVerifier,
  type PinVerifierRecord,
} from "./pinVerifier.ts";
import {
  ANALYTICS_BACKUP_KEY,
  COMPATIBILITY_BACKUP_KEY,
  FINANCE_STORAGE_KEY,
  LEGACY_BACKUP_KEY,
  PLANNING_BACKUP_KEY,
} from "../finance/migration.ts";
import { pinDelayMs } from "./pinPolicy.ts";
import { sanitizeLegacyFinanceSnapshot } from "./sanitizeFinanceSnapshot.ts";
import {
  RESTORE_FINANCE_DOCUMENT_KEY,
  RESTORE_THEME_PREFERENCE_KEY,
  type JournalStorage,
} from "./restoreJournal.ts";

export const LEGACY_PIN_STORAGE_KEY = "@finance_pin_v1";
export const LEGACY_PIN_SECURE_KEY = "finance_pin_secure_v1";
export const ACCOUNT_CREDENTIALS_KEY = "finance_creds_v1";
export const ACCOUNT_SESSION_KEY = "finance_session_v1";
export const BIOMETRIC_PREF_KEY = "finance_biometric_v1";
export const FINANCE_STATE_STORAGE_KEY = FINANCE_STORAGE_KEY;
const LEGACY_FINANCE_BACKUP_KEYS = [
  LEGACY_BACKUP_KEY,
  COMPATIBILITY_BACKUP_KEY,
  PLANNING_BACKUP_KEY,
  ANALYTICS_BACKUP_KEY,
];
export type PinVerification = {
  ok: boolean;
  retryAfterMs?: number;
  warning?: string;
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
  await saveDerivedPinVerifier(pin, {
    get: readSecret,
    set: writeSecret,
    remove: deleteSecret,
  }, randomBytes);
  await removeLegacyPinRecords();
}

export async function clearPinVerifier(): Promise<void> {
  await clearDerivedPinVerifier({
    get: readSecret,
    set: writeSecret,
    remove: deleteSecret,
  });
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
    try {
      matches = await verifyPinVerifier(pin, verifierRaw);
    } catch {
      throw new Error("PIN protection data is unreadable. Use account-password recovery; your finance data is unchanged.");
    }
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
        ok: false,
        warning: "Secure PIN storage could not be upgraded. The app remains locked; retry or use account-password recovery.",
      };
    }
  }
  return { ok: true };
}

/**
 * Upgrade old plaintext PIN records before finance migration removes the raw
 * field. If the verifier cannot be saved, abort migration and leave the
 * existing finance document and PIN records untouched for a safe retry.
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
  const enabled = candidates.some(record => record.pinEnabled === true);
  const pins = [...new Set(candidates.map(record => record.pin).filter((pin): pin is string => typeof pin === "string" && /^\d{4}$/.test(pin)))];

  if (existingVerifier) {
    try {
      parseVerifier(existingVerifier);
      if (!enabled) {
        await deleteSecret(PIN_VERIFIER_KEY);
        await deleteSecret(PIN_ATTEMPTS_KEY);
      }
      await removeLegacyPinRecords(storage);
      await scrubLegacyPinBackups(storage);
      return;
    } catch {
      // Rebuild a malformed verifier from the old PIN when a recoverable copy exists.
      if (!enabled) {
        await deleteSecret(PIN_VERIFIER_KEY);
        await deleteSecret(PIN_ATTEMPTS_KEY);
        await removeLegacyPinRecords(storage);
        await scrubLegacyPinBackups(storage);
        return;
      }
    }
  }

  if (pins.length > 1) {
    throw new Error("Older PIN records do not agree. Your saved finance data is unchanged; retry or contact support.");
  }
  if (!enabled) {
    await removeLegacyPinRecords(storage);
    await scrubLegacyPinBackups(storage);
    return;
  }
  if (pins.length === 0) {
    await scrubLegacyPinBackups(storage);
    return;
  }

  try {
    const verifier = await createPasswordVerifier(pins[0], randomBytes);
    await writeSecret(PIN_VERIFIER_KEY, JSON.stringify({ version: 1, ...verifier }));
  } catch {
    throw new Error("Secure PIN protection could not be upgraded. Your existing records and lock are unchanged; retry safely.");
  }
  await removeLegacyPinRecords(storage);
  await scrubLegacyPinBackups(storage);
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
  currentThemePreference: string | null,
): Promise<void> {
  const { createRestoreJournal } = await import("./restoreJournal.ts");
  await createRestoreJournal(storage, {
    get: readSecret,
    set: writeSecret,
    remove: deleteSecret,
  }, {
    [RESTORE_FINANCE_DOCUMENT_KEY]: currentFinanceJson,
    [RESTORE_THEME_PREFERENCE_KEY]: currentThemePreference,
  }, randomBytes);
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

async function scrubLegacyPinBackups(storage: JournalStorage): Promise<void> {
  for (const key of LEGACY_FINANCE_BACKUP_KEYS) {
    const raw = await storage.getItem(key);
    if (!raw) continue;
    const sanitized = sanitizeLegacyFinanceSnapshot(raw);
    // A malformed recovery copy is retained unchanged rather than discarded.
    if (sanitized !== null) await storage.setItem(key, sanitized);
  }
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
