/** Actual money movements only. Schedules and recurring definitions are not receipts. */
export type TransactionType =
  | "income" | "expense" | "emi_payment" | "balloon_payment"
  | "loan_repayment" | "loan_received" | "transfer"
  | "savings_contribution" | "refund" | "adjustment";
export type ReferenceType = "expense" | "income" | "emi" | "loan" | "savings_goal";
export type MoneyDirection = "in" | "out";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  date: string;
  description: string;
  category: string;
  /** Undefined explicitly means unassigned; no wallet balance is affected. */
  accountId?: string;
  notes?: string;
  referenceType?: ReferenceType;
  referenceId?: string;
  /** Historical provenance, not a foreign-key reference. Retained after source deletion. */
  originType?: ReferenceType;
  recurringOccurrenceId?: string;
  paymentId?: string;
  transferGroupId?: string;
  direction: MoneyDirection;
  /** Stable submission identity, independent of description/date/amount. */
  operationId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LedgerAccount {
  id: string;
  openingBalance: number;
  currency: string;
}

export const TRANSACTION_TYPES: readonly TransactionType[] = [
  "income", "expense", "emi_payment", "balloon_payment", "loan_repayment",
  "loan_received", "transfer", "savings_contribution", "refund", "adjustment",
];

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
}

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function validLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Supported currencies all use two decimal places. Reject precision loss at entry. */
export function minorUnits(value: number): number {
  const units = Math.round(value * 100);
  if (!Number.isFinite(value) || !Number.isSafeInteger(units)) throw new Error("Enter a valid monetary amount.");
  return units;
}

export function positiveMoney(value: number): number {
  const units = minorUnits(value);
  if (units <= 0 || Math.abs(value * 100 - units) > 0.00001) {
    throw new Error("Amount must be positive with at most two decimal places.");
  }
  return units / 100;
}

export function directionFor(type: TransactionType): MoneyDirection {
  return ["income", "loan_received", "refund"].includes(type) ? "in" : "out";
}

export function signedMinorUnits(t: Transaction): number {
  return minorUnits(t.amount) * (t.direction === "in" ? 1 : -1);
}

export function getAccountBalance(account: LedgerAccount, transactions: readonly Transaction[]): number {
  let balance = minorUnits(account.openingBalance);
  for (const t of transactions) {
    if (t.accountId === account.id) {
      if (t.currency !== account.currency) throw new Error("Account and transaction currencies do not match.");
      balance += signedMinorUnits(t);
      if (!Number.isSafeInteger(balance)) throw new Error("Account balance exceeds the supported range.");
    }
  }
  return balance / 100;
}

export function getTransactionsByDateRange(transactions: readonly Transaction[], from: string, to: string): Transaction[] {
  if (!validLocalDate(from) || !validLocalDate(to) || from > to) throw new Error("Enter a valid date range.");
  return transactions.filter(t => t.date >= from && t.date <= to);
}

export function monthRange(offset = 0, now = new Date()): { from: string; to: string } {
  return {
    from: localDate(new Date(now.getFullYear(), now.getMonth() + offset, 1)),
    to: localDate(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)),
  };
}

export function cashFlow(transactions: readonly Transaction[], currency: string): { moneyIn: number; moneyOut: number; net: number } {
  let incoming = 0, outgoing = 0;
  for (const t of transactions) {
    // Internal transfers and reconciliation are not earnings or spending.
    if (t.currency !== currency || t.type === "transfer" || t.type === "adjustment") continue;
    if (t.direction === "in") incoming += minorUnits(t.amount);
    else outgoing += minorUnits(t.amount);
  }
  return { moneyIn: incoming / 100, moneyOut: outgoing / 100, net: (incoming - outgoing) / 100 };
}

export function validateTransaction(t: Transaction, accounts: readonly LedgerAccount[]): void {
  if (typeof t.id !== "string" || !t.id || typeof t.operationId !== "string" || !t.operationId || !TRANSACTION_TYPES.includes(t.type)) throw new Error("Invalid transaction identity or type.");
  positiveMoney(t.amount);
  if (!validLocalDate(t.date)) throw new Error("Enter a valid date in YYYY-MM-DD format.");
  if (typeof t.description !== "string" || !t.description.trim() || typeof t.category !== "string" || !t.category.trim() ||
    typeof t.currency !== "string" || !t.currency || typeof t.createdAt !== "string" || !Number.isFinite(Date.parse(t.createdAt))) {
    throw new Error("Transaction description, category, currency and creation time are required.");
  }
  if (t.direction !== "in" && t.direction !== "out") throw new Error("Invalid transaction direction.");
  if (!["transfer", "adjustment"].includes(t.type) && t.direction !== directionFor(t.type)) throw new Error("Invalid direction for this transaction type.");
  if (t.accountId) {
    const account = accounts.find(a => a.id === t.accountId);
    if (!account) throw new Error("The selected account no longer exists.");
    if (account.currency !== t.currency) throw new Error("Select an account in the transaction currency.");
  }
}

export function upsertTransaction(transactions: readonly Transaction[], transaction: Transaction): Transaction[] {
  const existing = transactions.find(t => t.id === transaction.id || t.operationId === transaction.operationId);
  if (existing && existing.id !== transaction.id) return [...transactions];
  return existing
    ? transactions.map(t => t.id === existing.id ? { ...transaction, createdAt: existing.createdAt } : t)
    : [...transactions, transaction];
}

export function transferEntries(input: {
  id: string; source: LedgerAccount; destination: LedgerAccount; amount: number;
  date: string; notes?: string; description?: string;
}, createdAt = new Date().toISOString()): [Transaction, Transaction] {
  if (input.source.id === input.destination.id) throw new Error("Choose two different accounts.");
  if (input.source.currency !== input.destination.currency) throw new Error("Cross-currency transfers require conversion and are not supported.");
  const amount = positiveMoney(input.amount);
  const common = {
    type: "transfer" as const, amount, currency: input.source.currency, date: input.date,
    description: input.description?.trim() || "Account transfer", category: "Transfer",
    notes: input.notes, transferGroupId: input.id, createdAt,
  };
  const pair: [Transaction, Transaction] = [
    { ...common, id: `${input.id}:out`, operationId: `${input.id}:out`, direction: "out", accountId: input.source.id },
    { ...common, id: `${input.id}:in`, operationId: `${input.id}:in`, direction: "in", accountId: input.destination.id },
  ];
  pair.forEach(t => validateTransaction(t, [input.source, input.destination]));
  return pair;
}

export function deleteLedgerEntry(transactions: readonly Transaction[], id: string): Transaction[] {
  const target = transactions.find(t => t.id === id);
  return transactions.filter(t => target?.transferGroupId ? t.transferGroupId !== target.transferGroupId : t.id !== id);
}
