import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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
}

export interface EMI {
  id: string;
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
}

export interface Account {
  id: string;
  name: string;
  balance: number;
  type: "bank" | "cash" | "savings";
  color: string;
}

export interface Income {
  id: string;
  name: string;
  amount: number;
  type: "salary" | "freelance" | "other";
  color: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  color: string;
  iconName: string;
  deadline?: string;
}

export interface NotificationSettings {
  enabled: boolean;
  timing: "same" | "1day" | "3days";
  emiEnabled: boolean;
  expenseEnabled: boolean;
  budgetEnabled: boolean;
}

export interface SecuritySettings {
  pinEnabled: boolean;
  pin: string;
  autoLockMinutes: number;
}

interface FinanceState {
  userName: string;
  currency: string;
  monthlyBudget: number;
  expenses: Expense[];
  emis: EMI[];
  accounts: Account[];
  incomes: Income[];
  savingsGoals: SavingsGoal[];
  notificationSettings: NotificationSettings;
  securitySettings: SecuritySettings;
  lastResetMonth: string;
  lastResetYear: string;
}

export const EXCHANGE_RATES: Record<string, number> = {
  SAR: 1,
  USD: 0.2666,
  AED: 0.9788,
  EUR: 0.2451,
  GBP: 0.2108,
  INR: 22.34,
};

export const SUPPORTED_CURRENCIES = [
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR" },
  { code: "USD", name: "US Dollar", symbol: "USD" },
  { code: "AED", name: "UAE Dirham", symbol: "AED" },
  { code: "EUR", name: "Euro", symbol: "EUR" },
  { code: "GBP", name: "British Pound", symbol: "GBP" },
  { code: "INR", name: "Indian Rupee", symbol: "INR" },
];

export const PIN_STORAGE_KEY = "@finance_pin_v1";

interface FinanceContextType extends FinanceState {
  addExpense: (e: Omit<Expense, "id">) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  toggleExpensePaid: (id: string) => void;
  addEMI: (e: Omit<EMI, "id">) => void;
  updateEMI: (id: string, updates: Partial<EMI>) => void;
  deleteEMI: (id: string) => void;
  markEMIPaid: (id: string) => void;
  recordEMIPayment: (id: string, payment: Omit<EMIPayment, "id" | "status">) => boolean;
  updateEMIPayment: (emiId: string, paymentId: string, updates: Partial<Pick<EMIPayment, "amount" | "date" | "notes">>) => boolean;
  deleteEMIPayment: (emiId: string, paymentId: string) => void;
  addAccount: (a: Omit<Account, "id">) => void;
  updateAccount: (id: string, updates: Partial<Account>) => void;
  deleteAccount: (id: string) => void;
  addIncome: (i: Omit<Income, "id">) => void;
  deleteIncome: (id: string) => void;
  addSavingsGoal: (g: Omit<SavingsGoal, "id">) => void;
  updateSavingsGoal: (id: string, updates: Partial<SavingsGoal>) => void;
  deleteSavingsGoal: (id: string) => void;
  setMonthlyBudget: (amount: number) => void;
  setUserName: (name: string) => void;
  setCurrency: (currency: string) => void;
  setNotificationSettings: (s: NotificationSettings) => void;
  setSecuritySettings: (s: SecuritySettings) => void;
  monthResetInfo: { count: number; month: string } | null;
  dismissResetInfo: () => void;
  totalBalance: number;
  totalMonthlyIncome: number;
  totalMonthlyExpenses: number;
  totalEMIMonthly: number;
  remainingBudget: number;
  totalSavings: number;
  currencyRate: number;
}

const defaultNotificationSettings: NotificationSettings = {
  enabled: true,
  timing: "1day",
  emiEnabled: true,
  expenseEnabled: true,
  budgetEnabled: true,
};

const defaultSecuritySettings: SecuritySettings = {
  pinEnabled: false,
  pin: "",
  autoLockMinutes: 5,
};

const defaultState: FinanceState = {
  userName: "Manzoor",
  currency: "SAR",
  monthlyBudget: 7500,
  expenses: [
    { id: "exp1", name: "Rent", category: "Housing", amount: 2000, dueDate: 1, isPaid: true, iconName: "home", color: "#0D9488", recurrence: "monthly" },
    { id: "exp2", name: "Netflix", category: "Entertainment", amount: 55, dueDate: 5, isPaid: false, iconName: "tv", color: "#E50914", recurrence: "monthly" },
    { id: "exp3", name: "Spotify", category: "Entertainment", amount: 22, dueDate: 8, isPaid: false, iconName: "music", color: "#1DB954", recurrence: "monthly" },
    { id: "exp4", name: "STC Internet", category: "Bills", amount: 180, dueDate: 10, isPaid: true, iconName: "wifi", color: "#0891B2", recurrence: "monthly" },
    { id: "exp5", name: "Electricity", category: "Bills", amount: 280, dueDate: 12, isPaid: false, iconName: "zap", color: "#F59E0B", recurrence: "monthly" },
    { id: "exp6", name: "Gym Membership", category: "Health", amount: 120, dueDate: 15, isPaid: true, iconName: "activity", color: "#EF4444", recurrence: "monthly" },
    { id: "exp7", name: "Car Insurance", category: "Transport", amount: 350, dueDate: 20, isPaid: false, iconName: "shield", color: "#3B82F6", recurrence: "yearly" },
    { id: "exp8", name: "Amazon Prime", category: "Entertainment", amount: 40, dueDate: 25, isPaid: false, iconName: "package", color: "#FF9900", recurrence: "monthly" },
  ],
  emis: [
    { id: "emi1", name: "iPhone 15 Pro", totalAmount: 4000, monthlyAmount: 500, totalInstallments: 8, paidInstallments: 1, startMonth: "2025-01", dueDayOfMonth: 7, color: "#0D9488", iconName: "smartphone" },
    { id: "emi2", name: "MacBook Pro", totalAmount: 5600, monthlyAmount: 700, totalInstallments: 8, paidInstallments: 3, startMonth: "2024-11", dueDayOfMonth: 7, color: "#0891B2", iconName: "monitor" },
    { id: "emi3", name: "Toyota Corolla", totalAmount: 120000, monthlyAmount: 2000, totalInstallments: 60, paidInstallments: 12, startMonth: "2024-02", dueDayOfMonth: 1, color: "#10B981", iconName: "truck" },
  ],
  accounts: [
    { id: "acc1", name: "Al Rajhi Bank", balance: 12500, type: "bank", color: "#0D9488" },
    { id: "acc2", name: "SNB Account", balance: 5200, type: "bank", color: "#0891B2" },
    { id: "acc3", name: "Cash Wallet", balance: 800, type: "cash", color: "#F59E0B" },
    { id: "acc4", name: "Savings Account", balance: 18000, type: "savings", color: "#10B981" },
  ],
  incomes: [
    { id: "inc1", name: "Monthly Salary", amount: 15000, type: "salary", color: "#0D9488" },
    { id: "inc2", name: "Freelance Design", amount: 3000, type: "freelance", color: "#10B981" },
  ],
  savingsGoals: [
    { id: "sg1", name: "Emergency Fund", targetAmount: 45000, savedAmount: 18000, color: "#0D9488", iconName: "shield", deadline: "2026-06" },
    { id: "sg2", name: "Vacation", targetAmount: 10000, savedAmount: 3500, color: "#0891B2", iconName: "map", deadline: "2025-12" },
    { id: "sg3", name: "New Car", targetAmount: 60000, savedAmount: 12000, color: "#F59E0B", iconName: "truck" },
  ],
  notificationSettings: defaultNotificationSettings,
  securitySettings: defaultSecuritySettings,
  lastResetMonth: "",
  lastResetYear: "",
};

const STORAGE_KEY = "@finance_state_v4";

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

function isStoredDateValid(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
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
    ? emi.paymentHistory.filter((payment) =>
      payment &&
      typeof payment.id === "string" &&
      Number.isFinite(Number(payment.amount)) &&
      Number(payment.amount) >= 0 &&
      (payment.paymentType === "monthly_emi" || payment.paymentType === "balloon")
    )
    : [];

  // Older records stored only a paid-installment count. Preserve it as dated
  // history entries so future corrections/deletions remain fully trackable.
  if (!Array.isArray(emi.paymentHistory) && paidCount > 0) {
    paymentHistory = Array.from({ length: paidCount }, (_, index) => ({
      id: `imported-${emi.id}-${index + 1}`,
      amount: monthlyAmount,
      date: dateAtMonthOffset(firstPaymentDate, index, dueDay),
      paymentType: "monthly_emi" as const,
      status: "paid" as const,
      notes: "Imported from previous installment count",
    }));
  }

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
    createdAt: emi.createdAt || new Date().toISOString(),
    totalAmount: financedAmount,
    monthlyAmount,
    totalInstallments,
    paidInstallments: Math.min(totalInstallments, monthlyPaidCount || (paymentHistory.length === 0 ? paidCount : 0)),
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
  const [monthResetInfo, setMonthResetInfo] = useState<{ count: number; month: string } | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      let loaded: FinanceState = defaultState;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<FinanceState>;
          loaded = {
            ...defaultState,
            ...parsed,
            emis: (Array.isArray(parsed.emis) ? parsed.emis : defaultState.emis).map(normalizeEMI),
            notificationSettings: { ...defaultNotificationSettings, ...(parsed.notificationSettings ?? {}) },
            securitySettings: { ...defaultSecuritySettings, ...(parsed.securitySettings ?? {}) },
            lastResetMonth: parsed.lastResetMonth ?? "",
            lastResetYear: parsed.lastResetYear ?? "",
          };
        } catch {
          // ignore parse errors, keep defaults
        }
      }
      loaded = { ...loaded, emis: loaded.emis.map(normalizeEMI) };

      // ── Recurring reset engine ──
      const nowMonth = currentYYYYMM();
      const nowYear = currentYYYY();
      const isNewMonth = loaded.lastResetMonth !== nowMonth;
      const isNewYear = loaded.lastResetYear !== nowYear;

      if (isNewMonth || isNewYear) {
        let resetCount = 0;
        const updatedExpenses = loaded.expenses.map((e) => {
          const rec = e.recurrence ?? "none";
          const shouldReset =
            (rec === "monthly" && isNewMonth) ||
            (rec === "weekly" && isNewMonth) ||
            (rec === "yearly" && isNewYear);
          if (shouldReset) {
            resetCount++;
            return { ...e, isPaid: false };
          }
          return e;
        });

        loaded = {
          ...loaded,
          expenses: updatedExpenses,
          lastResetMonth: isNewMonth ? nowMonth : loaded.lastResetMonth,
          lastResetYear: isNewYear ? nowYear : loaded.lastResetYear,
        };

        if (resetCount > 0) {
          setMonthResetInfo({ count: resetCount, month: monthLabel(nowMonth) });
        }
      }

      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loaded)).catch(() => {});
      setState(loaded);
    });
  }, []);

  const persist = useCallback((updater: (prev: FinanceState) => FinanceState) => {
    setState((prev) => {
      const next = updater(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const addExpense = useCallback(
    (e: Omit<Expense, "id">) =>
      persist((prev) => ({ ...prev, expenses: [...prev.expenses, { ...e, id: genId() }] })),
    [persist]
  );
  const updateExpense = useCallback(
    (id: string, updates: Partial<Expense>) =>
      persist((prev) => ({ ...prev, expenses: prev.expenses.map((exp) => (exp.id === id ? { ...exp, ...updates } : exp)) })),
    [persist]
  );
  const deleteExpense = useCallback(
    (id: string) => persist((prev) => ({ ...prev, expenses: prev.expenses.filter((e) => e.id !== id) })),
    [persist]
  );
  const toggleExpensePaid = useCallback(
    (id: string) =>
      persist((prev) => ({ ...prev, expenses: prev.expenses.map((e) => (e.id === id ? { ...e, isPaid: !e.isPaid } : e)) })),
    [persist]
  );

  const addEMI = useCallback(
    (e: Omit<EMI, "id">) =>
      persist((prev) => ({ ...prev, emis: [...prev.emis, normalizeEMI({ ...e, id: genId() })] })),
    [persist]
  );
  const updateEMI = useCallback(
    (id: string, updates: Partial<EMI>) =>
      persist((prev) => ({
        ...prev,
        emis: prev.emis.map((emi) => (emi.id === id ? normalizeEMI({ ...emi, ...updates }) : emi)),
      })),
    [persist]
  );
  const deleteEMI = useCallback(
    (id: string) => persist((prev) => ({ ...prev, emis: prev.emis.filter((e) => e.id !== id) })),
    [persist]
  );
  const markEMIPaid = useCallback(
    (id: string) => {
      const emi = state.emis.find((item) => item.id === id);
      if (!emi || emi.paidInstallments >= emi.totalInstallments) return;
      const paymentHistory = emi.paymentHistory ?? [];
      const hasRemaining = emi.totalInstallments - emi.paidInstallments > 0;
      if (!hasRemaining) return;
      persist((prev) => ({
        ...prev,
        emis: prev.emis.map((item) => item.id === id
          ? normalizeEMI({
            ...item,
            paymentHistory: [
              ...(item.paymentHistory ?? []),
              {
                id: genId(),
                amount: item.monthlyEMIAmount ?? item.monthlyAmount,
                date: formatLocalDate(new Date()),
                paymentType: "monthly_emi",
                status: "paid",
              },
            ],
            paidInstallments: (item.paidInstallments ?? 0) + 1,
          })
          : item),
      }));
    },
    [persist, state.emis]
  );
  const recordEMIPayment = useCallback(
    (id: string, payment: Omit<EMIPayment, "id" | "status">): boolean => {
      const emi = state.emis.find((item) => item.id === id);
      if (!emi || !Number.isFinite(payment.amount) || payment.amount <= 0 || !isStoredDateValid(payment.date)) return false;
      if (payment.paymentType === "monthly_emi") {
        const scheduled = emi.monthlyEMIAmount ?? emi.monthlyAmount;
        if (emi.paidInstallments >= emi.totalInstallments || Math.abs(payment.amount - scheduled) > 0.01) return false;
      } else {
        const balloonTotal = emi.balloonPaymentAmount ?? 0;
        const balloonPaid = (emi.paymentHistory ?? [])
          .filter((item) => item.paymentType === "balloon")
          .reduce((sum, item) => sum + item.amount, 0);
        if (balloonTotal <= 0 || payment.amount > balloonTotal - balloonPaid + 0.01) return false;
      }
      persist((prev) => ({
        ...prev,
        emis: prev.emis.map((item) => {
          if (item.id !== id) return item;
          const nextPayments = [
            ...(item.paymentHistory ?? []),
            { ...payment, id: genId(), status: "paid" as const },
          ];
          const count = nextPayments.filter((entry) => entry.paymentType === "monthly_emi").length;
          return normalizeEMI({ ...item, paymentHistory: nextPayments, paidInstallments: count });
        }),
      }));
      return true;
    },
    [persist, state.emis]
  );
  const updateEMIPayment = useCallback(
    (emiId: string, paymentId: string, updates: Partial<Pick<EMIPayment, "amount" | "date" | "notes">>): boolean => {
      const emi = state.emis.find((item) => item.id === emiId);
      const payment = emi?.paymentHistory?.find((item) => item.id === paymentId);
      if (!emi || !payment) return false;
      const nextAmount = updates.amount ?? payment.amount;
      const nextDate = updates.date ?? payment.date;
      if (!Number.isFinite(nextAmount) || nextAmount <= 0 || !isStoredDateValid(nextDate)) return false;
      const history = emi.paymentHistory ?? [];
      if (payment.paymentType === "monthly_emi" && Math.abs(nextAmount - (emi.monthlyEMIAmount ?? emi.monthlyAmount)) > 0.01) return false;
      if (payment.paymentType === "balloon") {
        const otherBalloonPayments = history
          .filter((item) => item.paymentType === "balloon" && item.id !== paymentId)
          .reduce((sum, item) => sum + item.amount, 0);
        if (nextAmount + otherBalloonPayments > (emi.balloonPaymentAmount ?? 0) + 0.01) return false;
      }
      persist((prev) => ({
        ...prev,
        emis: prev.emis.map((item) => {
          if (item.id !== emiId) return item;
          const nextPayments = (item.paymentHistory ?? []).map((entry) =>
            entry.id === paymentId ? { ...entry, ...updates } : entry
          );
          return normalizeEMI({
            ...item,
            paymentHistory: nextPayments,
            paidInstallments: nextPayments.filter((entry) => entry.paymentType === "monthly_emi").length,
          });
        }),
      }));
      return true;
    },
    [persist, state.emis]
  );
  const deleteEMIPayment = useCallback(
    (emiId: string, paymentId: string) =>
      persist((prev) => ({
        ...prev,
        emis: prev.emis.map((item) => {
          if (item.id !== emiId) return item;
          const paymentHistory = (item.paymentHistory ?? []).filter((entry) => entry.id !== paymentId);
          return normalizeEMI({
            ...item,
            paymentHistory,
            paidInstallments: paymentHistory.filter((entry) => entry.paymentType === "monthly_emi").length,
          });
        }),
      })),
    [persist]
  );

  const addAccount = useCallback(
    (a: Omit<Account, "id">) =>
      persist((prev) => ({ ...prev, accounts: [...prev.accounts, { ...a, id: genId() }] })),
    [persist]
  );
  const updateAccount = useCallback(
    (id: string, updates: Partial<Account>) =>
      persist((prev) => ({ ...prev, accounts: prev.accounts.map((acc) => (acc.id === id ? { ...acc, ...updates } : acc)) })),
    [persist]
  );
  const deleteAccount = useCallback(
    (id: string) => persist((prev) => ({
      ...prev,
      accounts: prev.accounts.filter((a) => a.id !== id),
      emis: prev.emis.map((emi) => emi.linkedAccountId === id ? { ...emi, linkedAccountId: undefined } : emi),
    })),
    [persist]
  );

  const addIncome = useCallback(
    (i: Omit<Income, "id">) =>
      persist((prev) => ({ ...prev, incomes: [...prev.incomes, { ...i, id: genId() }] })),
    [persist]
  );
  const deleteIncome = useCallback(
    (id: string) => persist((prev) => ({ ...prev, incomes: prev.incomes.filter((i) => i.id !== id) })),
    [persist]
  );

  const addSavingsGoal = useCallback(
    (g: Omit<SavingsGoal, "id">) =>
      persist((prev) => ({ ...prev, savingsGoals: [...prev.savingsGoals, { ...g, id: genId() }] })),
    [persist]
  );
  const updateSavingsGoal = useCallback(
    (id: string, updates: Partial<SavingsGoal>) =>
      persist((prev) => ({
        ...prev,
        savingsGoals: prev.savingsGoals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
      })),
    [persist]
  );
  const deleteSavingsGoal = useCallback(
    (id: string) => persist((prev) => ({ ...prev, savingsGoals: prev.savingsGoals.filter((g) => g.id !== id) })),
    [persist]
  );

  const setMonthlyBudget = useCallback(
    (amount: number) => persist((prev) => ({ ...prev, monthlyBudget: amount })),
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
    (securitySettings: SecuritySettings) => {
      persist((prev) => ({ ...prev, securitySettings }));
      AsyncStorage.setItem(
        PIN_STORAGE_KEY,
        JSON.stringify({ pinEnabled: securitySettings.pinEnabled, pin: securitySettings.pin })
      ).catch(() => {});
    },
    [persist]
  );

  const dismissResetInfo = useCallback(() => setMonthResetInfo(null), []);

  const totalBalance = state.accounts.reduce((s, a) => s + a.balance, 0);
  const totalMonthlyIncome = state.incomes.reduce((s, i) => s + i.amount, 0);
  const totalMonthlyExpenses = state.expenses.reduce((s, e) => s + e.amount, 0);
  const totalEMIMonthly = state.emis.reduce(
    (s, e) => (e.paidInstallments < e.totalInstallments ? s + (e.monthlyEMIAmount ?? e.monthlyAmount) : s),
    0
  );
  const remainingBudget = state.monthlyBudget - totalMonthlyExpenses - totalEMIMonthly;
  const totalSavings = state.accounts.filter((a) => a.type === "savings").reduce((s, a) => s + a.balance, 0);
  const currencyRate = EXCHANGE_RATES[state.currency] ?? 1;

  return (
    <FinanceContext.Provider
      value={{
        ...state,
        addExpense,
        updateExpense,
        deleteExpense,
        toggleExpensePaid,
        addEMI,
        updateEMI,
        deleteEMI,
        markEMIPaid,
        recordEMIPayment,
        updateEMIPayment,
        deleteEMIPayment,
        addAccount,
        updateAccount,
        deleteAccount,
        addIncome,
        deleteIncome,
        addSavingsGoal,
        updateSavingsGoal,
        deleteSavingsGoal,
        setMonthlyBudget,
        setUserName,
        setCurrency,
        setNotificationSettings,
        setSecuritySettings,
        monthResetInfo,
        dismissResetInfo,
        totalBalance,
        totalMonthlyIncome,
        totalMonthlyExpenses,
        totalEMIMonthly,
        remainingBudget,
        totalSavings,
        currencyRate,
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
