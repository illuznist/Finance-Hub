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

interface FinanceState {
  userName: string;
  currency: string;
  monthlyBudget: number;
  expenses: Expense[];
  emis: EMI[];
  accounts: Account[];
  incomes: Income[];
}

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
  setMonthlyBudget: (amount: number) => void;
  setUserName: (name: string) => void;
  totalBalance: number;
  totalMonthlyIncome: number;
  totalMonthlyExpenses: number;
  totalEMIMonthly: number;
  remainingBudget: number;
}

const defaultState: FinanceState = {
  userName: "Manzoor",
  currency: "SAR",
  monthlyBudget: 8000,
  expenses: [
    {
      id: "exp1",
      name: "Rent",
      category: "Housing",
      amount: 2000,
      dueDate: 1,
      isPaid: true,
      iconName: "home",
      color: "#4F46E5",
    },
    {
      id: "exp2",
      name: "Netflix",
      category: "Entertainment",
      amount: 55,
      dueDate: 5,
      isPaid: false,
      iconName: "tv",
      color: "#E50914",
    },
    {
      id: "exp3",
      name: "Spotify",
      category: "Entertainment",
      amount: 22,
      dueDate: 8,
      isPaid: false,
      iconName: "music",
      color: "#1DB954",
    },
    {
      id: "exp4",
      name: "STC Internet",
      category: "Bills",
      amount: 180,
      dueDate: 10,
      isPaid: true,
      iconName: "wifi",
      color: "#007DBF",
    },
    {
      id: "exp5",
      name: "Electricity",
      category: "Bills",
      amount: 280,
      dueDate: 12,
      isPaid: false,
      iconName: "zap",
      color: "#F59E0B",
    },
    {
      id: "exp6",
      name: "Gym Membership",
      category: "Health",
      amount: 120,
      dueDate: 15,
      isPaid: true,
      iconName: "activity",
      color: "#EF4444",
    },
    {
      id: "exp7",
      name: "Car Insurance",
      category: "Transport",
      amount: 350,
      dueDate: 20,
      isPaid: false,
      iconName: "shield",
      color: "#3B82F6",
    },
    {
      id: "exp8",
      name: "Amazon Prime",
      category: "Entertainment",
      amount: 40,
      dueDate: 25,
      isPaid: false,
      iconName: "package",
      color: "#FF9900",
    },
  ],
  emis: [
    {
      id: "emi1",
      name: "iPhone 15 Pro",
      totalAmount: 4000,
      monthlyAmount: 500,
      totalInstallments: 8,
      paidInstallments: 1,
      startMonth: "2025-01",
      dueDayOfMonth: 7,
      color: "#6366F1",
      iconName: "smartphone",
    },
    {
      id: "emi2",
      name: "MacBook Pro",
      totalAmount: 5600,
      monthlyAmount: 700,
      totalInstallments: 8,
      paidInstallments: 3,
      startMonth: "2024-11",
      dueDayOfMonth: 7,
      color: "#8B5CF6",
      iconName: "monitor",
    },
    {
      id: "emi3",
      name: "Toyota Corolla",
      totalAmount: 120000,
      monthlyAmount: 2000,
      totalInstallments: 60,
      paidInstallments: 12,
      startMonth: "2024-02",
      dueDayOfMonth: 1,
      color: "#10B981",
      iconName: "truck",
    },
  ],
  accounts: [
    {
      id: "acc1",
      name: "Al Rajhi Bank",
      balance: 12500,
      type: "bank",
      color: "#4F46E5",
    },
    {
      id: "acc2",
      name: "SNB Account",
      balance: 5200,
      type: "bank",
      color: "#10B981",
    },
    {
      id: "acc3",
      name: "Cash Wallet",
      balance: 800,
      type: "cash",
      color: "#F59E0B",
    },
    {
      id: "acc4",
      name: "Savings Account",
      balance: 18000,
      type: "savings",
      color: "#8B5CF6",
    },
  ],
  incomes: [
    {
      id: "inc1",
      name: "Monthly Salary",
      amount: 15000,
      type: "salary",
      color: "#4F46E5",
    },
    {
      id: "inc2",
      name: "Freelance Design",
      amount: 3000,
      type: "freelance",
      color: "#10B981",
    },
  ],
};

const STORAGE_KEY = "@finance_state_v2";

const FinanceContext = createContext<FinanceContextType | null>(null);

function genId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinanceState>(defaultState);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as FinanceState;
          setState(parsed);
        } catch {
          // ignore
        }
      }
    });
  }, []);

  const persist = useCallback((newState: FinanceState) => {
    setState(newState);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newState)).catch(() => {});
  }, []);

  const addExpense = useCallback(
    (e: Omit<Expense, "id">) => {
      const newState = {
        ...state,
        expenses: [...state.expenses, { ...e, id: genId() }],
      };
      persist(newState);
    },
    [state, persist]
  );

  const updateExpense = useCallback(
    (id: string, updates: Partial<Expense>) => {
      const newState = {
        ...state,
        expenses: state.expenses.map((exp) =>
          exp.id === id ? { ...exp, ...updates } : exp
        ),
      };
      persist(newState);
    },
    [state, persist]
  );

  const deleteExpense = useCallback(
    (id: string) => {
      const newState = {
        ...state,
        expenses: state.expenses.filter((e) => e.id !== id),
      };
      persist(newState);
    },
    [state, persist]
  );

  const toggleExpensePaid = useCallback(
    (id: string) => {
      const newState = {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === id ? { ...e, isPaid: !e.isPaid } : e
        ),
      };
      persist(newState);
    },
    [state, persist]
  );

  const addEMI = useCallback(
    (e: Omit<EMI, "id">) => {
      const newState = {
        ...state,
        emis: [...state.emis, { ...e, id: genId() }],
      };
      persist(newState);
    },
    [state, persist]
  );

  const updateEMI = useCallback(
    (id: string, updates: Partial<EMI>) => {
      const newState = {
        ...state,
        emis: state.emis.map((emi) =>
          emi.id === id ? { ...emi, ...updates } : emi
        ),
      };
      persist(newState);
    },
    [state, persist]
  );

  const deleteEMI = useCallback(
    (id: string) => {
      const newState = {
        ...state,
        emis: state.emis.filter((e) => e.id !== id),
      };
      persist(newState);
    },
    [state, persist]
  );

  const markEMIPaid = useCallback(
    (id: string) => {
      const newState = {
        ...state,
        emis: state.emis.map((emi) =>
          emi.id === id && emi.paidInstallments < emi.totalInstallments
            ? { ...emi, paidInstallments: emi.paidInstallments + 1 }
            : emi
        ),
      };
      persist(newState);
    },
    [state, persist]
  );

  const addAccount = useCallback(
    (a: Omit<Account, "id">) => {
      const newState = {
        ...state,
        accounts: [...state.accounts, { ...a, id: genId() }],
      };
      persist(newState);
    },
    [state, persist]
  );

  const updateAccount = useCallback(
    (id: string, updates: Partial<Account>) => {
      const newState = {
        ...state,
        accounts: state.accounts.map((acc) =>
          acc.id === id ? { ...acc, ...updates } : acc
        ),
      };
      persist(newState);
    },
    [state, persist]
  );

  const deleteAccount = useCallback(
    (id: string) => {
      const newState = {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== id),
      };
      persist(newState);
    },
    [state, persist]
  );

  const addIncome = useCallback(
    (i: Omit<Income, "id">) => {
      const newState = {
        ...state,
        incomes: [...state.incomes, { ...i, id: genId() }],
      };
      persist(newState);
    },
    [state, persist]
  );

  const deleteIncome = useCallback(
    (id: string) => {
      const newState = {
        ...state,
        incomes: state.incomes.filter((i) => i.id !== id),
      };
      persist(newState);
    },
    [state, persist]
  );

  const setMonthlyBudget = useCallback(
    (amount: number) => {
      persist({ ...state, monthlyBudget: amount });
    },
    [state, persist]
  );

  const setUserName = useCallback(
    (name: string) => {
      persist({ ...state, userName: name });
    },
    [state, persist]
  );

  const totalBalance = state.accounts.reduce((s, a) => s + a.balance, 0);
  const totalMonthlyIncome = state.incomes.reduce((s, i) => s + i.amount, 0);
  const totalMonthlyExpenses = state.expenses.reduce((s, e) => s + e.amount, 0);
  const totalEMIMonthly = state.emis.reduce(
    (s, e) =>
      e.paidInstallments < e.totalInstallments ? s + e.monthlyAmount : s,
    0
  );
  const remainingBudget =
    state.monthlyBudget - totalMonthlyExpenses - totalEMIMonthly;

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
        setMonthlyBudget,
        setUserName,
        totalBalance,
        totalMonthlyIncome,
        totalMonthlyExpenses,
        totalEMIMonthly,
        remainingBudget,
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
