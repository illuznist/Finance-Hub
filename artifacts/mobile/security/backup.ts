import {
  BACKUP_KDF,
  BACKUP_KDF_ITERATIONS,
  GCM_NONCE_BYTES,
  KDF_SALT_BYTES,
  MAX_BACKUP_KDF_ITERATIONS,
  MIN_BACKUP_KDF_ITERATIONS,
  decodeBase64,
  deriveKey,
  encodeBase64,
  fromUtf8,
  utf8,
  type RandomBytes,
} from "./crypto.ts";
import { gcm } from "@noble/ciphers/aes.js";

export const BACKUP_MAGIC = "FINANCE_HUB_ENCRYPTED_BACKUP";
export const BACKUP_FORMAT_VERSION = 1;
export const MAX_BACKUP_FILE_BYTES = 64 * 1024 * 1024;
export const MIN_BACKUP_PASSWORD_LENGTH = 12;

export interface BackupRecordCounts {
  accounts: number;
  transactions: number;
  incomes: number;
  expenses: number;
  emiSchedules: number;
  emiPayments: number;
  loans: number;
  loanPayments: number;
  budgetPlans: number;
  budgetPeriods: number;
  recurringDefinitions: number;
  recurringOccurrences: number;
  savingsGoals: number;
  netWorthSnapshots: number;
}

export interface BackupMetadata {
  createdAt: string;
  appVersion: string;
  schemaVersion: number;
  recordCounts: BackupRecordCounts;
}

export interface FinanceBackupPayload {
  financeState: Record<string, unknown>;
  userPreferences: { themeMode?: "system" | "light" | "dark" };
}

export interface FinanceBackupEnvelope {
  magic: typeof BACKUP_MAGIC;
  formatVersion: typeof BACKUP_FORMAT_VERSION;
  encryption: "AES-256-GCM";
  keyDerivation: typeof BACKUP_KDF;
  iterations: number;
  salt: string;
  nonce: string;
  metadata: BackupMetadata;
  ciphertext: string;
}

export interface OpenedFinanceBackup {
  metadata: BackupMetadata;
  payload: FinanceBackupPayload;
}

export function countFinanceRecords(state: Record<string, unknown>): BackupRecordCounts {
  const planning = asRecord(state.planning);
  const emis = asArray(state.emis);
  const loans = asArray(state.loans);
  return {
    accounts: asArray(state.accounts).length,
    transactions: asArray(state.transactions).length,
    incomes: asArray(state.incomes).length,
    expenses: asArray(state.expenses).length,
    emiSchedules: emis.length,
    emiPayments: emis.reduce<number>((sum, emi) => sum + asArray(asRecord(emi).paymentHistory).length, 0),
    loans: loans.length,
    loanPayments: loans.reduce<number>((sum, loan) => sum + asArray(asRecord(loan).payments).length, 0),
    budgetPlans: asArray(planning.plans).length,
    budgetPeriods: asArray(planning.periods).length,
    recurringDefinitions: asArray(planning.recurring).length,
    recurringOccurrences: asArray(planning.occurrences).length,
    savingsGoals: asArray(state.savingsGoals).length,
    netWorthSnapshots: asArray(state.netWorthSnapshots).length,
  };
}

export async function createFinanceBackup(
  financeState: Record<string, unknown>,
  themeMode: "system" | "light" | "dark",
  password: string,
  randomBytes: RandomBytes,
  appVersion: string,
  createdAt = new Date().toISOString(),
): Promise<string> {
  if (passwordCodePoints(password) < MIN_BACKUP_PASSWORD_LENGTH) {
    throw new Error(`Choose a backup password with at least ${MIN_BACKUP_PASSWORD_LENGTH} characters.`);
  }
  const safeState = JSON.parse(JSON.stringify(financeState)) as Record<string, unknown>;
  // App-lock preferences and credentials are device-specific and must not travel with finance data.
  delete safeState.securitySettings;
  const payload: FinanceBackupPayload = {
    financeState: safeState,
    userPreferences: { themeMode },
  };
  const salt = await checkedRandomBytes(randomBytes, KDF_SALT_BYTES);
  const nonce = await checkedRandomBytes(randomBytes, GCM_NONCE_BYTES);
  const metadata: BackupMetadata = {
    createdAt,
    appVersion,
    schemaVersion: finiteInteger(safeState.schemaVersion, 0),
    recordCounts: countFinanceRecords(safeState),
  };
  const header = {
    magic: BACKUP_MAGIC,
    formatVersion: BACKUP_FORMAT_VERSION,
    encryption: "AES-256-GCM",
    keyDerivation: BACKUP_KDF,
    iterations: BACKUP_KDF_ITERATIONS,
    salt: encodeBase64(salt),
    nonce: encodeBase64(nonce),
    metadata,
  } as const;
  const key = await deriveKey(password, salt, BACKUP_KDF_ITERATIONS);
  try {
    const ciphertext = gcm(key, nonce, utf8(JSON.stringify(header))).encrypt(utf8(JSON.stringify(payload)));
    const envelope: FinanceBackupEnvelope = { ...header, ciphertext: encodeBase64(ciphertext) };
    const output = JSON.stringify(envelope, null, 2);
    if (utf8(output).length > MAX_BACKUP_FILE_BYTES) throw new Error("This backup is too large to export safely.");
    return output;
  } finally {
    key.fill(0);
  }
}

export async function openFinanceBackup(
  serialized: string,
  password: string,
): Promise<OpenedFinanceBackup> {
  if (utf8(serialized).length > MAX_BACKUP_FILE_BYTES) throw new Error("This backup file is too large to open safely.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error("This file is not a readable Finance Hub backup.");
  }
  const envelope = asRecord(parsed);
  if (envelope.magic !== BACKUP_MAGIC) throw new Error("This is not a Finance Hub encrypted backup.");
  if (envelope.formatVersion !== BACKUP_FORMAT_VERSION) throw new Error("This backup format version is not supported by this app.");
  if (envelope.encryption !== "AES-256-GCM" || envelope.keyDerivation !== BACKUP_KDF) {
    throw new Error("This backup uses an unsupported encryption format.");
  }
  if (
    !Number.isInteger(envelope.iterations) ||
    Number(envelope.iterations) < MIN_BACKUP_KDF_ITERATIONS ||
    Number(envelope.iterations) > MAX_BACKUP_KDF_ITERATIONS
  ) {
    throw new Error("This backup's key settings are invalid or unsupported.");
  }
  const salt = decodeBase64(requiredString(envelope.salt));
  const nonce = decodeBase64(requiredString(envelope.nonce));
  const ciphertext = decodeBase64(requiredString(envelope.ciphertext));
  if (salt.length !== KDF_SALT_BYTES || nonce.length !== GCM_NONCE_BYTES || ciphertext.length < 16) {
    throw new Error("This backup file is incomplete or damaged.");
  }
  const metadata = validateMetadata(envelope.metadata);
  const header = {
    magic: envelope.magic,
    formatVersion: envelope.formatVersion,
    encryption: envelope.encryption,
    keyDerivation: envelope.keyDerivation,
    iterations: envelope.iterations,
    salt: envelope.salt,
    nonce: envelope.nonce,
    metadata,
  };
  const key = await deriveKey(password, salt, Number(envelope.iterations));
  let plaintext: Uint8Array;
  try {
    plaintext = gcm(key, nonce, utf8(JSON.stringify(header))).decrypt(ciphertext);
  } catch {
    throw new Error("The backup could not be opened. Check the password and select an intact backup.");
  } finally {
    key.fill(0);
  }
  try {
    const payload = asRecord(JSON.parse(fromUtf8(plaintext)));
    const financeState = asRecord(payload.financeState);
    const userPreferences = asRecord(payload.userPreferences);
    const counts = countFinanceRecords(financeState);
    if (!sameCounts(counts, metadata.recordCounts)) {
      throw new Error("The backup record summary does not match its contents.");
    }
    const themeMode = userPreferences.themeMode;
    if (themeMode !== undefined && themeMode !== "system" && themeMode !== "light" && themeMode !== "dark") {
      throw new Error("The backup contains an unsupported appearance preference.");
    }
    return {
      metadata,
      payload: {
        financeState,
        userPreferences: themeMode ? { themeMode } : {},
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("The backup")) throw error;
    throw new Error("The backup contents are invalid or incomplete.");
  } finally {
    plaintext.fill(0);
  }
}

function validateMetadata(value: unknown): BackupMetadata {
  const source = asRecord(value);
  if (
    typeof source.createdAt !== "string" ||
    !Number.isFinite(Date.parse(source.createdAt)) ||
    typeof source.appVersion !== "string" ||
    !Number.isInteger(source.schemaVersion) ||
    Number(source.schemaVersion) < 0
  ) {
    throw new Error("The backup preview information is invalid.");
  }
  const rawCounts = asRecord(source.recordCounts);
  const keys: (keyof BackupRecordCounts)[] = [
    "accounts", "transactions", "incomes", "expenses", "emiSchedules", "emiPayments",
    "loans", "loanPayments", "budgetPlans", "budgetPeriods", "recurringDefinitions",
    "recurringOccurrences", "savingsGoals", "netWorthSnapshots",
  ];
  const recordCounts = {} as BackupRecordCounts;
  for (const key of keys) {
    const count = rawCounts[key];
    if (!Number.isSafeInteger(count) || Number(count) < 0) throw new Error("The backup preview counts are invalid.");
    recordCounts[key] = Number(count);
  }
  return {
    createdAt: source.createdAt,
    appVersion: source.appVersion,
    schemaVersion: Number(source.schemaVersion),
    recordCounts,
  };
}

function sameCounts(left: BackupRecordCounts, right: BackupRecordCounts): boolean {
  return (Object.keys(left) as (keyof BackupRecordCounts)[]).every(key => left[key] === right[key]);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The backup data is invalid.");
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function requiredString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) throw new Error("The backup file is incomplete.");
  return value;
}

function finiteInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : fallback;
}

function passwordCodePoints(value: string): number {
  return [...value].length;
}

async function checkedRandomBytes(randomBytes: RandomBytes, length: number): Promise<Uint8Array> {
  const bytes = await randomBytes(length);
  if (!(bytes instanceof Uint8Array) || bytes.length !== length) {
    throw new Error("Secure random data is unavailable on this device.");
  }
  return new Uint8Array(bytes);
}
