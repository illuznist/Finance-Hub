import {
  decodeBase64,
  decryptGcm,
  encodeBase64,
  hex,
  unhex,
  utf8,
  fromUtf8,
  checkedRandomBytes,
  AES_KEY_BYTES,
  GCM_NONCE_BYTES,
  type RandomBytes,
} from "./crypto.ts";
import { gcm } from "@noble/ciphers/aes.js";

export const RESTORE_JOURNAL_KEY = "@finance_restore_journal_v1";
export const RESTORE_JOURNAL_SECRET_KEY = "finance_restore_key_v1";
export const RESTORE_FINANCE_DOCUMENT_KEY = "@finance_state_v4";
export const RESTORE_THEME_PREFERENCE_KEY = "@finance_theme_v1";
const FINANCE_DOCUMENT_KEY = RESTORE_FINANCE_DOCUMENT_KEY;
const THEME_PREFERENCE_KEY = RESTORE_THEME_PREFERENCE_KEY;
const ALLOWED_RESTORE_KEYS = new Set([FINANCE_DOCUMENT_KEY, THEME_PREFERENCE_KEY]);
const JOURNAL_AAD = utf8("Finance Hub restore journal v1");

export interface JournalStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface JournalSecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

interface RestoreJournal {
  version: 1 | 2;
  status: "prepared" | "committed";
  /** Present only in legacy v1 journals; the encrypted snapshot is authoritative. */
  originalValues?: Record<string, string | null>;
  nonce: string;
  ciphertext: string;
}

export type RestoreRecoveryDiagnosticCode =
  | "RESTORE_JOURNAL_READ_FAILED"
  | "RESTORE_JOURNAL_PARSE_FAILED"
  | "RESTORE_JOURNAL_WRITE_FAILED"
  | "RESTORE_KEY_READ_FAILED"
  | "RESTORE_KEY_MISSING"
  | "RESTORE_KEY_INVALID"
  | "RESTORE_KEY_DELETE_FAILED"
  | "RESTORE_DECRYPT_FAILED"
  | "RESTORE_SNAPSHOT_PARSE_FAILED"
  | "RESTORE_SNAPSHOT_INVALID"
  | "RESTORE_ORIGINAL_VALUE_WRITE_FAILED"
  | "RESTORE_JOURNAL_CLEAR_FAILED";

export class RestoreRecoveryError extends Error {
  readonly code: RestoreRecoveryDiagnosticCode;
  readonly stage: string;
  readonly nextAction: string;
  readonly cause?: unknown;

  constructor(
    code: RestoreRecoveryDiagnosticCode,
    stage: string,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "RestoreRecoveryError";
    this.code = code;
    this.stage = stage;
    this.nextAction = "Keep app storage intact. Retry once; if it persists, share the diagnostic code.";
    this.cause = cause;
  }
}

export type RestoreRecoveryWarning = (
  code: RestoreRecoveryDiagnosticCode,
  stage: string,
  error: unknown,
) => void;

function recoveryFailure(
  code: RestoreRecoveryDiagnosticCode,
  stage: string,
  message: string,
  cause?: unknown,
): RestoreRecoveryError {
  return new RestoreRecoveryError(code, stage, message, cause);
}

async function runRecoveryStep<T>(
  code: RestoreRecoveryDiagnosticCode,
  stage: string,
  message: string,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw recoveryFailure(code, stage, message, error);
  }
}

/**
 * Write-ahead recovery snapshot. Only encrypted recovery content is stored in
 * AsyncStorage; the key is stored by the platform secret store.
 */
export async function createRestoreJournal(
  storage: JournalStorage,
  secrets: JournalSecretStore,
  originalValues: Record<string, string | null>,
  randomBytes: RandomBytes,
): Promise<void> {
  for (const key of Object.keys(originalValues)) {
    if (!ALLOWED_RESTORE_KEYS.has(key)) throw new Error("This restore cannot change an unsupported local preference.");
  }
  const key = await checkedRandomBytes(randomBytes, AES_KEY_BYTES);
  const nonce = await checkedRandomBytes(randomBytes, GCM_NONCE_BYTES);
  const plaintext = utf8(JSON.stringify({ originalValues }));
  try {
    await secrets.set(RESTORE_JOURNAL_SECRET_KEY, hex(key));
    const ciphertext = gcm(key, nonce, JOURNAL_AAD).encrypt(plaintext);
    const journal: RestoreJournal = {
      version: 2,
      status: "prepared",
      nonce: encodeBase64(nonce),
      ciphertext: encodeBase64(ciphertext),
    };
    await storage.setItem(RESTORE_JOURNAL_KEY, JSON.stringify(journal));
  } finally {
    key.fill(0);
    plaintext.fill(0);
  }
}

export async function commitRestoreJournal(storage: JournalStorage): Promise<void> {
  const raw = await storage.getItem(RESTORE_JOURNAL_KEY);
  if (!raw) throw new Error("The restore recovery record is missing.");
  const journal = parseJournal(raw);
  await storage.setItem(RESTORE_JOURNAL_KEY, JSON.stringify({
    version: 2,
    status: "committed",
    nonce: journal.nonce,
    ciphertext: journal.ciphertext,
  }));
}

export async function clearRestoreJournal(
  storage: JournalStorage,
  secrets: JournalSecretStore,
): Promise<void> {
  await storage.removeItem(RESTORE_JOURNAL_KEY);
  await secrets.remove(RESTORE_JOURNAL_SECRET_KEY);
}

/**
 * Recover a restore that stopped before its commit marker. A committed restore
 * keeps the new document and only removes the completed journal.
 */
export async function recoverInterruptedRestore(
  storage: JournalStorage,
  secrets: JournalSecretStore,
  onWarning?: RestoreRecoveryWarning,
): Promise<"none" | "rolled-back" | "committed"> {
  const raw = await runRecoveryStep(
    "RESTORE_JOURNAL_READ_FAILED",
    "Reading restore journal",
    "The interrupted restore record could not be read. Your finance data was not changed.",
    () => storage.getItem(RESTORE_JOURNAL_KEY),
  );
  if (!raw) {
    // Without a journal there is no active transaction to recover. A leftover
    // key is harmless, and SecureStore cleanup must not lock the user out.
    let orphanedKey: string | null;
    try {
      orphanedKey = await secrets.get(RESTORE_JOURNAL_SECRET_KEY);
    } catch (error) {
      onWarning?.("RESTORE_KEY_READ_FAILED", "Checking for orphaned recovery key", error);
      return "none";
    }
    if (orphanedKey) {
      try {
        await secrets.remove(RESTORE_JOURNAL_SECRET_KEY);
      } catch (error) {
        onWarning?.("RESTORE_KEY_DELETE_FAILED", "Removing orphaned recovery key", error);
      }
    }
    return "none";
  }
  let journal: RestoreJournal;
  try {
    journal = parseJournal(raw);
  } catch (error) {
    throw recoveryFailure(
      "RESTORE_JOURNAL_PARSE_FAILED",
      "Parsing restore journal",
      "The interrupted restore record is invalid. Your finance data was not changed.",
      error,
    );
  }
  if (journal.status === "committed") {
    // A committed journal means the replacement document is already durable.
    // Cleanup failure can be retried on the next launch without blocking access.
    try {
      await storage.removeItem(RESTORE_JOURNAL_KEY);
    } catch (error) {
      onWarning?.("RESTORE_JOURNAL_CLEAR_FAILED", "Clearing completed restore journal", error);
      return "committed";
    }
    try {
      await secrets.remove(RESTORE_JOURNAL_SECRET_KEY);
    } catch (error) {
      onWarning?.("RESTORE_KEY_DELETE_FAILED", "Removing completed recovery key", error);
    }
    return "committed";
  }

  const keyText = await runRecoveryStep(
    "RESTORE_KEY_READ_FAILED",
    "Reading recovery key",
    "The protected recovery key could not be read. Your finance data was not changed.",
    () => secrets.get(RESTORE_JOURNAL_SECRET_KEY),
  );
  if (!keyText) {
    throw recoveryFailure(
      "RESTORE_KEY_MISSING",
      "Checking recovery key",
      "The protected recovery key is missing. Existing finance data was left untouched.",
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(keyText)) {
    throw recoveryFailure(
      "RESTORE_KEY_INVALID",
      "Checking recovery key",
      "The protected recovery key is invalid. Existing finance data was left untouched.",
    );
  }
  let key: Uint8Array;
  try {
    key = unhex(keyText);
  } catch (error) {
    throw recoveryFailure(
      "RESTORE_KEY_INVALID",
      "Checking recovery key",
      "The protected recovery key is invalid. Existing finance data was left untouched.",
      error,
    );
  }
  let plaintext: Uint8Array;
  try {
    plaintext = decryptGcm(
      key,
      decodeBase64(journal.nonce),
      decodeBase64(journal.ciphertext),
      JOURNAL_AAD,
    );
  } catch (error) {
    throw recoveryFailure(
      "RESTORE_DECRYPT_FAILED",
      "Decrypting protected snapshot",
      "The protected recovery copy could not be verified. Original data was not overwritten.",
      error,
    );
  } finally {
    key.fill(0);
  }
  try {
    let snapshot: { originalValues?: unknown };
    try {
      snapshot = JSON.parse(fromUtf8(plaintext)) as { originalValues?: unknown };
    } catch (error) {
      throw recoveryFailure(
        "RESTORE_SNAPSHOT_PARSE_FAILED",
        "Parsing protected snapshot",
        "The protected recovery copy could not be read. Original data was not overwritten.",
        error,
      );
    }
    if (!snapshot.originalValues || typeof snapshot.originalValues !== "object" || Array.isArray(snapshot.originalValues)) {
      throw recoveryFailure(
        "RESTORE_SNAPSHOT_INVALID",
        "Validating protected snapshot",
        "The protected recovery copy failed validation. Original data was not overwritten.",
      );
    }
    const originalValues = snapshot.originalValues as Record<string, unknown>;
    for (const [key, value] of Object.entries(originalValues)) {
      if (!ALLOWED_RESTORE_KEYS.has(key) || (value !== null && typeof value !== "string")) {
        throw recoveryFailure(
          "RESTORE_SNAPSHOT_INVALID",
          "Validating protected snapshot",
          "The protected recovery copy failed validation. Original data was not overwritten.",
        );
      }
    }
    if (!Object.hasOwn(originalValues, FINANCE_DOCUMENT_KEY)) {
      throw recoveryFailure(
        "RESTORE_SNAPSHOT_INVALID",
        "Validating protected snapshot",
        "The protected recovery copy is missing the finance document. Original data was not overwritten.",
      );
    }
    const financeDocument = originalValues[FINANCE_DOCUMENT_KEY];
    if (typeof financeDocument === "string") {
      try {
        const parsedFinance = JSON.parse(financeDocument);
        if (!parsedFinance || typeof parsedFinance !== "object" || Array.isArray(parsedFinance)) {
          throw new Error("Finance document must be an object.");
        }
      } catch (error) {
        throw recoveryFailure(
          "RESTORE_SNAPSHOT_INVALID",
          "Validating protected snapshot",
          "The protected recovery copy failed validation. Original data was not overwritten.",
          error,
        );
      }
    }
    // Older v1 journals duplicated the finance JSON in plaintext. Once the
    // encrypted copy is verified, rewrite the journal without that field
    // before touching the stored finance document.
    if (journal.version === 1 || Object.hasOwn(journal, "originalValues")) {
      const encryptedOnlyJournal: RestoreJournal = {
        version: 2,
        status: "prepared",
        nonce: journal.nonce,
        ciphertext: journal.ciphertext,
      };
      await runRecoveryStep(
        "RESTORE_JOURNAL_WRITE_FAILED",
        "Securing legacy restore journal",
        "The recovery record could not be secured safely. No saved finance values were changed.",
        () => storage.setItem(RESTORE_JOURNAL_KEY, JSON.stringify(encryptedOnlyJournal)),
      );
    }
    for (const [key, value] of Object.entries(originalValues)) {
      await runRecoveryStep(
        "RESTORE_ORIGINAL_VALUE_WRITE_FAILED",
        "Restoring original values",
        "Recovery stopped while restoring saved data. The protected copy remains for a safe retry.",
        () => value === null ? storage.removeItem(key) : storage.setItem(key, value as string),
      );
    }
  } finally {
    plaintext.fill(0);
  }
  await runRecoveryStep(
    "RESTORE_JOURNAL_CLEAR_FAILED",
    "Clearing completed restore journal",
    "The original data was restored, but the recovery record could not be safely cleared. Keep app storage intact and retry.",
    () => storage.removeItem(RESTORE_JOURNAL_KEY),
  );
  try {
    await secrets.remove(RESTORE_JOURNAL_SECRET_KEY);
  } catch (error) {
    // The journal is gone and the rollback is complete; a leftover key cannot
    // trigger another restore and is cleaned up best-effort later.
    onWarning?.("RESTORE_KEY_DELETE_FAILED", "Removing completed recovery key", error);
  }
  return "rolled-back";
}

function parseJournal(raw: string): RestoreJournal {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("The restore recovery record is unreadable. Original data has not been cleared.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The restore recovery record is invalid. Original data has not been cleared.");
  }
  const journal = value as Partial<RestoreJournal>;
  if (
    (journal.version !== 1 && journal.version !== 2) ||
    (journal.status !== "prepared" && journal.status !== "committed") ||
    typeof journal.nonce !== "string" ||
    typeof journal.ciphertext !== "string"
  ) {
    throw new Error("The restore recovery record is unsupported. Original data has not been cleared.");
  }
  return journal as RestoreJournal;
}
