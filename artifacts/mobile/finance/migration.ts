import type { FinanceState } from "../context/FinanceContext";
import { validSnapshot } from "./netWorth";
import { minorUnits, validateTransaction } from "./ledger";
import { initialPlanning } from "./budgets";
import { validateRecurring } from "./recurring";
import { translateAppText } from "../i18n/localization";

export const FINANCE_STORAGE_KEY = "@finance_state_v4";
export const LEGACY_BACKUP_KEY = "@finance_state_v4_pre_ledger_backup";
export const COMPATIBILITY_BACKUP_KEY = "@finance_state_v4_compatibility_backup";
export const PLANNING_BACKUP_KEY = "@finance_state_v4_pre_planning_backup";
export const ANALYTICS_BACKUP_KEY = "@finance_state_v4_pre_analytics_backup";
export const SCHEMA_VERSION = 2;

type JsonRecord = Record<string, unknown>;
export function assertBackupFinanceCompleteness(value: unknown): asserts value is JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The selected backup does not contain a finance document.");
  }
  const document = value as JsonRecord;
  const requiredCollections = ["accounts", "expenses", "emis", "loans", "incomes", "savingsGoals", "transactions"];
  if (requiredCollections.some(name => !Array.isArray(document[name]))) {
    throw new Error("The selected backup is missing required finance records. Your current records are unchanged.");
  }
  if (document.schemaVersion === SCHEMA_VERSION) {
    const planning = document.planning;
    if (!planning || typeof planning !== "object" || Array.isArray(planning)) {
      throw new Error("The selected backup is missing its current planning data. Your current records are unchanged.");
    }
    const planningRecord = planning as JsonRecord;
    if (["plans", "periods", "recurring", "occurrences"].some(name => !Array.isArray(planningRecord[name]))) {
      throw new Error("The selected backup is missing current budget or recurring records. Your current records are unchanged.");
    }
  }
}

function object(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(translateAppText("{label} is not a valid object. Your saved data has not been replaced.", { label: translateAppText(label) }));
  }
  return value as JsonRecord;
}
function records(value: unknown, name: string): JsonRecord[] {
  if (value === undefined) return [];
  const translatedName = translateAppText(name);
  if (!Array.isArray(value)) {
    throw new Error(translateAppText("Saved {name} could not be read. Your original data is preserved.", { name: translatedName }));
  }
  const ids = new Set<string>();
  return value.map(entry => {
    const record = object(entry, name);
    if (typeof record.id !== "string" || !record.id || ids.has(record.id)) {
      throw new Error(translateAppText("Saved {name} contain missing or duplicate identities.", { name: translatedName }));
    }
    ids.add(record.id);
    return record;
  });
}

/** Pure, idempotent migration. Never guesses historic dates, accounts or cash flows. */
export function migrateFinanceState(raw: string | null, empty: FinanceState): FinanceState {
  if (raw === null) return { ...empty, schemaVersion: SCHEMA_VERSION, transactions: [], reconciliationRequired: false, planning: initialPlanning(empty) };
  const parsed = object(JSON.parse(raw), "Saved finance data");
  if (parsed.schemaVersion !== undefined && (typeof parsed.schemaVersion !== "number" || parsed.schemaVersion > SCHEMA_VERSION)) {
    throw new Error("This data was saved by a newer app version. Update the app; the original data is unchanged.");
  }
  for (const name of ["expenses", "emis", "loans", "accounts", "incomes", "savingsGoals", "transactions"]) records(parsed[name], name);
  for (const [name, field] of [["expenses", "amount"], ["incomes", "amount"], ["loans", "principalAmount"], ["savingsGoals", "savedAmount"]]) {
    for (const r of records(parsed[name], name)) {
      if (typeof r[field] !== "number" || !Number.isFinite(r[field]) || Number(r[field]) < 0) {
        throw new Error(translateAppText("Saved {name} contain an unreadable amount. Original records have been retained.", { name: translateAppText(name) }));
      }
    }
  }
  if (parsed.monthlyBudget !== undefined && (typeof parsed.monthlyBudget !== "number" || !Number.isFinite(parsed.monthlyBudget) || parsed.monthlyBudget < 0)) {
    throw new Error("The saved budget is not a valid number. Original records have been retained.");
  }
  for (const e of records(parsed.emis, "emis")) {
    if (e.paymentHistory !== undefined) {
      for (const p of records(e.paymentHistory, "EMI payment history")) {
        if (typeof p.amount !== "number" || !Number.isFinite(p.amount) || p.amount < 0) throw new Error("Saved EMI payments contain an unreadable amount.");
      }
    }
    if (typeof e.paidInstallments !== "number" || !Number.isFinite(e.paidInstallments) || e.paidInstallments < 0) throw new Error("Saved EMI progress could not be validated.");
  }
  for (const l of records(parsed.loans, "loans")) {
    if (l.payments !== undefined) {
      for (const p of records(l.payments, "loan payment history")) {
        if (typeof p.amount !== "number" || !Number.isFinite(p.amount) || p.amount <= 0) throw new Error("Saved loan payments contain an unreadable amount.");
      }
    }
  }
  // Schema 1 already owns a ledger. Upgrading it must NEVER replay or discard it.
  const legacy = parsed.schemaVersion === undefined || parsed.schemaVersion === 0;
  const currency = typeof parsed.currency === "string" && parsed.currency ? parsed.currency : empty.currency;
  const accounts = records(parsed.accounts, "accounts").map(a => {
    if (typeof a.balance !== "number") throw new Error("An account has an unreadable balance. Reconciliation is required.");
    minorUnits(a.balance);
    // An intermediate app revision saved schemaVersion before all accounts
    // acquired openingBalance. The saved balance is the starting snapshot:
    // schema 1 never mutates this field when
    // posting ledger entries (current balances are derived in the service).
    // Use that same compatibility rule even when ledger entries already exist.
    const openingBalance = legacy || a.openingBalance === undefined
      ? a.balance
      : a.openingBalance;
    if (typeof openingBalance !== "number") throw new Error("An account is missing its opening balance.");
    minorUnits(openingBalance);
    return { ...a, openingBalance, currency: typeof a.currency === "string" ? a.currency : currency };
  });
  // Existing histories remain byte-for-byte equivalent in their financial fields.
  // Even a dated payment lacks reliable evidence that its account balance included it.
  const emis = records(parsed.emis, "emis").map(e => ({
    ...e,
    currency: e.currency ?? currency,
    ...(Array.isArray(e.paymentHistory) && legacy ? {
      paymentHistory: e.paymentHistory.map(p => ({ ...object(p, "EMI payment"), legacy: true })),
    } : {}),
  }));
  const loans = records(parsed.loans, "loans").map(l => ({
    ...l,
    currency: l.currency ?? currency,
    ...(Array.isArray(l.payments) && legacy ? {
      payments: l.payments.map(p => ({ ...object(p, "Loan payment"), legacy: true })),
    } : {}),
  }));
  const incomes = records(parsed.incomes, "incomes").map(i => ({
    ...i, kind: i.kind ?? "expected", currency: i.currency ?? currency,
  }));
  const securitySettings = {
    ...empty.securitySettings,
    ...object(parsed.securitySettings ?? {}, "Security settings"),
  };
  securitySettings.pinEnabled = securitySettings.pinEnabled === true;
  if (![ -1, 0, 1, 5, 10, 15, 30 ].includes(Number(securitySettings.autoLockMinutes))) {
    securitySettings.autoLockMinutes = empty.securitySettings.autoLockMinutes;
  }
  // The plaintext PIN was only a legacy migration source. Never emit it into
  // the current finance document or any newly saved state.
  delete (securitySettings as JsonRecord).pin;
  const state = {
    ...empty, ...parsed, accounts, emis, loans, incomes,
    expenses: records(parsed.expenses, "expenses").map(e => ({ ...e, currency: e.currency ?? currency })),
    savingsGoals: records(parsed.savingsGoals, "savingsGoals").map(g => ({ ...g, currency: g.currency ?? currency })),
    budgetCurrency: parsed.budgetCurrency ?? currency,
    notificationSettings: { ...empty.notificationSettings, ...object(parsed.notificationSettings ?? {}, "Notification settings") },
    securitySettings,
    transactions: legacy ? [] : (parsed.transactions ?? []),
    schemaVersion: SCHEMA_VERSION,
    reconciliationRequired: legacy ? accounts.length > 0 || emis.length > 0 || loans.length > 0 || records(parsed.expenses, "expenses").some(e => e.isPaid) : Boolean(parsed.reconciliationRequired),
  } as unknown as FinanceState;
  if (!state.planning) state.planning = initialPlanning(state);
  const planning = object(state.planning, "Planning data");
  for (const key of ["plans", "periods", "recurring", "occurrences"]) {
    if (!Array.isArray(planning[key])) {
      throw new Error(translateAppText("Saved planning {key} could not be read; original records retained.", { key: translateAppText(key) }));
    }
  }
  for (const r of state.planning.recurring) validateRecurring(r);
  for (const p of state.planning.plans) {
    if (!Number.isFinite(p.limit) || p.limit < 0 || !Array.isArray(p.categories)) throw new Error("Saved budget data could not be validated.");
  }
  for (const p of state.planning.periods) {
    if (!Number.isFinite(p.limit) || (p.limit < 0 && (!p.carryDeficit || !p.carryFrom)) || !Array.isArray(p.categories)) throw new Error("Saved budget period could not be validated.");
  }
  const occurrenceIds = new Set<string>();
  for (const o of state.planning.occurrences) {
    if (!o.id || occurrenceIds.has(o.id) || !Number.isFinite(o.amount) || o.amount <= 0) throw new Error("Saved recurring occurrence could not be validated.");
    occurrenceIds.add(o.id);
  }
  if (state.netWorthSnapshots !== undefined) {
    if (!Array.isArray(state.netWorthSnapshots) || state.netWorthSnapshots.some(s => !validSnapshot(s)) ||
      new Set(state.netWorthSnapshots.map(s => `${s.currency}:${s.date}`)).size !== state.netWorthSnapshots.length) {
      throw new Error("Saved net-worth snapshots could not be validated. Original records are retained.");
    }
  }
  for (const t of state.transactions ?? []) {
    validateTransaction(t, accounts as unknown as Parameters<typeof validateTransaction>[1]);
  }
  const operations = new Set<string>();
  const groups = new Set<string>();
  for (const t of state.transactions ?? []) {
    if (operations.has(t.operationId)) throw new Error("Duplicate saved financial event found. Original records have been retained.");
    operations.add(t.operationId);
    if (t.type === "transfer") {
      if (!t.transferGroupId) throw new Error("A saved transfer is missing its paired identity.");
      groups.add(t.transferGroupId);
    }
  }
  for (const group of groups) {
    const pair = state.transactions!.filter(t => t.transferGroupId === group);
    if (pair.length !== 2 || pair[0].amount !== pair[1].amount || pair[0].currency !== pair[1].currency ||
      pair[0].date !== pair[1].date || pair[0].direction === pair[1].direction || pair[0].accountId === pair[1].accountId) {
      throw new Error("A saved transfer pair is inconsistent. Original records have been retained.");
    }
  }
  return state;
}

export interface FinanceStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** Back up first. Any validation/backup/write failure leaves the primary untouched. */
export async function loadFinanceState(storage: FinanceStorage, empty: FinanceState): Promise<FinanceState> {
  const raw = await storage.getItem(FINANCE_STORAGE_KEY);
  const migrated = migrateFinanceState(raw, empty);
  const original = raw === null ? null : JSON.parse(raw) as Partial<FinanceState>;
  const legacy = original !== null && (original.schemaVersion === undefined || original.schemaVersion === 0);
  const planningUpgrade = original !== null && (original.schemaVersion !== SCHEMA_VERSION || !original.planning);
  const repairedAccounts = original?.accounts?.some(a => a.openingBalance === undefined) ?? false;
  if (raw !== null && (legacy || repairedAccounts || planningUpgrade)) {
    const backupKey = legacy ? LEGACY_BACKUP_KEY : planningUpgrade ? PLANNING_BACKUP_KEY : COMPATIBILITY_BACKUP_KEY;
    // Preserve the compatibility backup too when this document needs both repairs.
    if (repairedAccounts && await storage.getItem(COMPATIBILITY_BACKUP_KEY) === null) await storage.setItem(COMPATIBILITY_BACKUP_KEY, raw);
    if (await storage.getItem(backupKey) === null) await storage.setItem(backupKey, raw);
  }
  // Complete every required backup before changing the primary document.
  if (raw !== null && original?.netWorthSnapshots === undefined && await storage.getItem(ANALYTICS_BACKUP_KEY) === null) {
    await storage.setItem(ANALYTICS_BACKUP_KEY, raw);
  }
  if (raw !== null && (legacy || repairedAccounts || planningUpgrade)) await storage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(migrated));
  return migrated;
}

/** Serialize whole-document writes; a rejected write cannot silently overtake a later write. */
export function createWriteQueue(storage: FinanceStorage) {
  let pending = Promise.resolve();
  return (state: FinanceState): Promise<void> => {
    const serialized = JSON.stringify(state);
    const write = pending.then(() => storage.setItem(FINANCE_STORAGE_KEY, serialized));
    pending = write.catch(() => {});
    return write;
  };
}
