import "./_group.css";

import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Bell,
  CheckCircle,
  Clock3,
  Home,
  Layers,
  Monitor,
  Music2,
  Package,
  Shield,
  Smartphone,
  Truck,
  TrendingDown,
  TrendingUp,
  Tv,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";

const currency = "SAR";
const userName = "Manzoor";
const monthlyBudget = 7500;
const accounts = [
  { balance: 12500, type: "bank" },
  { balance: 5200, type: "bank" },
  { balance: 800, type: "cash" },
  { balance: 18000, type: "savings" },
];
const incomes = [15000, 3000];
const expenses = [
  { id: "exp1", name: "Rent", amount: 2000, dueDate: 1, isPaid: true, iconName: "home", color: "#0D9488" },
  { id: "exp2", name: "Netflix", amount: 55, dueDate: 5, isPaid: false, iconName: "tv", color: "#E50914" },
  { id: "exp3", name: "Spotify", amount: 22, dueDate: 8, isPaid: false, iconName: "music", color: "#1DB954" },
  { id: "exp4", name: "STC Internet", amount: 180, dueDate: 10, isPaid: true, iconName: "wifi", color: "#0891B2" },
  { id: "exp5", name: "Electricity", amount: 280, dueDate: 12, isPaid: false, iconName: "zap", color: "#F59E0B" },
  { id: "exp6", name: "Gym Membership", amount: 120, dueDate: 15, isPaid: true, iconName: "activity", color: "#EF4444" },
  { id: "exp7", name: "Car Insurance", amount: 350, dueDate: 20, isPaid: false, iconName: "shield", color: "#3B82F6" },
  { id: "exp8", name: "Amazon Prime", amount: 40, dueDate: 25, isPaid: false, iconName: "package", color: "#FF9900" },
];
const emis = [
  { id: "emi1", name: "iPhone 15 Pro", monthlyAmount: 500, totalInstallments: 8, paidInstallments: 1, color: "#0D9488", iconName: "smartphone" },
  { id: "emi2", name: "MacBook Pro", monthlyAmount: 700, totalInstallments: 8, paidInstallments: 3, color: "#0891B2", iconName: "monitor" },
  { id: "emi3", name: "Toyota Corolla", monthlyAmount: 2000, totalInstallments: 60, paidInstallments: 12, color: "#10B981", iconName: "truck" },
];

const expenseIcons = {
  home: Home,
  tv: Tv,
  music: Music2,
  wifi: Wifi,
  zap: Zap,
  activity: Activity,
  shield: Shield,
  package: Package,
} as const;

const emiIcons = {
  smartphone: Smartphone,
  monitor: Monitor,
  truck: Truck,
} as const;

const insights = [
  { icon: TrendingUp, text: "18% more spent\nthis month", color: "#F59E0B" },
  { icon: Bell, text: "3 payments due\nnext week", color: "#EF4444" },
  { icon: Layers, text: "SAR 117 on\nsubscriptions", color: "#8B5CF6" },
  { icon: TrendingDown, text: "Can save SAR 900\non food delivery", color: "#10B981" },
];

function fmt(amount: number) {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function greeting(name: string) {
  const hour = new Date().getHours();
  if (hour < 12) return `Good Morning, ${name}`;
  if (hour < 17) return `Good Afternoon, ${name}`;
  return `Good Evening, ${name}`;
}

function ExpenseIcon({ name, color }: { name: keyof typeof expenseIcons; color: string }) {
  const Icon = expenseIcons[name];
  return (
    <span className="fa-expense-icon" style={{ color, backgroundColor: `${color}20` }}>
      <Icon size={18} />
    </span>
  );
}

export function Current() {
  const [paidById, setPaidById] = useState<Record<string, boolean>>({});
  const [alertVisible, setAlertVisible] = useState(true);
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const totalMonthlyIncome = incomes.reduce((sum, income) => sum + income, 0);
  const totalMonthlyExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const activeEmis = emis.filter((emi) => emi.paidInstallments < emi.totalInstallments);
  const totalEMIMonthly = activeEmis.reduce((sum, emi) => sum + emi.monthlyAmount, 0);
  const totalSpent = totalMonthlyExpenses + totalEMIMonthly;
  const spentPerc = Math.min(1, totalSpent / monthlyBudget);
  const remaining = Math.max(0, monthlyBudget - totalSpent);
  const remainingPerc = Math.min(1, remaining / monthlyBudget);
  const totalSavings = accounts
    .filter((account) => account.type === "savings")
    .reduce((sum, account) => sum + account.balance, 0);
  const savingsGoal = totalMonthlyIncome * 3;
  const savingsPerc = savingsGoal > 0 ? Math.min(1, totalSavings / savingsGoal) : 0;
  const monthlySavings = Math.max(0, totalMonthlyIncome - totalSpent);
  const monthlySavingsRate = totalMonthlyIncome > 0
    ? Math.round((monthlySavings / totalMonthlyIncome) * 100)
    : 0;
  const remainingColor = spentPerc > 0.85 ? "#EF4444" : spentPerc > 0.65 ? "#F59E0B" : "#10B981";
  const pendingCount = expenses.filter((expense) => !(paidById[expense.id] ?? expense.isPaid)).length;

  return (
    <main className="financeapp-home">
      <div className="fa-scroll">
        <header className="fa-hero">
          <div className="fa-header-row">
            <div>
              <div className="fa-greeting">{greeting(userName)}</div>
              <div className="fa-greeting-subtitle">Here&apos;s your financial summary</div>
            </div>
            <button className="fa-avatar" type="button" aria-label="Settings">
              {userName.charAt(0).toUpperCase()}
            </button>
          </div>

          <section className="fa-balance-card">
            <div className="fa-balance-label">Total Balance</div>
            <div className="fa-balance-amount">{fmt(totalBalance)}</div>
            <div className="fa-balance-divider" />
            <div className="fa-balance-row">
              <div className="fa-balance-item">
                <span className="fa-balance-item-icon"><ArrowDownCircle size={14} color="#34D399" /></span>
                <span className="fa-balance-item-label">Monthly Income</span>
                <span className="fa-balance-item-value">{fmt(totalMonthlyIncome)}</span>
              </div>
              <div className="fa-balance-sep" />
              <div className="fa-balance-item">
                <span className="fa-balance-item-icon"><ArrowUpCircle size={14} color="#F87171" /></span>
                <span className="fa-balance-item-label">Monthly Spent</span>
                <span className="fa-balance-item-value">{fmt(totalSpent)}</span>
              </div>
            </div>
          </section>
        </header>

        <div className="fa-content">
          {alertVisible && spentPerc >= 0.8 && (
            <div className="fa-alert">
              <span className="fa-alert-icon"><AlertTriangle size={18} /></span>
              <div className="fa-alert-copy">
                <div className="fa-alert-title">Heads up</div>
                <div className="fa-alert-body">You&apos;ve used {Math.round(spentPerc * 100)}% of your monthly budget</div>
              </div>
              <button className="fa-dismiss" type="button" aria-label="Dismiss budget alert" onClick={() => setAlertVisible(false)}>
                <X size={16} />
              </button>
            </div>
          )}

          <section className="fa-remaining-card" style={{ borderColor: `${remainingColor}80` }}>
            <div className="fa-remaining-top">
              <div>
                <div className="fa-remaining-label">Remaining this month</div>
                <div className="fa-remaining-amount" style={{ color: remainingColor }}>{fmt(remaining)}</div>
                <div className="fa-remaining-subtitle">of {fmt(monthlyBudget)} budget</div>
              </div>
              <div className="fa-remaining-badge" style={{ backgroundColor: `${remainingColor}20`, color: remainingColor }}>
                {spentPerc > 0.85 ? <AlertTriangle size={20} /> : spentPerc > 0.65 ? <Clock3 size={20} /> : <CheckCircle size={20} />}
                <span className="fa-remaining-badge-text">{Math.round(remainingPerc * 100)}%</span>
              </div>
            </div>
            <div className="fa-remaining-track">
              <div className="fa-remaining-fill" style={{ width: `${Math.min(100, remainingPerc * 100)}%`, backgroundColor: remainingColor }} />
            </div>
            <div className="fa-remaining-cap-row">
              <span className="fa-remaining-cap">Spent {fmt(totalSpent)}</span>
              <span className="fa-remaining-cap">Budget {fmt(monthlyBudget)}</span>
            </div>
          </section>

          <section className="fa-savings-card">
            <div className="fa-savings-header">
              <div className="fa-savings-header-left">
                <span className="fa-savings-icon"><TrendingUp size={18} /></span>
                <div>
                  <div className="fa-savings-title">Savings</div>
                  <div className="fa-savings-subtitle">{monthlySavingsRate}% rate this month</div>
                </div>
              </div>
              <div className="fa-savings-total">{fmt(totalSavings)}</div>
            </div>
            <div className="fa-savings-goal-row">
              <span className="fa-savings-goal-label">Goal progress</span>
              <span className="fa-savings-goal-pct">{Math.round(savingsPerc * 100)}% of {fmt(savingsGoal)}</span>
            </div>
            <div className="fa-savings-track">
              <div className="fa-savings-fill" style={{ width: `${Math.min(100, savingsPerc * 100)}%` }} />
            </div>
            <div className="fa-savings-breakdown-row">
              <div className="fa-savings-breakdown-item">
                <span className="fa-savings-breakdown-label">Saved this month</span>
                <span className="fa-savings-breakdown-value">+{fmt(monthlySavings)}</span>
              </div>
              <div className="fa-savings-breakdown-divider" />
              <div className="fa-savings-breakdown-item">
                <span className="fa-savings-breakdown-label">In savings accounts</span>
                <span className="fa-savings-breakdown-value neutral">{fmt(totalSavings)}</span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="fa-section-title" style={{ marginBottom: 12 }}>Smart Insights</h2>
            <div className="fa-insights-scroll">
              {insights.map(({ icon: Icon, text, color }) => (
                <div className="fa-insight-chip" key={text} style={{ borderColor: `${color}40` }}>
                  <span className="fa-insight-icon-wrap" style={{ color, backgroundColor: `${color}20` }}>
                    <Icon size={16} />
                  </span>
                  <span className="fa-insight-text">{text}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="fa-section-header">
            <h2 className="fa-section-title">This Month</h2>
            <span className="fa-section-count">{pendingCount} pending</span>
          </section>
          <div className="fa-expense-list">
            {expenses.map((expense) => {
              const isPaid = paidById[expense.id] ?? expense.isPaid;
              const suffix = expense.dueDate === 1 ? "st" : expense.dueDate === 2 ? "nd" : expense.dueDate === 3 ? "rd" : "th";
              return (
                <div className="fa-expense-row" key={expense.id}>
                  <ExpenseIcon name={expense.iconName as keyof typeof expenseIcons} color={expense.color} />
                  <div className="fa-expense-info">
                    <div className="fa-expense-name">{expense.name}</div>
                    <div className="fa-expense-due">Due {expense.dueDate}{suffix}</div>
                  </div>
                  <span className="fa-expense-amount">{fmt(expense.amount)}</span>
                  <button
                    type="button"
                    className={`fa-paid-badge ${isPaid ? "paid" : "due"}`}
                    onClick={() => setPaidById((current) => ({ ...current, [expense.id]: !isPaid }))}
                  >
                    {isPaid ? "Paid" : "Due"}
                  </button>
                </div>
              );
            })}
          </div>

          <h2 className="fa-section-title">Active EMIs</h2>
          <div className="fa-emi-list">
            {activeEmis.slice(0, 3).map((emi) => {
              const Icon = emiIcons[emi.iconName as keyof typeof emiIcons];
              const progress = emi.paidInstallments / emi.totalInstallments;
              const remainingInstallments = emi.totalInstallments - emi.paidInstallments;
              return (
                <div className="fa-emi-mini" key={emi.id}>
                  <span className="fa-expense-icon" style={{ backgroundColor: `${emi.color}20`, color: emi.color }}>
                    <Icon size={18} />
                  </span>
                  <div className="fa-emi-mini-info">
                    <div className="fa-emi-mini-header">
                      <span className="fa-expense-name">{emi.name}</span>
                      <span className="fa-expense-amount">{fmt(emi.monthlyAmount)}/mo</span>
                    </div>
                    <div className="fa-progress-bg">
                      <div className="fa-progress-fill" style={{ width: `${Math.min(100, progress * 100)}%`, backgroundColor: emi.color }} />
                    </div>
                    <div className="fa-emi-caption">{emi.paidInstallments}/{emi.totalInstallments} paid · {remainingInstallments} left</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
