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
const FINANCE_DOCUMENT_KEY = "@finance_state_v4";
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
  version: 1;
  status: "prepared" | "committed";
  hadPrimaryDocument: boolean;
  nonce: string;
  ciphertext: string;
}

/**
 * Write-ahead recovery snapshot. The key is stored by the platform secret
 * store, while the encrypted journal is kept beside the AsyncStorage document.
 */
export async function createRestoreJournal(
  storage: JournalStorage,
  secrets: JournalSecretStore,
  originalRaw: string | null,
  randomBytes: RandomBytes,
): Promise<void> {
  const key = await checkedRandomBytes(randomBytes, AES_KEY_BYTES);
  const nonce = await checkedRandomBytes(randomBytes, GCM_NONCE_BYTES);
  const plaintext = utf8(JSON.stringify({ hadPrimaryDocument: originalRaw !== null, originalRaw }));
  try {
    await secrets.set(RESTORE_JOURNAL_SECRET_KEY, hex(key));
    const ciphertext = gcm(key, nonce, JOURNAL_AAD).encrypt(plaintext);
    const journal: RestoreJournal = {
      version: 1,
      status: "prepared",
      hadPrimaryDocument: originalRaw !== null,
      nonce: encodeBase64(nonce),
      ciphertext: encodeBase64(ciphertext),
    };
    await storage.setItem(RESTORE_JOURNAL_KEY, JSON.stringify(journal));
  } catch (error) {
    try { await secrets.remove(RESTORE_JOURNAL_SECRET_KEY); } catch {}
    throw error;
  } finally {
    key.fill(0);
    plaintext.fill(0);
  }
}

export async function commitRestoreJournal(storage: JournalStorage): Promise<void> {
  const raw = await storage.getItem(RESTORE_JOURNAL_KEY);
  if (!raw) throw new Error("The restore recovery record is missing.");
  const journal = parseJournal(raw);
  await storage.setItem(RESTORE_JOURNAL_KEY, JSON.stringify({ ...journal, status: "committed" }));
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
): Promise<"none" | "rolled-back" | "committed"> {
  const raw = await storage.getItem(RESTORE_JOURNAL_KEY);
  if (!raw) {
    const orphanedKey = await secrets.get(RESTORE_JOURNAL_SECRET_KEY);
    if (orphanedKey) await secrets.remove(RESTORE_JOURNAL_SECRET_KEY);
    return "none";
  }
  const journal = parseJournal(raw);
  if (journal.status === "committed") {
    await clearRestoreJournal(storage, secrets);
    return "committed";
  }

  const keyText = await secrets.get(RESTORE_JOURNAL_SECRET_KEY);
  if (!keyText || !/^[0-9a-f]{64}$/i.test(keyText)) {
    throw new Error("The protected restore copy cannot be opened. Original data has not been overwritten again.");
  }
  const key = unhex(keyText);
  let plaintext: Uint8Array;
  try {
    plaintext = decryptGcm(
      key,
      decodeBase64(journal.nonce),
      decodeBase64(journal.ciphertext),
      JOURNAL_AAD,
    );
  } catch {
    throw new Error("The protected restore copy failed its integrity check. Original data is retained for retry.");
  } finally {
    key.fill(0);
  }
  try {
    const snapshot = JSON.parse(fromUtf8(plaintext)) as { hadPrimaryDocument?: unknown; originalRaw?: unknown };
    if (
      typeof snapshot.hadPrimaryDocument !== "boolean" ||
      (snapshot.hadPrimaryDocument && typeof snapshot.originalRaw !== "string") ||
      (!snapshot.hadPrimaryDocument && snapshot.originalRaw !== null)
    ) {
      throw new Error("The protected restore copy has an invalid structure.");
    }
    if (snapshot.hadPrimaryDocument) {
      await storage.setItem(FINANCE_DOCUMENT_KEY, snapshot.originalRaw as string);
    } else {
      await storage.removeItem(FINANCE_DOCUMENT_KEY);
    }
  } finally {
    plaintext.fill(0);
  }
  await clearRestoreJournal(storage, secrets);
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
    journal.version !== 1 ||
    (journal.status !== "prepared" && journal.status !== "committed") ||
    typeof journal.hadPrimaryDocument !== "boolean" ||
    typeof journal.nonce !== "string" ||
    typeof journal.ciphertext !== "string"
  ) {
    throw new Error("The restore recovery record is unsupported. Original data has not been cleared.");
  }
  return journal as RestoreJournal;
}
