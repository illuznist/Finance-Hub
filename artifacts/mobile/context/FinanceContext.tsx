import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import type { BudgetPlan, PlanningState, RecurringExpense, UpcomingPayment } from "@/finance/planningTypes";
import * as budgets from "@/finance/budgets";
import * as recurring from "@/finance/recurring";
import { getUpcoming as upcomingPayments, recordScheduledPayment as confirmScheduledPayment } from "@/finance/upcoming";
import type { Transaction } from "@/finance/ledger";
import { getAccountBalance, getTransactionsByDateRange, monthRange, newId, minorUnits, localDate } from "@/finance/ledger";
import { assertBackupFinanceCompleteness, loadFinanceState, createWriteQueue, migrateFinanceState } from "@/finance/migration";
import * as ledgerService from "@/finance/service";
import {
  clearProtectedRestoreJournal,
  commitProtectedRestoreJournal,
  createProtectedRestoreJournal,
  financeStorageAdapter,
  migrateLegacyPinBeforeFinanceLoad,
  recoverProtectedRestoreJournal,
} from "@/security/deviceSecurity";
import { captureNetWorthSnapshots } from "@/finance/netWorth";
import type { NetWorthSnapshot } from "@/finance/analyticsTypes";
import { buildAnalyticsReport } from "@/finance/analytics";

import {
  getLoanOutstandingBalance,
  getLoanPaidAmount,
  isLoanSettled,
  wouldLoanBeOverpaid,
} from "@/utils/loanCalculations";

export interface Expense {
  id: string;
  name: string;
  category: string;
  amount: number;
  dueDate: number;
  isPaid: boolean;
  iconName: string;
  color: string;
  notes?: string;
  recurrence?: "none" | "weekly" | "monthly" | "yearly";
  accountId?: string;
  paidDate?: string;
  paymentId?: string;
  currency?: string;
  recurringOccurrenceId?: string;
}

export interface EMI {
  id: string;
  currency?: string;
  name: string;
  financeProvider?: string;
  category?: "vehicle" | "personal" | "home" | "other" | string;
  financedAmount?: number;
  monthlyEMIAmount?: number;
  durationMonths?: number;
  startDate?: string;
  firstPaymentDate?: string;
  paymentDueDay?: number;
  balloonPaymentAmount?: number;
  balloonPaymentDueDate?: string;
  linkedAccountId?: string;
  autoDebitEnabled?: boolean;
  notes?: string;
  paymentHistory?: EMIPayment[];
  legacyPaidInstallments?: number;
  createdAt?: string;
  // Legacy names remain persisted so existing screens and reports keep working.
  totalAmount: number;
  monthlyAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  startMonth: string;
  dueDayOfMonth: number;
  color: string;
  iconName: string;
}

export interface EMIPayment {
  id: string;
  amount: number;
  date: string;
  paymentType: "monthly_emi" | "balloon";
  status: "paid";
  notes?: string;
  accountId?: string;
  operationId?: string;
  legacy?: boolean;
  scheduledDueDate?: string;
}

export type LoanDirection = "borrowed" | "lent";
export type LoanSourceType = "bank" | "person" | "other";
export type LoanCategory = "personal" | "home" | "vehicle" | "education" | "business" | "family" | "other";
export type LoanRepaymentFrequency = "one-time" | "weekly" | "monthly" | "quarterly";

export interface LoanPayment {
  id: string;
  amount: number;
  date: string;
  notes?: string;
  accountId?: string;
  operationId?: string;
  legacy?: boolean;
  scheduledDueDate?: string;
}

export interface Loan {
  id: string;
  currency?: string;
  name: string;
  direction: LoanDirection;
  counterpartyName: string;
  sourceType: LoanSourceType;
  category: LoanCategory;
  principalAmount: number;
  totalRepaymentAmount?: number;
  interestRate?: number;
  startDate: string;
  expectedEndDate?: string;
  repaymentFrequency: LoanRepaymentFrequency;
  plannedPaymentAmount?: number;
  notes: string;
  color?: string;
  iconName?: string;
  payments: LoanPayment[];
  createdAt: string;
  funding?: { transactionId: string; amount: number; date: string; accountId?: string; notes?: string };
  repaymentStartDate?: string;
  linkedAccountId?: string;
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  type: "bank" | "cash" | "savings";
  color: string;
  openingBalance?: number;
  currency?: string;
}

export interface Income {
  id: string;
  name: string;
  amount: number;
  type: "salary" | "freelance" | "other";
  color: string;
  kind?: "expected" | "received";
  date?: string;
  accountId?: string;
  currency?: string;
  category?: string;
  notes?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  color: string;
  iconName: string;
  deadline?: string;
  currency?: string;
}

export interface NotificationSettings {
  enabled: boolean;
  timing: "same" | "1day" | "3days" | "7days";
  emiEnabled: boolean;
  expenseEnabled: boolean;
  budgetEnabled: boolean;
  balloonEnabled?: boolean;
  loanEnabled?: boolean;
}

export interface SecuritySettings {
  pinEnabled: boolean;
  autoLockMinutes: number;
}

export interface FinanceState {
  /** Optional, observed daily positions; never reconstructed from incomplete history. */
  netWorthSnapshots?: NetWorthSnapshot[];
  userName: string;
  currency: string;
  monthlyBudget: number;
  budgetCurrency?: string;
  expenses: Expense[];
  emis: EMI[];
  loans: Loan[];
  accounts: Account[];
  incomes: Income[];
  savingsGoals: SavingsGoal[];
  notificationSettings: NotificationSettings;
  securitySettings: SecuritySettings;
  lastResetMonth: string;
  lastResetYear: string;
  schemaVersion?: number;
  transactions?: Transaction[];
  reconciliationRequired?: boolean;
  reconciledAccountIds?: string[];
  planning?: PlanningState;
}

export const SUPPORTED_CURRENCIES = [
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR" },
  { code: "USD", name: "US Dollar", symbol: "USD" },
  { code: "AED", name: "UAE Dirham", symbol: "AED" },
  { code: "EUR", name: "Euro", symbol: "EUR" },
  { code: "GBP", name: "British Pound", symbol: "GBP" },
  { code: "INR", name: "Indian Rupee", symbol: "INR" },
];

interface FinanceContextType extends FinanceState {
  calendarKey: string;
  getBudget: (month: string, currency?: string) => ReturnType<typeof budgets.getBudgetView>;
  ensureBudgetPeriod: (month: string) => void;
  saveBudget: (month: string, input: BudgetPlan) => boolean;
  saveRecurring: (input: RecurringExpense, scope: "future" | "pending") => boolean;
  setRecurringActive: (id: string, active: boolean) => boolean;
  deleteRecurring: (id: string) => boolean;
  payRecurring: (id: string, dueDate: string, input: { accountId?: string; date: string }) => boolean;
  skipRecurring: (id: string, dueDate: string, pause?: boolean) => boolean;
  getUpcoming: (from: string, to: string) => UpcomingPayment[];
  recordScheduledPayment: (item: UpcomingPayment, accountId: string | undefined, date: string, amount?: number, operationId?: string) => boolean;
  transactions: Transaction[];
  storageError: string | null;
  storageRecoveryNotice: string | null;
  isReady: boolean;
  retryStorage: () => void;
  setExpensePaid: (id: string, paid: boolean, accountId?: string, date?: string) => boolean;
  addTransaction: (input: Parameters<typeof ledgerService.addManualMovement>[1]) => boolean;
  deleteTransaction: (id: string) => boolean;
  updateTransaction: (id: string, changes: ledgerService.TransactionCorrection) => boolean;
  recordTransfer: (input: Parameters<typeof ledgerService.recordTransfer>[1]) => boolean;
  reconcileAccountBalance: (input: Parameters<typeof ledgerService.reconcileAccountBalance>[1]) => boolean;
  contributeToSavings: (input: Parameters<typeof ledgerService.contributeToSavings>[1]) => boolean;
  getAccountBalance: (id: string) => number;
  getTransactionsByDateRange: (from: string, to: string) => Transaction[];
  addExpense: (e: Omit<Expense, "id"> & { id?: string }) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  addEMI: (e: Omit<EMI, "id">) => void;
  updateEMI: (id: string, updates: Partial<Omit<EMI, "id" | "paymentHistory" | "paidInstallments" | "legacyPaidInstallments">>) => void;
  deleteEMI: (id: string) => void;
  recordEMIPayment: (id: string, payment: Omit<EMIPayment, "id" | "status">) => boolean;
  updateEMIPayment: (emiId: string, paymentId: string, updates: Partial<Pick<EMIPayment, "amount" | "date" | "notes" | "accountId">>) => boolean;
  deleteEMIPayment: (emiId: string, paymentId: string) => boolean;
  addLoan: (loan: Omit<Loan, "id">, funding?: { id: string; accountId?: string; date: string }) => boolean;
  updateLoan: (id: string, updates: Partial<Loan>) => boolean;
  deleteLoan: (id: string) => void;
  recordLoanPayment: (id: string, payment: Omit<LoanPayment, "id">) => boolean;
  updateLoanPayment: (loanId: string, paymentId: string, updates: Partial<Pick<LoanPayment, "amount" | "date" | "notes" | "accountId">>) => boolean;
  deleteLoanPayment: (loanId: string, paymentId: string) => boolean;
  addAccount: (a: Omit<Account, "id">) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => boolean;
  addIncome: (i: Omit<Income, "id"> & { id?: string }) => void;
  updateIncome: (id: string, updates: Partial<Income>) => void;
  deleteIncome: (id: string) => void;
  addSavingsGoal: (g: Omit<SavingsGoal, "id">) => void;
  updateSavingsGoal: (id: string, updates: Partial<Omit<SavingsGoal, "id" | "savedAmount" | "currency">>) => void;
  deleteSavingsGoal: (id: string) => void;
  setMonthlyBudget: (amount: number) => void;
  setUserName: (name: string) => void;
  setCurrency: (currency: string) => void;
  setNotificationSettings: (s: NotificationSettings) => void;
  setSecuritySettings: (s: SecuritySettings) => Promise<void>;
  validateFinanceRestore: (candidate: unknown) => FinanceState;
  restoreFinanceState: (candidate: unknown, themeMode?: "system" | "light" | "dark") => Promise<void>;
  getFinanceStateSnapshot: () => FinanceState;
  monthResetInfo: { count: number; month: string } | null;
  dismissResetInfo: () => void;
  totalBalance: number;
  actualMonthlyIncome: number;
  actualMonthlyOutflow: number;
  actualMonthlyNet: number;
  totalMonthlyIncome: number;
  totalMonthlyExpenses: number;
  totalEMIMonthly: number;
  remainingBudget: number;
  totalSavings: number;
  totalPrincipalBorrowed: number;
  totalPrincipalLent: number;
  totalRepaidOnBorrowedLoans: number;
  totalReceivedOnLentLoans: number;
  outstandingBorrowedBalance: number;
  outstandingLentBalance: number;
  activeLoanCount: number;
  settledLoanCount: number;
}

const defaultNotificationSettings: NotificationSettings = {
  enabled: true,
  timing: "1day",
  emiEnabled: true,
  expenseEnabled: true,
  budgetEnabled: true,
  balloonEnabled: true,
  loanEnabled: true,
};

const defaultSecuritySettings: SecuritySettings = {
  pinEnabled: false,
  autoLockMinutes: 5,
};

const defaultState: FinanceState = {
  userName: "",
  currency: "SAR",
  monthlyBudget: 0,
  expenses: [],
  emis: [],
  loans: [],
  accounts: [],
  incomes: [],
  savingsGoals: [],
  notificationSettings: defaultNotificationSettings,
  securitySettings: defaultSecuritySettings,
  lastResetMonth: "",
  lastResetYear: "",
  schemaVersion: 2,
  transactions: [],
  reconciliationRequired: false,
};

const FinanceContext = createContext<FinanceContextType | null>(null);

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function currentYYYYMM(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
function currentYYYY(): string {
  return String(new Date().getFullYear());
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeLoan(loan: Loan): Loan {
  const payments = Array.isArray(loan.payments)
    ? loan.payments
    : [];
  return {
    ...loan,
    direction: loan.direction === "lent" ? "lent" : "borrowed",
    sourceType: loan.sourceType === "bank" || loan.sourceType === "person" ? loan.sourceType : "other",
    category: loan.category ?? "other",
    repaymentFrequency: loan.repaymentFrequency ?? "one-time",
    notes: loan.notes ?? "",
    payments,
    createdAt: loan.createdAt || new Date().toISOString(),
  };
}

function dateAtMonthOffset(firstDate: string, monthOffset: number, dueDay?: number): string {
  const [year, month, originalDay] = firstDate.split("-").map(Number);
  const target = new Date(year, month - 1 + monthOffset, 1);
  const day = dueDay ?? originalDay;
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return formatLocalDate(new Date(target.getFullYear(), target.getMonth(), Math.min(day, lastDay)));
}

function normalizeEMI(emi: EMI): EMI {
  const monthlyAmount = Number(emi.monthlyEMIAmount ?? emi.monthlyAmount) || 0;
  const totalInstallments = Math.max(1, Number(emi.durationMonths ?? emi.totalInstallments) || 1);
  const paidCount = Math.max(0, Math.min(totalInstallments, Number(emi.paidInstallments) || 0));
  const dueDay = Math.max(1, Math.min(31, Number(emi.paymentDueDay ?? emi.dueDayOfMonth) || 1));
  const startDate = emi.startDate || `${emi.startMonth || currentYYYYMM()}-01`;
  const firstPaymentDate = emi.firstPaymentDate || dateAtMonthOffset(startDate, 0, dueDay);
  let paymentHistory = Array.isArray(emi.paymentHistory)
    ? emi.paymentHistory
    : [];

  // A count is not evidence of actual dates or account movements.
  const legacyPaidInstallments = emi.legacyPaidInstallments ?? (!Array.isArray(emi.paymentHistory) ? paidCount : 0);

  const monthlyPaidCount = paymentHistory.filter((payment) => payment.paymentType === "monthly_emi").length;
  const financedAmount = Number(emi.financedAmount ?? emi.totalAmount) || 0;
  return {
    ...emi,
    financeProvider: emi.financeProvider || "Finance provider",
    category: emi.category || "other",
    financedAmount,
    monthlyEMIAmount: monthlyAmount,
    durationMonths: totalInstallments,
    startDate,
    firstPaymentDate,
    paymentDueDay: dueDay,
    balloonPaymentAmount: Math.max(0, Number(emi.balloonPaymentAmount) || 0),
    balloonPaymentDueDate: emi.balloonPaymentDueDate || undefined,
    autoDebitEnabled: Boolean(emi.autoDebitEnabled),
    notes: emi.notes || "",
    paymentHistory,
    legacyPaidInstallments,
    createdAt: emi.createdAt || new Date().toISOString(),
    totalAmount: financedAmount,
    monthlyAmount,
    totalInstallments,
    paidInstallments: Math.min(totalInstallments, monthlyPaidCount + legacyPaidInstallments),
    startMonth: startDate.slice(0, 7),
    dueDayOfMonth: dueDay,
  };
}

function monthLabel(yyyymm: string): string {
  const [, mm] = yyyymm.split("-");
  return MONTH_NAMES[parseInt(mm, 10) - 1] ?? yyyymm;
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinanceState>(defaultState);
  const [calendarKey, setCalendarKey] = useState(() => `${localDate()}:${new Date().getTimezoneOffset()}`);
  const [monthResetInfo, setMonthResetInfo] = useState<{ count: number; month: string } | null>(null);
  const stateRef = useRef(state);
  const loadingRef = useRef(false);
  const readyRef = useRef(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageRecoveryNotice, setStorageRecoveryNotice] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const queueWrite = useMemo(() => createWriteQueue(AsyncStorage), []);

  const load = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    void (async () => {
      const recovery = await recoverProtectedRestoreJournal(AsyncStorage);
      if (recovery === "rolled-back") {
        setStorageRecoveryNotice("An interrupted restore was rolled back. Your previous finance records were retained.");
      } else if (recovery === "committed") {
        setStorageRecoveryNotice("A completed restore was recovered after restart.");
      }
      await migrateLegacyPinBeforeFinanceLoad(AsyncStorage);
      const initial = await loadFinanceState(AsyncStorage, defaultState);
      // Finance migration may create a compatibility copy from the old document;
      // strip its device-only plaintext PIN after that recovery copy is complete.
      await migrateLegacyPinBeforeFinanceLoad(AsyncStorage);
      let loaded = initial;
      loaded = { ...loaded, emis: loaded.emis.map(normalizeEMI) };
      loaded = { ...loaded, loans: loaded.loans.map(normalizeLoan) };

      // Legacy paid flags are historical records, not recurring occurrences.
      const nowMonth = currentYYYYMM();
      const nowYear = currentYYYY();
      loaded = { ...loaded, lastResetMonth: nowMonth, lastResetYear: nowYear };
      loaded = budgets.ensureBudgetPeriod(recurring.generateDueOccurrences(loaded), nowMonth);
      loaded = captureNetWorthSnapshots(loaded);

      await queueWrite(loaded);
      stateRef.current = loaded;
      readyRef.current = true;
      setIsReady(true);
      setStorageError(null);
      setState(loaded);
    })().catch(() => {
      readyRef.current = false;
      setStorageError("Saved data could not be loaded. No records have been reset.");
    }).finally(() => { loadingRef.current = false; });
  }, [queueWrite]);
  useEffect(load, [load]);

  const persist = useCallback((updater: (prev: FinanceState) => FinanceState) => {
    if (!readyRef.current) throw new Error("Finance storage is unavailable. Retry before making changes.");
    const next = captureNetWorthSnapshots(budgets.ensureBudgetPeriod(recurring.generateDueOccurrences(recurring.synchronizeOccurrences(
      ledgerService.synchronizeDomain(stateRef.current, updater(stateRef.current))
    )), localDate().slice(0, 7)));
    stateRef.current = next;
    setState(next);
    queueWrite(next).catch(() => {
      readyRef.current = false;
      setStorageError("Changes could not be saved. Your records are unchanged; keep the app open and retry safely.");
    });
  }, [queueWrite]);

  const retryStorage = useCallback(async () => {
    if (!readyRef.current && stateRef.current === defaultState) { load(); return; }
    try {
      const recovery = await recoverProtectedRestoreJournal(AsyncStorage);
      if (recovery !== "none") { load(); return; }
      await queueWrite(stateRef.current);
      readyRef.current = true; setStorageError(null);
    } catch {
      readyRef.current = false;
      setStorageError("Saved data could not be retried safely.");
    }
  }, [load, queueWrite]);

  const attempt = useCallback((updater: (prev: FinanceState) => FinanceState): boolean => {
    try { persist(updater); return true; }
    catch { return false; }
  }, [persist]);
  const getBudget = useCallback((month: string, currency?: string) => budgets.getBudgetView(stateRef.current, month, currency), [calendarKey]);
  const ensureBudgetPeriod = useCallback((month: string) => {
    if (!readyRef.current) return;
    const next = budgets.ensureBudgetPeriod(stateRef.current, month);
    if (next !== stateRef.current) persist(() => next);
  }, [persist]);
  const saveBudget = useCallback((month: string, input: BudgetPlan) => attempt(s => budgets.saveBudget(s, month, input)), [attempt]);
  const saveRecurring = useCallback((input: RecurringExpense, scope: "future" | "pending") => attempt(s => recurring.saveRecurring(s, input, scope)), [attempt]);
  const setRecurringActive = useCallback((id: string, active: boolean) => attempt(s => recurring.setRecurringActive(s, id, active)), [attempt]);
  const deleteRecurring = useCallback((id: string) => attempt(s => recurring.deleteRecurring(s, id)), [attempt]);
  const payRecurring = useCallback((id: string, due: string, input: { accountId?: string; date: string }) => attempt(s => recurring.payRecurring(s, id, due, input)), [attempt]);
  const skipRecurring = useCallback((id: string, due: string, pause?: boolean) => attempt(s => recurring.skipRecurring(s, id, due, pause)), [attempt]);
  const getUpcoming = useCallback((from: string, to: string) => upcomingPayments(stateRef.current, from, to), [calendarKey]);
  const recordScheduledPayment = useCallback((item: UpcomingPayment, accountId: string | undefined, date: string, amount?: number, submissionId?: string) =>
    attempt(s => confirmScheduledPayment(s, item, accountId, date, amount, submissionId)), [attempt]);

  useEffect(() => {
    const refresh = () => {
      if (!readyRef.current) return;
      setCalendarKey(`${localDate()}:${new Date().getTimezoneOffset()}`);
      const next = captureNetWorthSnapshots(budgets.ensureBudgetPeriod(recurring.generateDueOccurrences(stateRef.current), localDate().slice(0, 7)));
      if (next !== stateRef.current) persist(() => next);
    };
    const sub = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
    const timer = setInterval(refresh, 60000);
    return () => { sub.remove(); clearInterval(timer); };
  }, [persist]);
  const setExpensePaid = useCallback((id: string, paid: boolean, accountId?: string, date?: string) =>
    attempt(prev => ledgerService.setExpensePayment(prev, id, { paid, accountId, date, operationId: newId() })), [attempt]);
  const addTransaction = useCallback((input: Parameters<typeof ledgerService.addManualMovement>[1]) =>
    attempt(prev => ledgerService.addManualMovement(prev, input)), [attempt]);
  const deleteTransaction = useCallback((id: string) => attempt(prev => ledgerService.deleteTransaction(prev, id)), [attempt]);
  const updateTransaction = useCallback((id: string, changes: ledgerService.TransactionCorrection) =>
    attempt(prev => ledgerService.updateTransaction(prev, id, changes)), [attempt]);
  const recordTransfer = useCallback((input: Parameters<typeof ledgerService.recordTransfer>[1]) =>
    attempt(prev => ledgerService.recordTransfer(prev, input)), [attempt]);
  const reconcileAccountBalance = useCallback((input: Parameters<typeof ledgerService.reconcileAccountBalance>[1]) =>
    attempt(prev => ledgerService.reconcileAccountBalance(prev, input)), [attempt]);
  const contributeToSavings = useCallback((input: Parameters<typeof ledgerService.contributeToSavings>[1]) =>
    attempt(prev => ledgerService.contributeToSavings(prev, input)), [attempt]);

  const addExpense = useCallback(
    (e: Omit<Expense, "id"> & { id?: string }) =>
      persist(prev => ledgerService.saveExpense(prev, { ...e, id: e.id ?? genId() })),
    [persist]
  );
  const updateExpense = useCallback(
    (id: string, updates: Partial<Expense>) =>
      persist(prev => {
        const expense = prev.expenses.find(e => e.id === id);
        if (!expense) throw new Error("Expense no longer exists.");
        return ledgerService.saveExpense(prev, { ...expense, ...updates, id, paymentId: expense.paymentId, recurringOccurrenceId: expense.recurringOccurrenceId });
      }),
    [persist]
  );
  const deleteExpense = useCallback(
    (id: string) => persist(prev => ledgerService.deleteDomainSource(prev, "expense", id)),
    [persist]
  );

  const addEMI = useCallback(
    (e: Omit<EMI, "id">) =>
      persist((prev) => ({ ...prev, emis: [...prev.emis, normalizeEMI({ ...e, currency: e.currency ?? prev.currency, id: genId() })] })),
    [persist]
  );
  const updateEMI = useCallback(
    (id: string, updates: Partial<Omit<EMI, "id" | "paymentHistory" | "paidInstallments" | "legacyPaidInstallments">>) =>
      persist((prev) => ({
        ...prev,
        emis: prev.emis.map((emi) => (emi.id === id ? normalizeEMI({
          ...emi,
          ...updates,
          // Payment history is changed only by the ledger-backed payment methods.
          paymentHistory: emi.paymentHistory,
          paidInstallments: emi.paidInstallments,
          legacyPaidInstallments: emi.legacyPaidInstallments,
        }) : emi)),
      })),
    [persist]
  );
  const deleteEMI = useCallback(
    (id: string) => persist(prev => ledgerService.deleteDomainSource(prev, "emi", id)),
    [persist]
  );
  const recordEMIPayment = useCallback(
    (id: string, payment: Omit<EMIPayment, "id" | "status">): boolean => {
      try { return attempt(prev => ledgerService.confirmEMIPayment(prev, id, payment)); }
      catch { return false; }
    },
    [attempt]
  );
  const updateEMIPayment = useCallback(
    (emiId: string, paymentId: string, updates: Partial<Pick<EMIPayment, "amount" | "date" | "notes" | "accountId">>): boolean =>
      attempt(prev => ledgerService.updateEMIPayment(prev, emiId, paymentId, updates)),
    [attempt]
  );
  const deleteEMIPayment = useCallback(
    (emiId: string, paymentId: string): boolean =>
      attempt(prev => ledgerService.reverseEMIPayment(prev, emiId, paymentId)),
    [attempt]
  );

  const addLoan = useCallback(
    (loan: Omit<Loan, "id">, funding?: { id: string; accountId?: string; date: string }) =>
      attempt((prev) => {
        const id = funding?.id ?? genId();
        if (prev.loans.some(l => l.id === id)) return prev;
        const next = { ...prev, loans: [...prev.loans, normalizeLoan({ ...loan, currency: loan.currency ?? prev.currency, id })] };
        return funding ? ledgerService.recordLoanFunding(next, id, funding) : next;
      }),
    [attempt]
  );
  const updateLoan = useCallback(
    (id: string, updates: Partial<Loan>): boolean => {
      const existing = stateRef.current.loans.find((loan) => loan.id === id);
      if (!existing) return false;
      if ((existing.payments.length > 0 || existing.funding) && updates.direction && updates.direction !== existing.direction) return false;
      const updated = normalizeLoan({ ...existing, ...updates, id, payments: existing.payments });
      if (wouldLoanBeOverpaid(updated)) return false;
      persist((prev) => ({ ...prev, loans: prev.loans.map((loan) => loan.id === id ? updated : loan) }));
      return true;
    },
    [persist, state.loans]
  );
  const deleteLoan = useCallback(
    (id: string) => persist(prev => ledgerService.deleteDomainSource(prev, "loan", id)),
    [persist]
  );
  const recordLoanPayment = useCallback(
    (id: string, payment: Omit<LoanPayment, "id">): boolean => {
      try { return attempt(prev => ledgerService.confirmLoanPayment(prev, id, payment)); }
      catch { return false; }
    },
    [attempt]
  );
  const updateLoanPayment = useCallback(
    (loanId: string, paymentId: string, updates: Partial<Pick<LoanPayment, "amount" | "date" | "notes" | "accountId">>): boolean =>
      attempt(prev => ledgerService.updateLoanPayment(prev, loanId, paymentId, updates)),
    [attempt]
  );
  const deleteLoanPayment = useCallback(
    (loanId: string, paymentId: string): boolean =>
      attempt(prev => ledgerService.reverseLoanPayment(prev, loanId, paymentId)),
    [attempt]
  );

  const addAccount = useCallback(
    (a: Omit<Account, "id">) =>
      persist((prev) => ({ ...prev, accounts: [...prev.accounts, { ...a, id: genId(), openingBalance: a.openingBalance ?? a.balance, currency: a.currency ?? prev.currency }] })),
    [persist]
  );
  const updateAccount = useCallback(
    (id: string, updates: Partial<Account>) =>
      persist((prev) => {
        if (updates.currency || updates.balance !== undefined || updates.openingBalance !== undefined) {
          throw new Error("Use balance reconciliation to correct an existing account. Opening balances and currency are protected.");
        }
        return { ...prev, accounts: prev.accounts.map((acc) => (acc.id === id ? { ...acc, ...updates, id } : acc)) };
      }),
    [persist]
  );
  const deleteAccount = useCallback(
    (id: string): boolean => attempt(prev => ledgerService.deleteAccount(prev, id)),
    [attempt]
  );

  const addIncome = useCallback(
    (i: Omit<Income, "id"> & { id?: string }) =>
      persist(prev => ledgerService.saveIncome(prev, { ...i, id: i.id ?? genId() })),
    [persist]
  );
  const deleteIncome = useCallback(
    (id: string) => persist(prev => ledgerService.deleteDomainSource(prev, "income", id)),
    [persist]
  );
  const updateIncome = useCallback(
    (id: string, updates: Partial<Income>) => persist(prev => {
      const income = prev.incomes.find(i => i.id === id);
      if (!income) throw new Error("Income no longer exists.");
      return ledgerService.saveIncome(prev, { ...income, ...updates, id });
    }), [persist]
  );

  const addSavingsGoal = useCallback(
    (g: Omit<SavingsGoal, "id">) =>
      persist((prev) => ({ ...prev, savingsGoals: [...prev.savingsGoals, { ...g, currency: g.currency ?? prev.currency, id: genId() }] })),
    [persist]
  );
  const updateSavingsGoal = useCallback(
    (id: string, updates: Partial<Omit<SavingsGoal, "id" | "savedAmount" | "currency">>) =>
      persist((prev) => {
        if ("savedAmount" in updates || "currency" in updates) throw new Error("Use a recorded savings contribution to change saved money.");
        return { ...prev, savingsGoals: prev.savingsGoals.map(g => g.id === id ? { ...g, ...updates, id } : g) };
      }),
    [persist]
  );
  const deleteSavingsGoal = useCallback(
    (id: string) => persist(prev => ledgerService.deleteDomainSource(prev, "savings_goal", id)),
    [persist]
  );

  const setMonthlyBudget = useCallback(
    (amount: number) => persist(prev => budgets.saveBudget(prev, localDate().slice(0, 7),
      { ...budgets.getBudgetView(prev).period, limit: amount })),
    [persist]
  );
  const setUserName = useCallback(
    (name: string) => persist((prev) => ({ ...prev, userName: name })),
    [persist]
  );
  const setCurrency = useCallback(
    (currency: string) => persist((prev) => ({ ...prev, currency })),
    [persist]
  );
  const setNotificationSettings = useCallback(
    (notificationSettings: NotificationSettings) => persist((prev) => ({ ...prev, notificationSettings })),
    [persist]
  );
  const setSecuritySettings = useCallback(
    async (securitySettings: SecuritySettings) => {
      if (!readyRef.current) throw new Error("Finance storage is unavailable. Retry before changing security settings.");
      const previousSecuritySettings = stateRef.current.securitySettings;
      const next = { ...stateRef.current, securitySettings };
      stateRef.current = next;
      setState(next);
      try {
        await queueWrite(next);
        readyRef.current = true;
        setStorageError(null);
      } catch {
        const recovered = {
          ...stateRef.current,
          securitySettings: previousSecuritySettings,
        };
        stateRef.current = recovered;
        setState(recovered);
        readyRef.current = false;
        setStorageError("Security settings could not be saved. Keep the app open and retry safely.");
        throw new Error("Security settings could not be saved. Retry safely before leaving this screen.");
      }
    },
    [queueWrite]
  );
  const validateFinanceRestore = useCallback((candidate: unknown): FinanceState => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error("The selected backup does not contain a finance document.");
    }
    assertBackupFinanceCompleteness(candidate);
    const serialized = JSON.stringify(candidate);
    if (!serialized) throw new Error("The selected backup contains an unreadable finance document.");
    const restored = migrateFinanceState(serialized, defaultState);
    const safeState = { ...restored, securitySettings: stateRef.current.securitySettings };
    for (const account of ledgerService.balances(safeState)) {
      if (!Number.isFinite(account.balance)) throw new Error("A restored account balance could not be verified.");
    }
    return safeState;
  }, []);
  const restoreFinanceState = useCallback(async (
    candidate: unknown,
    themeMode?: "system" | "light" | "dark",
  ) => {
    if (!readyRef.current) throw new Error("Finance storage is unavailable. Retry before restoring a backup.");
    const restored = validateFinanceRestore(candidate);
    readyRef.current = false;
    let journalPrepared = false;
    try {
      // Drain earlier writes before capturing the protected pre-restore state.
      await queueWrite(stateRef.current);
      const [originalFinance, originalTheme] = await Promise.all([
        AsyncStorage.getItem("@finance_state_v4"),
        AsyncStorage.getItem("@finance_theme_v1"),
      ]);
      await createProtectedRestoreJournal(financeStorageAdapter, originalFinance, originalTheme);
      journalPrepared = true;
      await AsyncStorage.setItem("@finance_state_v4", JSON.stringify(restored));
      if (themeMode) await AsyncStorage.setItem("@finance_theme_v1", themeMode);
      await commitProtectedRestoreJournal(financeStorageAdapter);
    } catch (error) {
      if (journalPrepared) {
        try {
          await recoverProtectedRestoreJournal(AsyncStorage);
          readyRef.current = true;
          setStorageError(null);
        } catch {
          readyRef.current = false;
          setStorageError("A restore was interrupted. The protected recovery copy is still present. Do not clear app storage; tap Retry safely.");
          throw new Error("Restore did not finish. Keep the app open and use Retry safely to recover the previous records.");
        }
      } else {
        readyRef.current = false;
        setStorageError("Restore could not start safely. Your current records are unchanged; tap Retry safely before continuing.");
      }
      throw new Error(error instanceof Error ? error.message : "Restore did not finish; previous records were retained.");
    }

    stateRef.current = restored;
    setState(restored);
    readyRef.current = true;
    setStorageError(null);
    try {
      await clearProtectedRestoreJournal(financeStorageAdapter);
    } catch {
      // The committed journal is safe to clean on the next startup.
    }
  }, [queueWrite, validateFinanceRestore]);

  const dismissResetInfo = useCallback(() => setMonthResetInfo(null), []);

  const accounts = useMemo(() => ledgerService.balances(state), [state]);
  const transactions = state.transactions ?? [];
  const range = monthRange();
  const actualOverview = useMemo(() => buildAnalyticsReport(state, { ...range, currency: state.currency, includeDebt: true, includeSavings: false }), [state, calendarKey]);
  const monthlyCashFlow = { moneyIn: actualOverview.totals.income, moneyOut: actualOverview.totals.expenses, net: actualOverview.totals.net };
  const totalBalance = accounts.filter(a => a.currency === state.currency).reduce((s, a) => s + minorUnits(a.balance), 0) / 100;
  const totalMonthlyIncome = state.incomes.filter(i => i.kind !== "received" && (i.currency ?? state.currency) === state.currency).reduce((s, i) => s + i.amount, 0);
  const totalMonthlyExpenses = state.expenses.filter(e => (e.currency ?? state.currency) === state.currency).reduce((s, e) => s + e.amount, 0);
  const totalEMIMonthly = state.emis.reduce(
    (s, e) => ((e.currency ?? state.currency) === state.currency && e.paidInstallments < e.totalInstallments ? s + (e.monthlyEMIAmount ?? e.monthlyAmount) : s),
    0
  );
  const currentBudget = budgets.getBudgetView(state);
  const effectiveBudget = currentBudget.period.limit;
  const remainingBudget = currentBudget.remaining;
  const totalSavings = accounts.filter((a) => a.type === "savings" && a.currency === state.currency).reduce((s, a) => s + minorUnits(a.balance), 0) / 100;
  const currencyLoans = state.loans.filter(l => (l.currency ?? state.currency) === state.currency);
  const totalPrincipalBorrowed = currencyLoans.filter((loan) => loan.direction === "borrowed").reduce((sum, loan) => sum + loan.principalAmount, 0);
  const totalPrincipalLent = currencyLoans.filter((loan) => loan.direction === "lent").reduce((sum, loan) => sum + loan.principalAmount, 0);
  const totalRepaidOnBorrowedLoans = currencyLoans.filter((loan) => loan.direction === "borrowed").reduce((sum, loan) => sum + getLoanPaidAmount(loan), 0);
  const totalReceivedOnLentLoans = currencyLoans.filter((loan) => loan.direction === "lent").reduce((sum, loan) => sum + getLoanPaidAmount(loan), 0);
  const outstandingBorrowedBalance = currencyLoans.filter((loan) => loan.direction === "borrowed").reduce((sum, loan) => sum + getLoanOutstandingBalance(loan), 0);
  const outstandingLentBalance = currencyLoans.filter((loan) => loan.direction === "lent").reduce((sum, loan) => sum + getLoanOutstandingBalance(loan), 0);
  const activeLoanCount = currencyLoans.filter((loan) => !isLoanSettled(loan)).length;
  const settledLoanCount = currencyLoans.length - activeLoanCount;

  return (
    <FinanceContext.Provider
      value={{
        ...state,
        calendarKey,
        getBudget, ensureBudgetPeriod, saveBudget, saveRecurring, setRecurringActive,
        deleteRecurring, payRecurring, skipRecurring, getUpcoming, recordScheduledPayment,
        monthlyBudget: effectiveBudget,
        accounts,
        transactions,
        storageError,
        storageRecoveryNotice,
        isReady,
        retryStorage,
        setExpensePaid,
        addTransaction,
        deleteTransaction,
        updateTransaction,
        recordTransfer,
        reconcileAccountBalance,
        contributeToSavings,
        getAccountBalance: (id) => {
          const account = ledgerService.ledgerAccounts(state).find(a => a.id === id);
          return account ? getAccountBalance(account, transactions) : 0;
        },
        getTransactionsByDateRange: (from, to) => getTransactionsByDateRange(transactions, from, to),
        addExpense,
        updateExpense,
        deleteExpense,
        addEMI,
        updateEMI,
        deleteEMI,
        recordEMIPayment,
        updateEMIPayment,
        deleteEMIPayment,
        addLoan,
        updateLoan,
        deleteLoan,
        recordLoanPayment,
        updateLoanPayment,
        deleteLoanPayment,
        addAccount,
        updateAccount,
        deleteAccount,
        addIncome,
        updateIncome,
        deleteIncome,
        addSavingsGoal,
        updateSavingsGoal,
        deleteSavingsGoal,
        setMonthlyBudget,
        setUserName,
        setCurrency,
        setNotificationSettings,
        setSecuritySettings,
        validateFinanceRestore,
        restoreFinanceState,
        getFinanceStateSnapshot: () => stateRef.current,
        monthResetInfo,
        dismissResetInfo,
        totalBalance,
        actualMonthlyIncome: monthlyCashFlow.moneyIn,
        actualMonthlyOutflow: monthlyCashFlow.moneyOut,
        actualMonthlyNet: monthlyCashFlow.net,
        totalMonthlyIncome,
        totalMonthlyExpenses,
        totalEMIMonthly,
        remainingBudget,
        totalSavings,
        totalPrincipalBorrowed,
        totalPrincipalLent,
        totalRepaidOnBorrowedLoans,
        totalReceivedOnLentLoans,
        outstandingBorrowedBalance,
        outstandingLentBalance,
        activeLoanCount,
        settledLoanCount,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinance(): FinanceContextType {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
