import type { FinanceState } from "../context/FinanceContext";
import type { UpcomingPayment, UpcomingType } from "./planningTypes";
import { localDate, minorUnits, validLocalDate, newId } from "./ledger";
import { addDays, addMonths, parseLocal } from "./calendar";
import { occurrenceFor, scheduleDates, payRecurring } from "./recurring";
import { confirmEMIPayment, confirmLoanPayment } from "./service";
export function dueStatus(date: string, today = localDate()): UpcomingPayment["status"] {
  return date < today ? "overdue" : date === today ? "due_today" : "upcoming";
}
export function getUpcoming(state: FinanceState, from: string, to: string, today = localDate()): UpcomingPayment[] {
  parseLocal(from); parseLocal(to);
  if (from > to) throw new Error("The end date must follow the start date.");
  const result: UpcomingPayment[] = [], seen = new Set<string>();
  const add = (item: UpcomingPayment) => {
    if (!validLocalDate(item.dueDate) || item.dueDate < from || item.dueDate > to || seen.has(item.id)) return;
    seen.add(item.id);
    result.push({ ...item, accountId: state.accounts.some(a => a.id === item.accountId) ? item.accountId : undefined });
  };
  for (const r of state.planning?.recurring ?? []) {
    const existing = state.planning!.occurrences.filter(o => o.recurringId === r.id);
    const occurrences = [...existing];
    const datesValid = validLocalDate(r.startDate) && validLocalDate(r.nextDueDate) &&
      (!r.endDate || validLocalDate(r.endDate));
    if (r.active && !r.deleted && datesValid) scheduleDates(r, from > r.nextDueDate ? from : r.nextDueDate, to).forEach(date => {
      if (!existing.some(o => o.dueDate === date)) occurrences.push(occurrenceFor(r, date));
    });
    occurrences.forEach(o => add({ id: o.id, sourceId: r.id, recurringId: r.id, occurrenceId: o.id, type: "expense",
      name: o.name, amount: o.amount, currency: o.currency, accountId: o.accountId, dueDate: o.dueDate,
      status: o.status === "pending" ? dueStatus(o.dueDate, today) : o.status,
      reminder: r.active && !r.deleted && r.reminder && o.status === "pending",
    }));
  }
  for (const e of state.emis) {
    const first = e.firstPaymentDate;
    const currency = e.currency ?? state.currency;
    if (first && validLocalDate(first)) {
      const history = (e.paymentHistory ?? []).filter(p => p.paymentType === "monthly_emi");
      let unassigned = Math.max(0, e.paidInstallments - history.filter(p => p.scheduledDueDate).length);
      for (let index = 0; index < Math.min(e.durationMonths ?? e.totalInstallments, 1200); index++) {
        const due = index === 0 ? first : addMonths(first, index, e.paymentDueDay ?? e.dueDayOfMonth);
        const linkedPayments = history.filter(p => p.scheduledDueDate === due);
        const scheduledUnits = minorUnits(e.monthlyEMIAmount ?? e.monthlyAmount);
        const recordedUnits = linkedPayments.reduce((sum, payment) => sum + minorUnits(payment.amount), 0);
        let remainingUnits = Math.max(0, scheduledUnits - recordedUnits);
        if (linkedPayments.length === 0 && unassigned > 0) {
          unassigned--;
          remainingUnits = 0;
        }
        const paid = remainingUnits === 0;
        add({ id: `emi:${e.id}:${due}`, sourceId: e.id, name: e.name, type: "emi", currency,
          dueDate: due, amount: remainingUnits / 100, accountId: e.linkedAccountId,
          status: paid ? "paid" : dueStatus(due, today), reminder: !paid });
      }
    }
    if (e.balloonPaymentDueDate && validLocalDate(e.balloonPaymentDueDate) && (e.balloonPaymentAmount ?? 0) > 0) {
      const paid = (e.paymentHistory ?? []).filter(p => p.paymentType === "balloon").reduce((s, p) => s + minorUnits(p.amount), 0);
      const remaining = Math.max(0, minorUnits(e.balloonPaymentAmount!) - paid) / 100;
      add({ id: `balloon:${e.id}:${e.balloonPaymentDueDate}`, sourceId: e.id, name: `${e.name} · Balloon`, type: "balloon",
        currency, accountId: e.linkedAccountId, dueDate: e.balloonPaymentDueDate, amount: remaining,
        status: remaining > 0 ? dueStatus(e.balloonPaymentDueDate, today) : "paid", reminder: remaining > 0 });
    }
  }
  for (const l of state.loans) {
    const anchor = l.repaymentStartDate ?? (l.repaymentFrequency === "one-time" ? l.expectedEndDate : undefined);
    if (!anchor || !validLocalDate(anchor)) continue; // Origination is not a repayment due date.
    const total = minorUnits(l.totalRepaymentAmount ?? l.principalAmount);
    const installment = minorUnits(l.repaymentFrequency === "one-time" ? total / 100 : (l.plannedPaymentAmount ?? 0));
    if (installment <= 0) continue;
    const explicit = l.payments.filter(p => p.scheduledDueDate);
    let unassigned = l.payments.filter(p => !p.scheduledDueDate).reduce((s, p) => s + minorUnits(p.amount), 0);
    for (let index = 0; index < Math.min(Math.ceil(total / installment), 1200); index++) {
      const due = l.repaymentFrequency === "weekly" ? addDays(anchor, index * 7) : addMonths(anchor, index * (l.repaymentFrequency === "quarterly" ? 3 : 1));
      if (l.expectedEndDate && due > l.expectedEndDate && l.repaymentFrequency !== "one-time") break;
      const scheduled = Math.min(installment, total - index * installment);
      const assigned = explicit.filter(p => p.scheduledDueDate === due).reduce((s, p) => s + minorUnits(p.amount), 0);
      const allocation = Math.min(Math.max(0, scheduled - assigned), unassigned);
      unassigned -= allocation;
      const remaining = Math.max(0, scheduled - assigned - allocation);
      add({ id: `loan:${l.id}:${due}`, sourceId: l.id, type: "loan", name: l.direction === "lent" ? `${l.name} · Receipt` : l.name,
        amount: remaining / 100, currency: l.currency ?? state.currency, dueDate: due, accountId: l.linkedAccountId,
        status: remaining ? dueStatus(due, today) : "paid", reminder: remaining > 0 });
    }
  }
  return result.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
}
export function filterUpcoming(items: UpcomingPayment[], type: UpcomingType | "all", from: string, to: string): UpcomingPayment[] {
  return items.filter(i => (type === "all" || i.type === type) && i.dueDate >= from && i.dueDate <= to);
}
export function recordScheduledPayment(state: FinanceState, item: UpcomingPayment, accountId: string | undefined, date: string, amount?: number, submissionId?: string): FinanceState {
  const operationId = `scheduled:${item.id}:${submissionId ?? (item.type === "emi" ? "installment" : newId())}`;
  const payments = item.type === "loan" ? state.loans.find(l => l.id === item.sourceId)?.payments
    : state.emis.find(e => e.id === item.sourceId)?.paymentHistory;
  if (payments?.some(p => p.operationId === operationId)) return state;
  const current = getUpcoming(state, item.dueDate, item.dueDate).find(i => i.id === item.id);
  if (!current) throw new Error("This scheduled commitment no longer exists.");
  if (current.status === "paid") return state;
  if (current.status === "skipped") throw new Error("Skipped occurrences cannot be charged.");
  if (item.type === "expense") return payRecurring(state, item.sourceId, item.dueDate, { accountId, date });
  if (minorUnits(amount ?? current.amount) > minorUnits(current.amount)) throw new Error("Payment exceeds this scheduled occurrence's remaining amount.");
  if (item.type === "loan") return confirmLoanPayment(state, item.sourceId, {
    amount: amount ?? current.amount, date, accountId, operationId, scheduledDueDate: item.dueDate,
  });
  return confirmEMIPayment(state, item.sourceId, {
    amount: amount ?? current.amount, date, accountId, operationId, scheduledDueDate: item.dueDate,
    paymentType: item.type === "balloon" ? "balloon" : "monthly_emi",
  });
}
