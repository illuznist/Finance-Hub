import type { FinanceState } from "../context/FinanceContext";
import type { BudgetCategory, BudgetPlan, BudgetPeriod, PlanningState } from "./planningTypes";
import { localDate, minorUnits } from "./ledger";
import { monthBounds, shiftMonth, validMonth } from "./calendar";
const defaults: [string, string][] = [
  ["Housing", "home"], ["Groceries", "shopping-cart"], ["Food and Dining", "coffee"],
  ["Transportation", "truck"], ["Fuel", "compass"], ["Shopping", "shopping-bag"],
  ["Entertainment", "film"], ["Healthcare", "heart"], ["Utilities", "zap"],
  ["Subscriptions", "repeat"], ["Travel", "map"], ["Education", "book"],
  ["Personal Care", "user"], ["Other", "grid"], ["Debt repayments", "credit-card"], ["Savings", "archive"],
];
export function categoryKey(name: string): string {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ({ food: "foodanddining", dining: "foodanddining", transport: "transportation",
    rent: "housing", bills: "utilities", health: "healthcare", subscription: "subscriptions",
    emi: "debtrepayments", balloonpayment: "debtrepayments", loanpayment: "debtrepayments",
    savingscontribution: "savings" } as Record<string, string>)[key] ?? key;
}
export function defaultCategories(): BudgetCategory[] {
  return defaults.map(([name, icon]) => ({ id: categoryKey(name), name, icon, color: "#2563EB", limit: 0, rollover: false, alerts: true }));
}
export function defaultPlan(currency: string, month: string, limit = 0): BudgetPlan {
  return { currency, startMonth: month, limit, mode: "fixed", categories: defaultCategories(),
    includeEMI: false, includeLoans: false, includeSavings: false, carryDeficit: false, alerts: true, thresholds: [75, 90, 100] };
}
export function initialPlanning(state: Pick<FinanceState, "currency" | "budgetCurrency" | "monthlyBudget">, today = localDate()): PlanningState {
  return { version: 1, plans: [defaultPlan(state.budgetCurrency ?? state.currency, today.slice(0, 7), state.monthlyBudget)],
    periods: [], recurring: [], occurrences: [] };
}
export function budgetStatus(spent: number, limit: number): "normal" | "approaching" | "near" | "exceeded" | "unset" {
  if (limit < 0) return "exceeded";
  if (limit === 0) return "unset";
  const pct = spent / limit;
  return pct >= 1 ? "exceeded" : pct >= .9 ? "near" : pct >= .75 ? "approaching" : "normal";
}
function counted(t: NonNullable<FinanceState["transactions"]>[number], p: BudgetPlan): boolean {
  if (t.currency !== p.currency || t.direction !== "out") return false;
  if (t.type === "expense") return t.referenceType !== "loan";
  if (["emi_payment", "balloon_payment"].includes(t.type)) return p.includeEMI;
  if (t.type === "loan_repayment") return p.includeLoans || p.categories.some(c => c.limit > 0 && categoryKey(c.name) === categoryKey(t.category));
  return t.type === "savings_contribution" && p.includeSavings;
}
export function spending(state: FinanceState, p: BudgetPlan, month: string) {
  const { from, to } = monthBounds(month);
  const transactions = (state.transactions ?? []).filter(t => t.date >= from && t.date <= to && counted(t, p));
  const total = transactions.reduce((s, t) => s + minorUnits(t.amount), 0) / 100;
  const categories: Record<string, number> = {};
  transactions.forEach(t => { const key = categoryKey(t.category); categories[key] = (categories[key] ?? 0) + minorUnits(t.amount); });
  return { total, categories: Object.fromEntries(Object.entries(categories).map(([key, units]) => [key, units / 100])) };
}
function snapshot(plan: BudgetPlan, month: string): BudgetPeriod {
  return { ...plan, categories: plan.categories.map(c => ({ ...c })), id: `${plan.currency}:${month}`, month, baseLimit: plan.limit, carryAmounts: {} };
}
function applyCarry(state: FinanceState, period: BudgetPeriod, previous: BudgetPeriod, finalized: boolean): BudgetPeriod {
  const used = spending(state, previous, previous.month), carryAmounts: Record<string, number> = {};
  const categories = period.categories.map(c => {
    const old = previous.categories.find(o => o.id === c.id);
    const unused = (minorUnits(old?.limit ?? 0) - minorUnits(used.categories[categoryKey(old?.name ?? c.name)] ?? 0)) / 100;
    const carry = c.rollover ? (period.carryDeficit ? unused : Math.max(0, unused)) : 0;
    carryAmounts[c.id] = carry;
    const base = minorUnits(c.limit) - minorUnits(period.carryAmounts[c.id] ?? 0);
    return { ...c, limit: (base + minorUnits(carry)) / 100 };
  });
  return { ...period, categories, carryAmounts, carryFrom: previous.id, carryFinalized: finalized,
    limit: (minorUnits(period.baseLimit) + Object.values(carryAmounts).reduce((s, v) => s + minorUnits(v), 0)) / 100 };
}
/** Future carry stays provisional. Once the period starts it freezes, never re-added on reload. */
export function ensureBudgetPeriod(state: FinanceState, month: string, currency = state.currency, today = localDate()): FinanceState {
  if (!validMonth(month)) throw new Error("Choose a valid month.");
  let planning = state.planning ?? initialPlanning(state);
  const plan = planning.plans.find(p => p.currency === currency) ?? defaultPlan(currency, localDate().slice(0, 7));
  if (!planning.plans.some(p => p.currency === currency)) planning = { ...planning, plans: [...planning.plans, plan] };
  const existing = planning.periods.find(p => p.currency === currency && p.month === month);
  if (existing) {
    if (existing.carryFrom && !existing.carryFinalized) {
      const previousState = ensureBudgetPeriod({ ...state, planning }, shiftMonth(month, -1), currency, today);
      planning = previousState.planning!;
      const previous = planning.periods.find(p => p.currency === currency && p.month === shiftMonth(month, -1))!;
      const revised = applyCarry(previousState, existing, previous, month <= today.slice(0, 7));
      if (JSON.stringify(revised) !== JSON.stringify(existing)) return { ...state, planning: {
        ...planning, periods: planning.periods.map(p => p.id === existing.id ? revised : p),
      } };
    }
    return planning === state.planning ? state : { ...state, planning };
  }
  if (month < plan.startMonth) {
    return { ...state, planning: { ...planning, periods: [...planning.periods, snapshot({ ...plan, limit: 0, categories: plan.categories.map(c => ({ ...c, limit: 0 })) }, month)] } };
  }
  const periods = [...planning.periods];
  let cursor = plan.startMonth;
  // Limit traversal, not date semantics; malformed ancient configurations cannot hang startup.
  let count = 0;
  while (cursor <= month) {
    if (++count > 1200) throw new Error("Budget period range is too large.");
    const existingIndex = periods.findIndex(p => p.currency === currency && p.month === cursor);
    if (existingIndex >= 0) {
      const current = periods[existingIndex];
      if (current.carryFrom && !current.carryFinalized) {
        const previous = periods.find(p => p.currency === currency && p.month === shiftMonth(cursor, -1));
        if (previous) periods[existingIndex] = applyCarry(state, current, previous, cursor <= today.slice(0, 7));
      }
    } else {
      let period = snapshot({ ...plan, limit: plan.mode === "custom" ? 0 : plan.limit,
        categories: plan.categories.map(c => ({ ...c, limit: plan.mode === "custom" ? 0 : c.limit })) }, cursor);
      const previous = periods.find(p => p.currency === currency && p.month === shiftMonth(cursor, -1));
      if (plan.mode === "rollover" && previous) {
        period = applyCarry(state, period, previous, cursor <= today.slice(0, 7));
      }
      periods.push(period);
    }
    cursor = shiftMonth(cursor, 1);
  }
  return { ...state, planning: { ...planning, periods } };
}
export function saveBudget(state: FinanceState, month: string, input: BudgetPlan): FinanceState {
  if (!validMonth(month) || !["fixed", "custom", "rollover"].includes(input.mode)) throw new Error("Invalid budget period.");
  const next = ensureBudgetPeriod(state, month, input.currency);
  const planning = next.planning!;
  const old = planning.periods.find(p => p.currency === input.currency && p.month === month)!;
  const totalCarry = Object.values(old.carryAmounts).reduce((s, v) => s + minorUnits(v), 0) / 100;
  const money = (n: number) => { if (!Number.isFinite(n) || Math.abs(n * 100 - minorUnits(n)) > .00001) throw new Error("Use a valid amount with up to two decimal places."); };
  money(input.limit);
  if (input.limit - totalCarry < 0) throw new Error("The base limit cannot be negative after removing the carried amount.");
  const ids = new Set<string>(), names = new Set<string>();
  input.categories.forEach(c => {
    money(c.limit); const key = categoryKey(c.name);
    if (c.limit - (old.carryAmounts[c.id] ?? 0) < 0) throw new Error("A category's base limit cannot be negative.");
    if (!c.id || !key || ids.has(c.id) || names.has(key)) throw new Error("Category names must be unique.");
    ids.add(c.id); names.add(key);
  });
  const today = localDate().slice(0, 7);
  const previous = planning.plans.find(p => p.currency === input.currency)!;
  // Historical edits are explicit period-only edits, never the current template.
  const periodInput = { ...input, startMonth: month < previous.startMonth ? month : previous.startMonth,
    thresholds: input.thresholds.filter(t => [75, 90, 100].includes(t)) };
  const plan = { ...periodInput, limit: (minorUnits(input.limit) - minorUnits(totalCarry)) / 100,
    categories: input.categories.map(c => ({ ...c, limit: (minorUnits(c.limit) - minorUnits(old.carryAmounts[c.id] ?? 0)) / 100 })) };
  const replacement = { ...snapshot(periodInput, month), baseLimit: plan.limit, customized: true, carryFrom: old.carryFrom, carryAmounts: old.carryAmounts, carryFinalized: old.carryFinalized };
  // Editor values are the period's total limits, so saving cannot re-add a carry.
  return { ...next,
    ...(month === today && input.currency === (state.budgetCurrency ?? state.currency) ? { monthlyBudget: input.limit } : {}),
    planning: { ...planning,
      plans: month < today ? planning.plans : planning.plans.map(p => p.currency === input.currency ? plan : p),
      periods: planning.periods.filter(p => !(month >= today && p.currency === input.currency && p.month > month && !p.customized))
        .map(p => p.id === replacement.id ? replacement : p),
    } };
}
export function getBudgetView(state: FinanceState, month = localDate().slice(0, 7), currency = state.currency) {
  const s = ensureBudgetPeriod(state, month, currency);
  const period = s.planning!.periods.find(p => p.currency === currency && p.month === month)!;
  const used = spending(s, period, month);
  const today = localDate(), bounds = monthBounds(month);
  const elapsed = month < today.slice(0, 7) ? bounds.days : month === today.slice(0, 7) ? Number(today.slice(-2)) : 0;
  const dailyAverage = elapsed ? used.total / elapsed : 0;
  const categories = period.categories.map(c => {
    const spent = used.categories[categoryKey(c.name)] ?? 0;
    return { ...c, spent, remaining: (minorUnits(c.limit) - minorUnits(spent)) / 100,
      percentage: c.limit > 0 ? spent / c.limit * 100 : c.limit < 0 ? 100 : 0, status: budgetStatus(spent, c.limit) };
  });
  return { period, spent: used.total, remaining: (minorUnits(period.limit) - minorUnits(used.total)) / 100,
    percentage: period.limit > 0 ? used.total / period.limit * 100 : period.limit < 0 ? 100 : 0, dailyAverage,
    projected: month > today.slice(0, 7) ? 0 : month < today.slice(0, 7) ? used.total : dailyAverage * bounds.days,
    status: budgetStatus(used.total, period.limit), categories };
}
