import type { FinanceState } from "../context/FinanceContext";
import type { RecurringExpense, RecurringOccurrence } from "./planningTypes";
import { initialPlanning } from "./budgets";
import { addDays, addMonths, parseLocal } from "./calendar";
import { localDate, positiveMoney, validLocalDate } from "./ledger";
import { setExpensePayment } from "./service";

export function validateRecurring(r: RecurringExpense): void {
  if (!r.id || !r.name.trim() || !r.category.trim() || !r.currency) throw new Error("Name, category and currency are required.");
  positiveMoney(r.amount);
  if (!validLocalDate(r.startDate) || !validLocalDate(r.nextDueDate) || (r.endDate && (!validLocalDate(r.endDate) || r.endDate < r.startDate))) throw new Error("Check the schedule dates.");
  if (!["daily", "weekly", "monthly", "bimonthly", "quarterly", "semiannual", "annual", "custom"].includes(r.frequency)) throw new Error("Choose a recurrence frequency.");
  if (r.frequency === "custom" && (!Number.isInteger(r.interval) || r.interval! < 1 || r.interval! > 365 || !["day", "week", "month"].includes(r.intervalUnit ?? ""))) throw new Error("Choose a custom interval from 1 to 365.");
}
export function recurrenceStep(r: RecurringExpense): { unit: "day" | "month"; interval: number } {
  if (r.frequency === "custom") return r.intervalUnit === "month"
    ? { unit: "month", interval: r.interval! } : { unit: "day", interval: r.interval! * (r.intervalUnit === "week" ? 7 : 1) };
  if (r.frequency === "daily" || r.frequency === "weekly") return { unit: "day", interval: r.frequency === "daily" ? 1 : 7 };
  return { unit: "month", interval: ({ monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, annual: 12 } as Record<string, number>)[r.frequency] };
}
export function recurrenceAt(r: RecurringExpense, index: number): string {
  const step = recurrenceStep(r);
  return step.unit === "day" ? addDays(r.startDate, step.interval * index) : addMonths(r.startDate, step.interval * index);
}
function nextScheduled(r: RecurringExpense, after: string): string {
  const step = recurrenceStep(r);
  const horizon = step.unit === "month" ? step.interval + 1 : 13;
  return scheduleDates(r, addDays(after, 1), addMonths(after, Math.max(13, horizon)))[0] ?? addDays(r.endDate ?? after, 1);
}
function ordinal(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}
export function scheduleDates(r: RecurringExpense, from: string, to: string): string[] {
  parseLocal(from); parseLocal(to);
  const step = recurrenceStep(r), start = parseLocal(r.startDate), first = parseLocal(from);
  const distance = step.unit === "day" ? ordinal(from) - ordinal(r.startDate)
    : (first.getFullYear() - start.getFullYear()) * 12 + first.getMonth() - start.getMonth();
  let index = Math.max(0, Math.floor(distance / step.interval) - 1);
  const dates: string[] = [];
  for (let guard = 0; guard < 5000; guard++, index++) {
    const date = recurrenceAt(r, index);
    if (date > to || (r.endDate && date > r.endDate)) break;
    if (date >= from) dates.push(date);
  }
  return dates;
}
export function occurrenceFor(r: RecurringExpense, dueDate: string): RecurringOccurrence {
  return { id: `rec:${r.id}:${dueDate}`, recurringId: r.id, dueDate, name: r.name, amount: r.amount,
    currency: r.currency, category: r.category, accountId: r.accountId,
    iconName: r.iconName, color: r.color, notes: r.notes, status: "pending" };
}
export function generateDueOccurrences(state: FinanceState, today = localDate()): FinanceState {
  const planning = state.planning ?? initialPlanning(state, today);
  const occurrences = [...planning.occurrences], identities = new Set(occurrences.map(o => o.id));
  let changed = !state.planning;
  const recurring = planning.recurring.map(r => {
    if (!r.active || r.deleted || !r.autoGenerate || r.nextDueDate > today) return r;
    const dates = scheduleDates(r, r.nextDueDate, today);
    dates.forEach(date => {
      const o = occurrenceFor(r, date);
      if (!identities.has(o.id)) { occurrences.push(o); identities.add(o.id); changed = true; }
    });
    if (!dates.length) return r;
    const last = dates[dates.length - 1];
    const next = nextScheduled(r, last);
    // If the schedule ended, cursor beyond its end prevents repeated generation.
    changed = true;
    return { ...r, nextDueDate: next };
  });
  return changed ? { ...state, planning: { ...planning, recurring, occurrences } } : state;
}
export function saveRecurring(state: FinanceState, input: RecurringExpense, scope: "future" | "pending", today = localDate()): FinanceState {
  validateRecurring(input);
  if (input.accountId && !state.accounts.some(a => a.id === input.accountId && (a.currency ?? state.currency) === input.currency)) throw new Error("Select an account in the same currency or Unassigned.");
  const planning = state.planning ?? initialPlanning(state, today);
  const old = planning.recurring.find(r => r.id === input.id);
  if (old?.deleted) throw new Error("This schedule was archived.");
  const start = old ? nextScheduled(input, today) : input.startDate;
  const r = { ...input, nextDueDate: start ?? addDays(input.endDate ?? today, 1), deleted: false };
  const occurrences = planning.occurrences.map(o => {
    if (o.recurringId !== r.id || o.status !== "pending" || (scope === "future" && o.dueDate <= today)) return o;
    return { ...occurrenceFor(r, o.dueDate), expenseId: o.expenseId };
  });
  return generateDueOccurrences({ ...state, planning: { ...planning, occurrences,
    recurring: old ? planning.recurring.map(v => v.id === r.id ? r : v) : [...planning.recurring, r] } }, today);
}
export function setRecurringActive(state: FinanceState, id: string, active: boolean, today = localDate()): FinanceState {
  const planning = state.planning;
  if (!planning) return state;
  return generateDueOccurrences({ ...state, planning: { ...planning, recurring: planning.recurring.map(r => {
    if (r.id !== id || r.deleted) return r;
    // Resume from today, not with retroactive charges for the paused interval.
    return { ...r, active, nextDueDate: active ? nextScheduled(r, addDays(today, -1)) : r.nextDueDate };
  }) } }, today);
}
export function deleteRecurring(state: FinanceState, id: string): FinanceState {
  if (!state.planning) return state;
  return { ...state, planning: { ...state.planning,
    recurring: state.planning.recurring.map(r => r.id === id ? { ...r, active: false, deleted: true } : r),
    occurrences: state.planning.occurrences.map(o => o.recurringId === id && o.status === "pending" ? { ...o, status: "skipped", skipReason: "Schedule archived" } : o),
  } };
}
function materialize(state: FinanceState, id: string, dueDate: string): { state: FinanceState; occurrence: RecurringOccurrence } {
  const r = state.planning?.recurring.find(r => r.id === id);
  if (!r) throw new Error("This recurring schedule no longer exists.");
  let o = state.planning!.occurrences.find(o => o.recurringId === id && o.dueDate === dueDate);
  if (o) return { state, occurrence: o };
  if (r.deleted || !r.active) throw new Error("Resume this recurring schedule before recording a new payment occurrence.");
  if (!scheduleDates(r, dueDate, dueDate).includes(dueDate) || dueDate < r.nextDueDate) throw new Error("That occurrence is not part of the active schedule.");
  o = occurrenceFor(r, dueDate);
  return { state: { ...state, planning: { ...state.planning!, occurrences: [...state.planning!.occurrences, o] } }, occurrence: o };
}
export function payRecurring(state: FinanceState, id: string, dueDate: string, input: { accountId?: string; date: string }): FinanceState {
  const found = materialize(state, id, dueDate), o = found.occurrence;
  if (o.status === "paid") return state;
  if (o.status === "skipped") throw new Error("Skipped occurrences cannot be charged.");
  if (!validLocalDate(input.date)) throw new Error("Check the payment date.");
  const expenseId = o.expenseId ?? o.id;
  let next = found.state;
  if (!next.expenses.some(e => e.id === expenseId)) next = { ...next, expenses: [...next.expenses, {
    id: expenseId, name: o.name, amount: o.amount, category: o.category, dueDate: Number(o.dueDate.slice(-2)),
    isPaid: false, iconName: o.iconName, color: o.color, notes: o.notes, currency: o.currency,
    recurrence: "none", recurringOccurrenceId: o.id,
  }] };
  next = setExpensePayment(next, expenseId, { paid: true, accountId: input.accountId, date: input.date, operationId: `recurring:${o.id}` });
  return { ...next, planning: { ...next.planning!, occurrences: next.planning!.occurrences.map(v => v.id === o.id ? { ...v, status: "paid", expenseId } : v),
    recurring: next.planning!.recurring.map(r => r.id === id && r.nextDueDate === dueDate
      ? { ...r, nextDueDate: nextScheduled(r, dueDate) } : r),
  } };
}
export function skipRecurring(state: FinanceState, id: string, dueDate: string, pause = false): FinanceState {
  const found = materialize(state, id, dueDate), o = found.occurrence;
  if (o.status === "paid") throw new Error("Reverse the actual payment before skipping.");
  let next = { ...found.state, planning: { ...found.state.planning!,
    occurrences: found.state.planning!.occurrences.map(v => v.id === o.id ? { ...v, status: "skipped" as const, skipReason: pause ? "Skipped and paused" : "Skipped once" } : v),
    recurring: found.state.planning!.recurring.map(r => r.id === id ? { ...r, active: pause ? false : r.active,
      nextDueDate: r.nextDueDate === dueDate ? nextScheduled(r, dueDate) : r.nextDueDate } : r),
  } };
  return next;
}
/** Explicit transaction corrections/reversals also update the occurrence, not its definition. */
export function synchronizeOccurrences(state: FinanceState): FinanceState {
  if (!state.planning) return state;
  let changed = false;
  const occurrences = state.planning.occurrences.map(o => {
    if (!o.expenseId || o.status === "skipped") return o;
    const expense = state.expenses.find(e => e.id === o.expenseId);
    const detached = !expense ? state.transactions?.find(t => t.type === "expense" && t.recurringOccurrenceId === o.id) : undefined;
    const status: RecurringOccurrence["status"] = expense?.isPaid || detached ? "paid" : "pending";
    if (detached) {
      if (o.status === status && o.amount === detached.amount && o.name === detached.description && o.category === detached.category && o.accountId === detached.accountId) return o;
      changed = true;
      return { ...o, status, amount: detached.amount, name: detached.description, category: detached.category, accountId: detached.accountId, notes: detached.notes };
    }
    if (status === o.status && (!expense || (o.amount === expense.amount && o.name === expense.name && o.category === expense.category && o.accountId === expense.accountId))) return o;
    changed = true;
    return { ...o, status, ...(expense ? { amount: expense.amount, name: expense.name, category: expense.category, accountId: expense.accountId, notes: expense.notes } : {}) };
  });
  return changed ? { ...state, planning: { ...state.planning, occurrences } } : state;
}
