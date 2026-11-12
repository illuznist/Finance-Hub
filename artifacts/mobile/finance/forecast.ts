import type { FinanceState } from "../context/FinanceContext";
import { addDays, addMonths, monthBounds } from "./calendar";
import { localDate, minorUnits, validLocalDate } from "./ledger";
import { balances } from "./service";
import { getUpcoming } from "./upcoming";
import { categoryKey, spending as getBudgetSpending } from "./budgets";
import type { BudgetPlan, UpcomingPayment } from "./planningTypes";

export type ForecastMode = "conservative" | "expected";
export type ForecastPreset = "7" | "30" | "60" | "90" | "custom";
export type ForecastDirection = "in" | "out";
export type ForecastConfidence = "scheduled" | "expected" | "hypothetical";
export type ForecastEventKind = "expense" | "emi" | "balloon" | "loan" | "expected-income" | "scenario";

export interface ForecastRange {
  from: string;
  to: string;
}

export interface ForecastScenario {
  id: string;
  kind:
    | "additional_income"
    | "one_time_expense"
    | "increase_monthly_spending"
    | "reduce_monthly_spending"
    | "delay_expected_income"
    | "extra_loan_repayment"
    | "savings_contribution";
  currency: string;
  amount?: number;
  date?: string;
  accountId?: string;
  incomeId?: string;
  delayDays?: number;
}

export interface ForecastEvent {
  id: string;
  sourceId: string;
  date: string;
  name: string;
  category: string;
  source: string;
  kind: ForecastEventKind;
  direction: ForecastDirection;
  confidence: ForecastConfidence;
  amount: number;
  currency: string;
  accountId?: string;
  accountName?: string;
  scenarioId?: string;
  projectedBalanceAfter?: number;
  totalBalanceAfter?: number;
}

export interface ForecastPoint {
  date: string;
  balance: number;
  inflows: number;
  outflows: number;
}

export interface ForecastShortfall {
  date: string;
  accountId?: string;
  accountName: string;
  balance: number;
  amountRequired: number;
  contributingEvents: ForecastEvent[];
}

export interface CashFlowForecast {
  currency: string;
  range: ForecastRange;
  mode: ForecastMode;
  currentAvailable: number;
  projectedEndingBalance: number;
  expectedInflows: number;
  scheduledInflows: number;
  scheduledOutflows: number;
  unallocatedInflows: number;
  unallocatedOutflows: number;
  lowestProjectedBalance: number;
  lowestProjectedDate: string;
  lowestAccountBalance: number;
  nextPayment: ForecastEvent | null;
  shortfall: ForecastShortfall | null;
  events: ForecastEvent[];
  points: ForecastPoint[];
}

export interface BudgetCategoryOutlook {
  id: string;
  name: string;
  limit: number;
  actual: number;
  scheduled: number;
  projected: number;
  overLimit: boolean;
}

export interface BudgetOutlook {
  month: string;
  currency: string;
  limit: number;
  actual: number;
  remaining: number;
  scheduled: number;
  projected: number;
  projectedRemaining: number;
  categories: BudgetCategoryOutlook[];
  overLimitCategories: BudgetCategoryOutlook[];
}

export function forecastRange(preset: ForecastPreset, today = localDate(), custom?: ForecastRange): ForecastRange {
  if (!validLocalDate(today)) throw new Error("Choose a valid forecast date.");
  if (preset === "custom") {
    if (!custom || !validLocalDate(custom.from) || !validLocalDate(custom.to) || custom.from < today || custom.to < custom.from) {
      throw new Error("Choose a valid date range starting today or later.");
    }
    const days = dateOrdinal(custom.to) - dateOrdinal(custom.from) + 1;
    if (days > 3660) throw new Error("A custom forecast can cover up to ten years.");
    return { from: custom.from, to: custom.to };
  }
  const length = Number(preset);
  if (![7, 30, 60, 90].includes(length)) throw new Error("Choose a 7, 30, 60, or 90-day forecast.");
  return { from: today, to: addDays(today, length - 1) };
}

function dateOrdinal(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function sumMinor(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) {
    total += value;
    if (!Number.isSafeInteger(total)) throw new Error("Forecast totals exceed the supported monetary range.");
  }
  return total;
}

function accountFor(state: FinanceState, accountId: string | undefined, currency: string) {
  if (!accountId) return undefined;
  const account = state.accounts.find(a => a.id === accountId);
  return account && (account.currency ?? state.currency) === currency ? account : undefined;
}

function scheduledEvent(state: FinanceState, item: UpcomingPayment): ForecastEvent {
  const account = accountFor(state, item.accountId, item.currency);
  const loan = item.type === "loan" ? state.loans.find(l => l.id === item.sourceId) : undefined;
  const recurring = item.type === "expense" ? state.planning?.recurring.find(r => r.id === item.sourceId) : undefined;
  const direction: ForecastDirection = loan?.direction === "lent" ? "in" : "out";
  const category = recurring?.category ?? (item.type === "emi" || item.type === "balloon" ? "Debt repayments" : item.type === "loan" ? "Debt repayments" : "Recurring");
  return {
    id: item.id,
    sourceId: item.sourceId,
    date: item.dueDate,
    name: item.name,
    category,
    source: item.type === "expense" ? "Recurring expense" : item.type === "emi" || item.type === "balloon" ? "EMI" : "Loan",
    kind: item.type,
    direction,
    confidence: "scheduled",
    amount: item.amount,
    currency: item.currency,
    accountId: account?.id,
    accountName: account?.name,
  };
}

function plannedIncomeEvents(state: FinanceState, currency: string, range: ForecastRange): ForecastEvent[] {
  return state.incomes.flatMap(income => {
    const incomeCurrency = income.currency ?? state.currency;
    if (income.kind !== "expected" || incomeCurrency !== currency || !income.date ||
      !validLocalDate(income.date) || income.date < range.from || income.date > range.to ||
      !Number.isFinite(income.amount) || minorUnits(income.amount) <= 0) return [];
    const account = accountFor(state, income.accountId, currency);
    return [{
      id: `expected-income:${income.id}`,
      sourceId: income.id,
      date: income.date,
      name: income.name || "Expected income",
      category: income.category || "Income",
      source: "Expected income",
      kind: "expected-income" as const,
      direction: "in" as const,
      confidence: "expected" as const,
      amount: minorUnits(income.amount) / 100,
      currency,
      accountId: account?.id,
      accountName: account?.name,
    }];
  });
}

function scenarioEvents(
  state: FinanceState,
  currency: string,
  range: ForecastRange,
  mode: ForecastMode,
  sourceEvents: ForecastEvent[],
  scenarios: readonly ForecastScenario[],
): ForecastEvent[] {
  const events = [...sourceEvents];
  for (const scenario of scenarios) {
    if (scenario.currency !== currency) {
      // A scenario in another currency is kept isolated and is not applied to this view.
      continue;
    }
    if (scenario.kind === "delay_expected_income") {
      if (mode !== "expected" || !scenario.incomeId || !Number.isInteger(scenario.delayDays) || (scenario.delayDays ?? 0) < 1 || (scenario.delayDays ?? 0) > 365) continue;
      const targetId = `expected-income:${scenario.incomeId}`;
      const expected = events.find(e => e.id === targetId);
      if (!expected) continue;
      events.splice(events.indexOf(expected), 1);
      const date = addDays(expected.date, scenario.delayDays!);
      if (date >= range.from && date <= range.to) events.push({
        ...expected,
        id: `scenario:${scenario.id}`,
        date,
        source: "Scenario · delayed income",
        confidence: "hypothetical",
        scenarioId: scenario.id,
      });
      continue;
    }
    if (!scenario.date || !validLocalDate(scenario.date)) continue;
    const account = accountFor(state, scenario.accountId, scenario.currency);
    const base = {
      id: `scenario:${scenario.id}`,
      sourceId: scenario.id,
      name: "Scenario adjustment",
      category: "Other",
      source: "Scenario",
      kind: "scenario" as const,
      confidence: "hypothetical" as const,
      currency: scenario.currency,
      accountId: account?.id,
      accountName: account?.name,
      scenarioId: scenario.id,
    };
    if (scenario.kind === "increase_monthly_spending" || scenario.kind === "reduce_monthly_spending") {
      if (!Number.isFinite(scenario.amount) || minorUnits(scenario.amount!) <= 0) continue;
      const direction = scenario.kind === "reduce_monthly_spending" ? "in" : "out";
      let index = 0, date = addMonths(scenario.date, 0);
      while (date < range.from && index < 1200) date = addMonths(scenario.date, ++index, Number(scenario.date.slice(-2)));
      for (let guard = 0; date <= range.to && guard < 1200; guard++, index++, date = addMonths(scenario.date, index, Number(scenario.date.slice(-2)))) {
        if (date < range.from) continue;
        events.push({ ...base, id: `scenario:${scenario.id}:${date}`, date, name: scenario.kind === "increase_monthly_spending" ? "Increased monthly spending" : "Reduced monthly spending",
          category: "Everyday spending", direction, amount: minorUnits(scenario.amount!) / 100 });
      }
      continue;
    }
    if (scenario.date < range.from || scenario.date > range.to || !Number.isFinite(scenario.amount) || minorUnits(scenario.amount!) <= 0) continue;
    const income = scenario.kind === "additional_income";
    events.push({
      ...base,
      name: scenario.kind === "additional_income" ? "Additional income" :
        scenario.kind === "extra_loan_repayment" ? "Extra loan repayment" :
          scenario.kind === "savings_contribution" ? "Additional savings contribution" : "One-time expense",
      category: scenario.kind === "extra_loan_repayment" ? "Debt repayments" :
        scenario.kind === "savings_contribution" ? "Savings" : income ? "Income" : "Other",
      direction: income ? "in" : "out",
      amount: minorUnits(scenario.amount!) / 100,
      date: scenario.date,
    });
  }
  return events;
}

function summarize(
  state: FinanceState,
  currency: string,
  range: ForecastRange,
  mode: ForecastMode,
  unsummarizedEvents: ForecastEvent[],
  expectedInflows: number,
  simulationStart: string,
): CashFlowForecast {
  const currencyAccounts = balances(state).filter(a => a.currency === currency);
  const accountMap = new Map(currencyAccounts.map(a => [a.id, a]));
  const accountBalances = new Map(currencyAccounts.map(a => [a.id, minorUnits(a.balance)]));
  const currentAvailableUnits = sumMinor(accountBalances.values());
  const simulationEvents = unsummarizedEvents
    .filter(e => e.currency === currency && e.date >= simulationStart && e.date <= range.to && minorUnits(e.amount) > 0)
    .map(e => {
      const account = accountMap.get(e.accountId ?? "");
      return { ...e, accountId: account?.id, accountName: account?.name };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const events = simulationEvents.filter(e => e.date >= range.from);
  const daily = new Map<string, ForecastEvent[]>();
  for (const event of simulationEvents) daily.set(event.date, [...(daily.get(event.date) ?? []), event]);

  const days = dateOrdinal(range.to) - dateOrdinal(simulationStart) + 1;
  const visibleDays = dateOrdinal(range.to) - dateOrdinal(range.from) + 1;
  const points: ForecastPoint[] = [];
  let lowestProjectedUnits = currentAvailableUnits, lowestDate = simulationStart;
  let lowestAccountUnits = accountBalances.size ? Math.min(...accountBalances.values()) : 0;
  let shortfall: ForecastShortfall | null = null;
  const projectedEvents: ForecastEvent[] = [];
  let date = simulationStart;
  for (let index = 0; index < days; index++, date = addDays(date, 1)) {
    const onDate = daily.get(date) ?? [];
    const deltas = new Map<string, number>();
    let inflowAmounts: number[] = [], outflowAmounts: number[] = [];
    for (const event of onDate) {
      const units = minorUnits(event.amount);
      if (event.direction === "in") inflowAmounts.push(units);
      else outflowAmounts.push(units);
      if (event.accountId) {
        const signed = event.direction === "in" ? units : -units;
        deltas.set(event.accountId, (deltas.get(event.accountId) ?? 0) + signed);
      }
    }
    for (const [accountId, delta] of deltas) {
      const next = (accountBalances.get(accountId) ?? 0) + delta;
      if (!Number.isSafeInteger(next)) throw new Error("Forecast balance exceeds the supported range.");
      accountBalances.set(accountId, next);
    }
    const totalUnits = sumMinor(accountBalances.values());
    const inflows = sumMinor(inflowAmounts), outflows = sumMinor(outflowAmounts);
    const dailyLowest = accountBalances.size ? Math.min(...accountBalances.values()) : 0;
    if (totalUnits < lowestProjectedUnits) { lowestProjectedUnits = totalUnits; lowestDate = date; }
    lowestAccountUnits = Math.min(lowestAccountUnits, dailyLowest);
    if (!shortfall) {
      const negative = [...accountBalances.entries()].find(([, value]) => value < 0);
      if (negative) {
        const account = accountMap.get(negative[0]);
        const related = simulationEvents.filter(e => e.accountId === negative[0] && e.direction === "out" && e.date <= date && e.confidence === "scheduled");
        shortfall = { date, accountId: negative[0], accountName: account?.name ?? "Account", balance: negative[1] / 100,
          amountRequired: -negative[1] / 100, contributingEvents: related };
      } else if (totalUnits < 0) {
        shortfall = { date, accountName: "Tracked accounts", balance: totalUnits / 100, amountRequired: -totalUnits / 100,
          contributingEvents: simulationEvents.filter(e => e.direction === "out" && e.date <= date && e.confidence === "scheduled") };
      }
    }
    if (date >= range.from) onDate.forEach(event => projectedEvents.push({
        ...event,
        projectedBalanceAfter: event.accountId ? (accountBalances.get(event.accountId) ?? 0) / 100 : undefined,
        totalBalanceAfter: totalUnits / 100,
      }));
    const visibleIndex = dateOrdinal(date) - dateOrdinal(range.from);
    if (date >= range.from &&
      (date === range.from || date === range.to || onDate.length || visibleIndex % Math.max(1, Math.ceil(visibleDays / 120)) === 0)) {
      points.push({ date, balance: totalUnits / 100, inflows: inflows / 100, outflows: outflows / 100 });
    }
  }
  const sum = (filter: (event: ForecastEvent) => boolean) => sumMinor(events.filter(filter).map(event => minorUnits(event.amount)));
  const unallocatedInflows = sum(e => !e.accountId && e.direction === "in");
  const unallocatedOutflows = sum(e => !e.accountId && e.direction === "out");
  const futureOutflows = events.filter(e => e.direction === "out" && e.confidence === "scheduled");
  const nextPayment = futureOutflows[0] ?? null;
  return {
    currency,
    range,
    mode,
    currentAvailable: currentAvailableUnits / 100,
    projectedEndingBalance: sumMinor(accountBalances.values()) / 100,
    expectedInflows,
    scheduledInflows: sum(e => e.direction === "in" && e.confidence === "scheduled") / 100,
    scheduledOutflows: sum(e => e.direction === "out" && e.confidence === "scheduled") / 100,
    unallocatedInflows: unallocatedInflows / 100,
    unallocatedOutflows: unallocatedOutflows / 100,
    lowestProjectedBalance: lowestProjectedUnits / 100,
    lowestProjectedDate: lowestDate,
    lowestAccountBalance: lowestAccountUnits / 100,
    nextPayment: nextPayment ? projectedEvents.find(e => e.id === nextPayment.id) ?? nextPayment : null,
    shortfall,
    events: projectedEvents,
    points,
  };
}

export function buildCashFlowForecast(
  state: FinanceState,
  options: { currency: string; range: ForecastRange; mode: ForecastMode; today?: string; scenarios?: readonly ForecastScenario[] },
): CashFlowForecast {
  const today = options.today ?? localDate();
  if (!validLocalDate(options.range.from) || !validLocalDate(options.range.to) || options.range.from < today ||
    options.range.from > options.range.to || !options.currency || !["conservative", "expected"].includes(options.mode)) {
    throw new Error("Choose a valid future forecast period and currency.");
  }
  const simulationRange = { from: today, to: options.range.to };
  const accounts = balances(state).filter(a => a.currency === options.currency);
  if (accounts.some(a => !Number.isSafeInteger(minorUnits(a.balance)))) throw new Error("An account balance cannot be represented safely.");
  const events: ForecastEvent[] = getUpcoming(state, simulationRange.from, simulationRange.to, today)
    .filter(item => item.status !== "paid" && item.status !== "skipped" && item.currency === options.currency)
    .map(item => scheduledEvent(state, item));
  const expectedIncome = plannedIncomeEvents(state, options.currency, simulationRange);
  const expectedInflows = sumMinor(expectedIncome
    .filter(event => event.date >= options.range.from)
    .map(event => minorUnits(event.amount))) / 100;
  if (options.mode === "expected") events.push(...expectedIncome);
  const withScenarios = scenarioEvents(state, options.currency, simulationRange, options.mode, events, options.scenarios ?? []);
  return summarize(state, options.currency, options.range, options.mode, withScenarios, expectedInflows, today);
}

export function buildBudgetOutlook(
  state: FinanceState,
  plan: BudgetPlan,
  month: string,
  forecastEvents: readonly ForecastEvent[],
): BudgetOutlook {
  const bounds = monthBounds(month);
  const actual = getBudgetSpending(state, plan, month);
  const schedule = new Map<string, number>();
  for (const event of forecastEvents) {
    if (event.currency !== plan.currency || event.date < bounds.from || event.date > bounds.to ||
      event.direction !== "out" || event.confidence !== "scheduled") continue;
    if (event.source === "Transfer" || categoryKey(event.category) === categoryKey("Transfer")) continue;
    const included = event.kind === "expense" ||
      ((event.kind === "emi" || event.kind === "balloon") && plan.includeEMI) ||
      (event.kind === "loan" && (plan.includeLoans || plan.categories.some(c => c.limit > 0 && categoryKey(c.name) === categoryKey(event.category))));
    if (!included) continue;
    const key = categoryKey(event.category);
    schedule.set(key, (schedule.get(key) ?? 0) + minorUnits(event.amount));
  }
  const scheduledUnits = sumMinor(schedule.values());
  const actualUnits = minorUnits(actual.total);
  const limitUnits = minorUnits(plan.limit);
  const categories = plan.categories.map(category => {
    const key = categoryKey(category.name);
    const categoryActualUnits = minorUnits(actual.categories[key] ?? 0);
    const categoryScheduledUnits = schedule.get(key) ?? 0;
    const categoryActual = categoryActualUnits / 100;
    const categoryScheduled = categoryScheduledUnits / 100;
    const projected = sumMinor([categoryActualUnits, categoryScheduledUnits]) / 100;
    return { id: category.id, name: category.name, limit: category.limit, actual: categoryActual, scheduled: categoryScheduled,
      projected, overLimit: category.limit > 0 && projected > category.limit };
  }).filter(category => category.limit > 0 || category.actual > 0 || category.scheduled > 0);
  const scheduled = scheduledUnits / 100;
  const projectedUnits = sumMinor([actualUnits, scheduledUnits]);
  return {
    month,
    currency: plan.currency,
    limit: plan.limit,
    actual: actualUnits / 100,
    remaining: sumMinor([limitUnits, -actualUnits]) / 100,
    scheduled,
    projected: projectedUnits / 100,
    projectedRemaining: sumMinor([limitUnits, -projectedUnits]) / 100,
    categories,
    overLimitCategories: categories.filter(category => category.overLimit),
  };
}
