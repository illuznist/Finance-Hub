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

export function Refined() {
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
    <main className="financeapp-home financeapp-refined">
      <style>{`
        .financeapp-refined { --fa-background:#f2f6fc; --fa-card:#fff; --fa-foreground:#152b4a; --fa-muted:#eaf0f8; --fa-muted-foreground:#71829a; --fa-border:#e2eaf4; }
        .financeapp-refined .fa-scroll { min-height:100dvh; padding-bottom:40px; }
        .financeapp-refined .fa-hero { padding:28px 20px 25px; background:linear-gradient(145deg,#164a91 0%,#2369c7 100%); }
        .financeapp-refined .fa-header-row { align-items:flex-start; margin-bottom:22px; }
        .financeapp-refined .fa-brand-row { display:flex; align-items:center; gap:8px; margin-bottom:19px; }
        .financeapp-refined .fa-brand-icon { width:23px; height:23px; border-radius:7px; object-fit:cover; }
        .financeapp-refined .fa-brand-name { color:rgba(255,255,255,.9); font-size:13px; font-weight:650; letter-spacing:.15px; }
        .financeapp-refined .fa-greeting { font-size:24px; letter-spacing:-.45px; }
        .financeapp-refined .fa-date { display:block; margin-bottom:5px; color:rgba(255,255,255,.68); font-size:12px; font-weight:600; letter-spacing:.65px; text-transform:uppercase; }
        .financeapp-refined .fa-greeting-subtitle { margin-top:5px; color:rgba(255,255,255,.76); }
        .financeapp-refined .fa-avatar { width:38px; height:38px; border:1px solid rgba(255,255,255,.3); background:rgba(255,255,255,.16); cursor:pointer; }
        .financeapp-refined .fa-balance-card { padding:19px; border:1px solid rgba(255,255,255,.26); border-radius:18px; background:rgba(255,255,255,.13); box-shadow:0 12px 24px rgba(8,43,91,.13); }
        .financeapp-refined .fa-balance-label { letter-spacing:1px; }
        .financeapp-refined .fa-balance-amount { font-size:34px; letter-spacing:-1.1px; font-variant-numeric:tabular-nums; }
        .financeapp-refined .fa-content { gap:14px; padding:17px 16px 30px; }
        .financeapp-refined .fa-alert { border:1px solid #f0cf86; background:#fff8e8; }
        .financeapp-refined .fa-alert-icon { color:#a96b08; background:#f6dfac; }
        .financeapp-refined .fa-alert-title { color:#8e5b07; font-size:14px; }
        .financeapp-refined .fa-alert-body { color:#866b3e; }
        .financeapp-refined .fa-dismiss { color:#9c8256; }
        .financeapp-refined .fa-remaining-card,.financeapp-refined .fa-savings-card { border-radius:17px; box-shadow:0 3px 12px rgba(27,63,108,.035); }
        .financeapp-refined .fa-remaining-card { padding:16px; }
        .financeapp-refined .fa-remaining-amount { font-size:29px; letter-spacing:-.7px; }
        .financeapp-refined .fa-remaining-track { height:8px; border-radius:8px; background:#e9eff6; }
        .financeapp-refined .fa-remaining-fill { height:8px; border-radius:8px; }
        .financeapp-refined .fa-savings-card { padding:16px; gap:11px; }
        .financeapp-refined .fa-savings-icon { color:#2569bc; background:#e8f1fd; }
        .financeapp-refined .fa-savings-total { color:#2465b4; font-size:18px; }
        .financeapp-refined .fa-savings-fill { background:#3479cb; }
        .financeapp-refined .fa-section-title { font-size:18px; letter-spacing:-.2px; }
        .financeapp-refined .fa-insights-scroll { margin-bottom:6px; }
        .financeapp-refined .fa-insight-chip { width:137px; flex-basis:137px; padding:12px; border-radius:13px; }
        .financeapp-refined .fa-expense-row,.financeapp-refined .fa-emi-mini { border-color:#e5ebf3; border-radius:13px; box-shadow:0 2px 8px rgba(27,63,108,.025); }
        .financeapp-refined .fa-expense-row { gap:10px; padding:12px 11px; }
        .financeapp-refined .fa-expense-icon { width:36px; height:36px; flex-basis:36px; }
        .financeapp-refined .fa-expense-name { font-size:14px; }
        .financeapp-refined .fa-expense-amount { font-size:13px; }
        .financeapp-refined .fa-paid-badge { padding:5px 9px; }
        .financeapp-refined .fa-emi-mini { padding:12px; }
        @media (max-width:360px) {
          .financeapp-refined .fa-hero { padding-right:16px; padding-left:16px; }
          .financeapp-refined .fa-content { padding-right:13px; padding-left:13px; }
          .financeapp-refined .fa-savings-header { align-items:flex-start; flex-direction:column; gap:8px; }
        }
      `}</style>
      <div className="fa-scroll">
        <header className="fa-hero">
          <div className="fa-brand-row">
            <img className="fa-brand-icon" src="/__mockup/images/financeapp-icon.png" alt="" />
            <span className="fa-brand-name">FinanceApp</span>
          </div>
          <div className="fa-header-row">
            <div>
              <span className="fa-date">{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</span>
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
