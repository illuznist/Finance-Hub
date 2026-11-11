import type { FinanceState } from "../context/FinanceContext";
import { addDays, addMonths, monthBounds, parseLocal, shiftMonth } from "./calendar";
import { localDate, minorUnits, validLocalDate, type Transaction } from "./ledger";
import { analyticsCurrencies, currentNetWorth } from "./netWorth";
import type { AnalyticsDrill, AnalyticsQuery, AnalyticsReport, CashFlowPoint, DateRange, FlowTotals, PeriodPreset, ReportRange, SpendingEntry, SpendingKind } from "./analyticsTypes";
export type * from "./analyticsTypes";

export const SPENDING_LABELS: Record<SpendingKind, string> = {
  everyday: "Everyday", recurring: "Recurring", emi: "EMI payments", balloon: "Balloon payments", loan: "Loan repayments", savings: "Savings contributions",
};
export const PERIODS: { key: PeriodPreset; label: string }[] = [
  { key: "this", label: "This month" }, { key: "last", label: "Last month" }, { key: "last3", label: "Last 3 months" },
  { key: "last6", label: "Last 6 months" }, { key: "year", label: "This year" }, { key: "lastYear", label: "Last year" }, { key: "custom", label: "Custom" },
];
function validateRange(r: DateRange) {
  if (!validLocalDate(r.from) || !validLocalDate(r.to) || r.from > r.to) throw new Error("Choose a valid start and end date.");
}
export function reportingRange(preset: PeriodPreset, today = localDate(), custom?: DateRange): ReportRange {
  const month = today.slice(0, 7), year = Number(today.slice(0, 4));
  let from = `${month}-01`, to = today, previous: DateRange;
  if (preset === "last") { const r = monthBounds(shiftMonth(month, -1)); from = r.from; to = r.to; previous = monthBounds(shiftMonth(month, -2)); }
  else if (preset === "last3" || preset === "last6") {
    const n = preset === "last3" ? 3 : 6; from = `${shiftMonth(month, 1 - n)}-01`;
    previous = { from: `${shiftMonth(month, 1 - n * 2)}-01`, to: addMonths(today, -n) };
  } else if (preset === "year") { from = `${year}-01-01`; previous = { from: `${year - 1}-01-01`, to: addMonths(today, -12) }; }
  else if (preset === "lastYear") {
    from = `${year - 1}-01-01`; to = `${year - 1}-12-31`; previous = { from: `${year - 2}-01-01`, to: `${year - 2}-12-31` };
  } else if (preset === "custom") {
    if (!custom) throw new Error("Choose a custom date range.");
    from = custom.from; to = custom.to; validateRange({ from, to });
    const ordinal = (s: string) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
    const days = ordinal(to) - ordinal(from) + 1;
    previous = { from: addDays(from, -days), to: addDays(from, -1) };
  } else previous = { from: `${shiftMonth(month, -1)}-01`, to: addMonths(today, -1) };
  validateRange({ from, to });
  return { from, to, previous, label: PERIODS.find(p => p.key === preset)?.label ?? "Selected period" };
}
function sourceKey(t: Transaction): string { return (t.description.trim() || "Unknown source").toLocaleLowerCase(); }
function classify(t: Transaction, expenses: Map<string, FinanceState["expenses"][number]>): SpendingEntry | null {
  let kind: SpendingKind;
  if (t.type === "expense") {
    if (t.referenceType === "loan" || t.originType === "loan") return null; // Funding moves cash into a receivable.
    const e = expenses.get(t.referenceId ?? "");
    kind = t.recurringOccurrenceId || e?.recurringOccurrenceId || (e?.recurrence && e.recurrence !== "none") ? "recurring" : "everyday";
  } else if (t.type === "emi_payment") kind = "emi";
  else if (t.type === "balloon_payment") kind = "balloon";
  else if (t.type === "loan_repayment") kind = "loan";
  else if (t.type === "savings_contribution") kind = "savings";
  else return null;
  if (t.direction !== "out") return null;
  const category = t.category?.trim() || "Uncategorized";
  return { transaction: t, kind, category, key: JSON.stringify([kind, category]), fixed: ["recurring", "emi", "balloon"].includes(kind) };
}
function allowed(e: SpendingEntry, q: AnalyticsQuery): boolean {
  return (q.includeDebt || !["emi", "balloon", "loan"].includes(e.kind)) && (q.includeSavings || e.kind !== "savings");
}
const totals = (incoming: number, outgoing: number): FlowTotals => ({
  income: incoming / 100, expenses: outgoing / 100, net: (incoming - outgoing) / 100,
  savingsRate: incoming > 0 ? Math.max(0, incoming - outgoing) / incoming * 100 : null,
});

export function selectAnalyticsTransactions(state: FinanceState, q: AnalyticsQuery, drill: AnalyticsDrill): Transaction[] {
  validateRange(q);
  const expenseIndex = new Map(state.expenses.map(e => [e.id, e]));
  return (state.transactions ?? []).filter(t => {
    if (t.currency !== q.currency || t.date < q.from || t.date > q.to) return false;
    if (t.type === "income" && t.direction === "in") return drill.type !== "expenses" && !drill.categoryKey && !drill.kind && (!drill.sourceKey || sourceKey(t) === drill.sourceKey);
    const e = classify(t, expenseIndex);
    return drill.type !== "income" && !!e && allowed(e, q) && (!drill.categoryKey || e.key === drill.categoryKey) && (!drill.kind || e.kind === drill.kind) && !drill.sourceKey;
  });
}

export function buildAnalyticsReport(state: FinanceState, q: AnalyticsQuery, previousRange?: DateRange, today = localDate()): AnalyticsReport {
  validateRange(q);
  const previous = previousRange ?? reportingRange("custom", today, q).previous;
  validateRange(previous);
  const expenseIndex = new Map(state.expenses.map(e => [e.id, e]));
  const categories = new Map<string, { key: string; name: string; kind: SpendingKind; units: number; count: number }>();
  const sources = new Map<string, { key: string; name: string; units: number; count: number }>();
  const monthly = new Map<string, { incoming: number; outgoing: number }>();
  const incomeTransactions: Transaction[] = [], expenseTransactions: Transaction[] = [];
  let incoming = 0, outgoing = 0, previousIn = 0, previousOut = 0, fixed = 0, variable = 0, other = 0;
  let emi = 0, balloon = 0, loan = 0, savings = 0, historyStart: string | null = null;
  for (const t of state.transactions ?? []) {
    if (t.currency !== q.currency) continue;
    if (!historyStart || t.date < historyStart) historyStart = t.date;
    const income = t.type === "income" && t.direction === "in";
    const e = classify(t, expenseIndex);
    const spending = e && allowed(e, q) ? e : null;
    if (!income && !spending) continue;
    const units = minorUnits(t.amount);
    if (t.date >= previous.from && t.date <= previous.to) { if (income) previousIn += units; else previousOut += units; }
    if (t.date < q.from || t.date > q.to) continue;
    const key = t.date.slice(0, 7), m = monthly.get(key) ?? { incoming: 0, outgoing: 0 };
    if (income) {
      incoming += units; m.incoming += units; incomeTransactions.push(t);
      const k = sourceKey(t), s = sources.get(k) ?? { key: k, name: t.description, units: 0, count: 0 };
      s.units += units; s.count++; sources.set(k, s);
    } else if (spending) {
      outgoing += units; m.outgoing += units; expenseTransactions.push(t);
      const c = categories.get(spending.key) ?? { key: spending.key, name: spending.category, kind: spending.kind, units: 0, count: 0 };
      c.units += units; c.count++; categories.set(c.key, c);
      if (spending.fixed) fixed += units;
      else if (spending.kind === "everyday") variable += units;
      else other += units;
      if (spending.kind === "emi") emi += units;
      if (spending.kind === "balloon") balloon += units;
      if (spending.kind === "loan") loan += units;
      if (spending.kind === "savings") savings += units;
    }
    monthly.set(key, m);
  }
  const points: CashFlowPoint[] = [];
  for (const units of [incoming, outgoing, previousIn, previousOut]) {
    if (!Number.isSafeInteger(units)) throw new Error("Reporting totals exceed the supported monetary range.");
  }
  if (historyStart) {
    let month = (q.from > historyStart ? q.from : historyStart).slice(0, 7);
    while (month <= q.to.slice(0, 7)) {
      const bounds = monthBounds(month), m = monthly.get(month);
      if (month <= today.slice(0, 7) || m) {
        points.push({ key: month, label: parseLocal(`${month}-01`).toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
          from: q.from > bounds.from ? q.from : bounds.from, to: q.to < bounds.to ? q.to : bounds.to,
          partial: bounds.from < historyStart || bounds.from < q.from || bounds.to > q.to || bounds.to >= today,
          ...totals(m?.incoming ?? 0, m?.outgoing ?? 0) });
      }
      month = shiftMonth(month, 1);
    }
  }
  const years = new Map<string, CashFlowPoint>();
  for (const p of points) {
    const key = p.key.slice(0, 4), old = years.get(key);
    years.set(key, { key, label: key, from: old?.from ?? p.from, to: p.to, partial: (old?.partial ?? false) || p.partial,
      ...totals(minorUnits(old?.income ?? 0) + minorUnits(p.income), minorUnits(old?.expenses ?? 0) + minorUnits(p.expenses)) });
  }
  const expectedSources = state.incomes.filter(i => i.kind !== "received" && (i.currency ?? state.currency) === q.currency).map(i => ({ id: i.id, name: i.name, amount: i.amount }));
  const overview = totals(incoming, outgoing);
  const complete = points.filter(p => !p.partial);
  const notices = [
    "Recorded income and payments only. Transfers, reconciliation, loan proceeds/collections, lent principal funding and refunds are excluded from these operating figures.",
    "Expected income is a current monthly plan, not receipts for the selected period. Fixed/variable describes recorded patterns, not a prediction.",
  ];
  if (historyStart) notices.push(`Your ${q.currency} transaction history begins on ${historyStart}. Earlier financial activity may not be included.`);
  else notices.push(`No recorded ${q.currency} transaction history yet. No earlier activity has been estimated.`);
  if (state.reconciliationRequired) notices.push("Legacy account balances still need review. Historical paid flags were not replayed into the ledger.");
  const percentage = (units: number) => incoming > 0 ? units / incoming * 100 : null;
  return { query: q, totals: overview, previous: totals(previousIn, previousOut), previousRange: previous,
    comparisonAvailable: !!historyStart && previous.from >= historyStart && previous.to <= today,
    monthly: points, yearly: [...years.values()],
    categories: [...categories.values()].sort((a, b) => b.units - a.units).map(c => ({ key: c.key, name: c.name, kind: c.kind, amount: c.units / 100, percentage: outgoing ? c.units / outgoing * 100 : 0, count: c.count })),
    incomeSources: [...sources.values()].sort((a, b) => b.units - a.units).map(s => ({ key: s.key, name: s.name, amount: s.units / 100, count: s.count })),
    expectedSources, expectedIncome: expectedSources.reduce((s, i) => s + minorUnits(i.amount), 0) / 100,
    fixed: fixed / 100, variable: variable / 100, unclassified: other / 100, emiTotal: emi / 100, balloonTotal: balloon / 100, loanTotal: loan / 100, savingsTotal: savings / 100,
    health: { savingsRate: overview.savingsRate, fixedBurden: percentage(fixed), variableBurden: percentage(variable), debtBurden: q.includeDebt ? percentage(emi + balloon + loan) : null,
      consistency: complete.length >= 3 ? complete.filter(p => p.net >= 0).length / complete.length * 100 : null, completeMonths: complete.length },
    historyStart, notices, currencies: analyticsCurrencies(state), incomeTransactions, expenseTransactions,
    movements: [...incomeTransactions, ...expenseTransactions].sort((a, b) => a.date.localeCompare(b.date)),
    netWorth: currentNetWorth(state, q.currency, today) };
}
