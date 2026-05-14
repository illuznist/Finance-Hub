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
  totalAmount: number;
  monthlyAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  startMonth: string;
  dueDayOfMonth: number;
  color: string;
  iconName: string;
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
            notificationSettings: { ...defaultNotificationSettings, ...(parsed.notificationSettings ?? {}) },
            securitySettings: { ...defaultSecuritySettings, ...(parsed.securitySettings ?? {}) },
            lastResetMonth: parsed.lastResetMonth ?? "",
            lastResetYear: parsed.lastResetYear ?? "",
          };
        } catch {
          // ignore parse errors, keep defaults
        }
      }

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

        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loaded)).catch(() => {});

        if (resetCount > 0) {
          setMonthResetInfo({ count: resetCount, month: monthLabel(nowMonth) });
        }
      }

      setState(loaded);
    });
  }, []);

  const persist = useCallback((newState: FinanceState) => {
    setState(newState);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newState)).catch(() => {});
  }, []);

  const addExpense = useCallback(
    (e: Omit<Expense, "id">) => persist({ ...state, expenses: [...state.expenses, { ...e, id: genId() }] }),
    [state, persist]
  );
  const updateExpense = useCallback(
    (id: string, updates: Partial<Expense>) =>
      persist({ ...state, expenses: state.expenses.map((exp) => (exp.id === id ? { ...exp, ...updates } : exp)) }),
    [state, persist]
  );
  const deleteExpense = useCallback(
    (id: string) => persist({ ...state, expenses: state.expenses.filter((e) => e.id !== id) }),
    [state, persist]
  );
  const toggleExpensePaid = useCallback(
    (id: string) =>
      persist({ ...state, expenses: state.expenses.map((e) => (e.id === id ? { ...e, isPaid: !e.isPaid } : e)) }),
    [state, persist]
  );

  const addEMI = useCallback(
    (e: Omit<EMI, "id">) => persist({ ...state, emis: [...state.emis, { ...e, id: genId() }] }),
    [state, persist]
  );
  const updateEMI = useCallback(
    (id: string, updates: Partial<EMI>) =>
      persist({ ...state, emis: state.emis.map((emi) => (emi.id === id ? { ...emi, ...updates } : emi)) }),
    [state, persist]
  );
  const deleteEMI = useCallback(
    (id: string) => persist({ ...state, emis: state.emis.filter((e) => e.id !== id) }),
    [state, persist]
  );
  const markEMIPaid = useCallback(
    (id: string) =>
      persist({
        ...state,
        emis: state.emis.map((emi) =>
          emi.id === id && emi.paidInstallments < emi.totalInstallments
            ? { ...emi, paidInstallments: emi.paidInstallments + 1 }
            : emi
        ),
      }),
    [state, persist]
  );

  const addAccount = useCallback(
    (a: Omit<Account, "id">) => persist({ ...state, accounts: [...state.accounts, { ...a, id: genId() }] }),
    [state, persist]
  );
  const updateAccount = useCallback(
    (id: string, updates: Partial<Account>) =>
      persist({ ...state, accounts: state.accounts.map((acc) => (acc.id === id ? { ...acc, ...updates } : acc)) }),
    [state, persist]
  );
  const deleteAccount = useCallback(
    (id: string) => persist({ ...state, accounts: state.accounts.filter((a) => a.id !== id) }),
    [state, persist]
  );

  const addIncome = useCallback(
    (i: Omit<Income, "id">) => persist({ ...state, incomes: [...state.incomes, { ...i, id: genId() }] }),
    [state, persist]
  );
  const deleteIncome = useCallback(
    (id: string) => persist({ ...state, incomes: state.incomes.filter((i) => i.id !== id) }),
    [state, persist]
  );

  const addSavingsGoal = useCallback(
    (g: Omit<SavingsGoal, "id">) =>
      persist({ ...state, savingsGoals: [...state.savingsGoals, { ...g, id: genId() }] }),
    [state, persist]
  );
  const updateSavingsGoal = useCallback(
    (id: string, updates: Partial<SavingsGoal>) =>
      persist({
        ...state,
        savingsGoals: state.savingsGoals.map((g) => (g.id === id ? { ...g, ...updates } : g)),
      }),
    [state, persist]
  );
  const deleteSavingsGoal = useCallback(
    (id: string) => persist({ ...state, savingsGoals: state.savingsGoals.filter((g) => g.id !== id) }),
    [state, persist]
  );

  const setMonthlyBudget = useCallback(
    (amount: number) => persist({ ...state, monthlyBudget: amount }),
    [state, persist]
  );
  const setUserName = useCallback(
    (name: string) => persist({ ...state, userName: name }),
    [state, persist]
  );
  const setCurrency = useCallback(
    (currency: string) => persist({ ...state, currency }),
    [state, persist]
  );
  const setNotificationSettings = useCallback(
    (notificationSettings: NotificationSettings) => persist({ ...state, notificationSettings }),
    [state, persist]
  );
  const setSecuritySettings = useCallback(
    (securitySettings: SecuritySettings) => {
      persist({ ...state, securitySettings });
      AsyncStorage.setItem(
        PIN_STORAGE_KEY,
        JSON.stringify({ pinEnabled: securitySettings.pinEnabled, pin: securitySettings.pin })
      ).catch(() => {});
    },
    [state, persist]
  );

  const dismissResetInfo = useCallback(() => setMonthResetInfo(null), []);

  const totalBalance = state.accounts.reduce((s, a) => s + a.balance, 0);
  const totalMonthlyIncome = state.incomes.reduce((s, i) => s + i.amount, 0);
  const totalMonthlyExpenses = state.expenses.reduce((s, e) => s + e.amount, 0);
  const totalEMIMonthly = state.emis.reduce(
    (s, e) => (e.paidInstallments < e.totalInstallments ? s + e.monthlyAmount : s),
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
