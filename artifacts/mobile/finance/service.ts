import type { Account, Expense, Income, FinanceState, EMIPayment, LoanPayment } from "../context/FinanceContext";
import {
  type Transaction, type TransactionType, type ReferenceType, type LedgerAccount,
  directionFor, getAccountBalance, localDate, newId, positiveMoney,
  transferEntries, upsertTransaction, validateTransaction, deleteLedgerEntry, minorUnits,
  validLocalDate,
} from "./ledger";

export function ledgerAccounts(state: FinanceState): LedgerAccount[] {
  return state.accounts.map(a => ({
    id: a.id, openingBalance: a.openingBalance ?? a.balance, currency: a.currency ?? state.currency,
  }));
}

export function balances(state: FinanceState): Account[] {
  return state.accounts.map(a => ({
    ...a,
    openingBalance: a.openingBalance ?? a.balance,
    currency: a.currency ?? state.currency,
    balance: getAccountBalance({
      id: a.id, openingBalance: a.openingBalance ?? a.balance, currency: a.currency ?? state.currency,
    }, state.transactions ?? []),
  }));
}

export interface MovementInput {
  id: string;
  type: TransactionType;
  amount: number;
  date: string;
  description: string;
  category: string;
  accountId?: string;
  notes?: string;
  referenceType?: ReferenceType;
  referenceId?: string;
  paymentId?: string;
  currency?: string;
  recurringOccurrenceId?: string;
}

export function movement(state: FinanceState, input: MovementInput): Transaction {
  const account = state.accounts.find(a => a.id === input.accountId);
  const t: Transaction = {
    ...input, operationId: input.id, originType: input.referenceType,
    amount: positiveMoney(input.amount), currency: input.currency ?? account?.currency ?? state.currency,
    direction: directionFor(input.type), createdAt: new Date().toISOString(),
  };
  validateTransaction(t, ledgerAccounts(state));
  return t;
}

export function putMovement(state: FinanceState, input: MovementInput): FinanceState {
  const t = movement(state, input);
  const old = (state.transactions ?? []).find(entry => entry.id === t.id);
  if (old) t.updatedAt = new Date().toISOString();
  return { ...state, transactions: upsertTransaction(state.transactions ?? [], t) };
}

export function removeReference(state: FinanceState, referenceType: ReferenceType, referenceId: string, paymentId?: string): FinanceState {
  return {
    ...state,
    transactions: (state.transactions ?? []).filter(t =>
      !(t.referenceType === referenceType && t.referenceId === referenceId && (!paymentId || t.paymentId === paymentId))),
  };
}

/** Removing a source is not a reversal of money that actually moved. */
export function detachReference(state: FinanceState, referenceType: ReferenceType, referenceId: string): FinanceState {
  const occurrenceId = referenceType === "expense" ? state.expenses.find(e => e.id === referenceId)?.recurringOccurrenceId : undefined;
  return { ...state, transactions: (state.transactions ?? []).map(t =>
    t.referenceType === referenceType && t.referenceId === referenceId ? {
      ...t, originType: t.originType ?? referenceType, recurringOccurrenceId: t.recurringOccurrenceId ?? occurrenceId,
      referenceType: undefined, referenceId: undefined,
    } : t) };
}

type DomainSourceType = "expense" | "income" | "emi" | "loan" | "savings_goal";

/** Remove a domain record while keeping its actual ledger history and stable payment identity. */
export function deleteDomainSource(state: FinanceState, type: DomainSourceType, id: string): FinanceState {
  if (type === "expense") {
    if (!state.expenses.some(x => x.id === id)) return state;
    const next = detachReference(state, type, id);
    return { ...next, expenses: next.expenses.filter(x => x.id !== id) };
  }
  if (type === "income") {
    if (!state.incomes.some(x => x.id === id)) return state;
    const next = detachReference(state, type, id);
    return { ...next, incomes: next.incomes.filter(x => x.id !== id) };
  }
  if (type === "emi") {
    if (!state.emis.some(x => x.id === id)) return state;
    const next = detachReference(state, type, id);
    return { ...next, emis: next.emis.filter(x => x.id !== id) };
  }
  if (type === "loan") {
    if (!state.loans.some(x => x.id === id)) return state;
    const next = detachReference(state, type, id);
    return { ...next, loans: next.loans.filter(x => x.id !== id) };
  }
  if (!state.savingsGoals.some(x => x.id === id)) return state;
  const next = detachReference(state, type, id);
  return { ...next, savingsGoals: next.savingsGoals.filter(x => x.id !== id) };
}

/** Delete an account only when no confirmed or historical payment points to it. */
export function deleteAccount(state: FinanceState, accountId: string): FinanceState {
  if (!state.accounts.some(a => a.id === accountId)) return state;
  const legacyOrphans =
    state.expenses.some(e => e.accountId === accountId && (e.isPaid || !!e.paymentId || !!e.paidDate)) ||
    state.incomes.some(i => i.accountId === accountId && i.kind !== "expected") ||
    state.emis.some(e => (e.paymentHistory ?? []).some(p => p.accountId === accountId)) ||
    state.loans.some(l => l.funding?.accountId === accountId || l.payments.some(p => p.accountId === accountId)) ||
    (state.planning?.occurrences ?? []).some(o => o.status === "paid" && o.accountId === accountId);
  if ((state.transactions ?? []).some(t => t.accountId === accountId) || legacyOrphans) {
    throw new Error("This account is referenced by transactions or payment history. Keep it to preserve financial history.");
  }
  const planning = state.planning ? {
    ...state.planning,
    recurring: state.planning.recurring.map(r => r.accountId === accountId ? { ...r, accountId: undefined } : r),
    occurrences: state.planning.occurrences.map(o =>
      o.status !== "paid" && o.accountId === accountId ? { ...o, accountId: undefined } : o),
  } : undefined;
  return {
    ...state,
    accounts: state.accounts.filter(a => a.id !== accountId),
    expenses: state.expenses.map(e => !e.isPaid && !e.paymentId && !e.paidDate && e.accountId === accountId ? { ...e, accountId: undefined } : e),
    incomes: state.incomes.map(i => i.kind === "expected" && i.accountId === accountId ? { ...i, accountId: undefined } : i),
    emis: state.emis.map(e => e.linkedAccountId === accountId ? { ...e, linkedAccountId: undefined } : e),
    loans: state.loans.map(l => l.linkedAccountId === accountId ? { ...l, linkedAccountId: undefined } : l),
    planning,
  };
}

export function saveIncome(state: FinanceState, income: Income): FinanceState {
  const before = state.incomes.find(i => i.id === income.id);
  positiveMoney(income.amount);
  if (!income.name.trim()) throw new Error("Enter an income name.");
  if (before?.kind === "received" && income.kind !== "received") throw new Error("A received payment cannot become a plan. Remove the source to retain its history, then add expected income.");
  if (income.kind === "received" && !validLocalDate(income.date ?? "")) throw new Error("Enter the actual received date.");
  if (!before && (state.transactions ?? []).some(t => t.id === `income:${income.id}`)) return state;
  return synchronizeDomain(state, { ...state, incomes: before
    ? state.incomes.map(i => i.id === income.id ? { ...income, currency: income.currency ?? state.currency } : i)
    : [...state.incomes, { ...income, currency: income.currency ?? state.currency }] });
}

export function saveExpense(state: FinanceState, expense: Expense): FinanceState {
  const before = state.expenses.find(e => e.id === expense.id);
  positiveMoney(expense.amount);
  if (!expense.name.trim() || !expense.category.trim()) throw new Error("Enter a name and category.");
  if (!before && (state.transactions ?? []).some(t => t.id === `expense:${expense.paymentId ?? expense.id}`)) return state;
  const normalized = { ...expense, currency: expense.currency ?? state.currency,
    paymentId: before?.isPaid ? before.paymentId : (expense.isPaid ? expense.paymentId ?? expense.id : undefined) };
  return synchronizeDomain(state, { ...state, expenses: before
    ? state.expenses.map(e => e.id === expense.id ? normalized : e) : [...state.expenses, normalized] });
}

export function setExpensePayment(state: FinanceState, id: string, input: {
  paid: boolean; operationId: string; date?: string; accountId?: string;
}): FinanceState {
  const expense = state.expenses.find(e => e.id === id);
  if (!expense) throw new Error("Expense no longer exists.");
  // Explicit desired status, never a read-then-toggle race.
  if (expense.isPaid === input.paid) return state;
  if (!input.paid) {
    const next = expense.paymentId ? {
      ...state, transactions: (state.transactions ?? []).filter(t => !(t.referenceType === "expense" && t.referenceId === id && t.paymentId === expense.paymentId)),
    } : state;
    return { ...next, expenses: next.expenses.map(e => e.id === id ? { ...e, isPaid: false, paymentId: undefined, paidDate: undefined } : e) };
  }
  const paid: Expense = {
    ...expense, isPaid: true, paymentId: input.operationId,
    paidDate: input.date ?? localDate(), accountId: input.accountId,
    currency: expense.currency ?? state.currency,
  };
  const next = putMovement(state, {
    id: `expense:${input.operationId}`, type: "expense", amount: paid.amount,
    date: paid.paidDate!, description: paid.name, category: paid.category,
    accountId: paid.accountId, currency: paid.currency, notes: paid.notes,
    referenceType: "expense", referenceId: id, paymentId: input.operationId,
    recurringOccurrenceId: paid.recurringOccurrenceId,
  });
  return { ...next, expenses: next.expenses.map(e => e.id === id ? paid : e) };
}

export function addManualMovement(state: FinanceState, input: Omit<MovementInput, "type"> & { type: "income" | "expense" }): FinanceState {
  if (input.type !== "income" && input.type !== "expense") throw new Error("Record EMI and loan payments through their own payment flow.");
  if ((state.transactions ?? []).some(t => t.operationId === input.id || t.referenceId === input.id || t.id === `${input.type}:${input.id}`)) return state;
  if (input.type === "expense") {
    const expense: Expense = {
      id: input.id, name: input.description.trim(), category: input.category,
      amount: positiveMoney(input.amount), dueDate: Number(input.date.slice(-2)), isPaid: false,
      iconName: "shopping-bag", color: "#2563EB", recurrence: "none",
      currency: input.currency ?? state.currency, notes: input.notes,
    };
    return setExpensePayment({ ...state, expenses: [...state.expenses, expense] }, expense.id, {
      paid: true, operationId: input.id, date: input.date, accountId: input.accountId,
    });
  }
  const next = putMovement(state, { ...input, id: `income:${input.id}`, referenceType: "income", referenceId: input.id });
  return {
    ...next, incomes: [...state.incomes, {
      id: input.id, name: input.description.trim(), amount: positiveMoney(input.amount), type: "other",
      color: "#2563EB", kind: "received", date: input.date, accountId: input.accountId,
      currency: input.currency ?? state.currency, category: input.category, notes: input.notes,
    }],
  };
}

export function recordTransfer(state: FinanceState, input: {
  id: string; sourceId: string; destinationId: string; amount: number;
  date: string; notes?: string; description?: string;
}): FinanceState {
  if ((state.transactions ?? []).some(t => t.transferGroupId === input.id)) return state;
  const accounts = ledgerAccounts(state);
  const source = accounts.find(a => a.id === input.sourceId);
  const destination = accounts.find(a => a.id === input.destinationId);
  if (!source || !destination) throw new Error("Select a source and destination account.");
  // Existing app allows negative balances; preserve that policy explicitly.
  const entries = transferEntries({ ...input, source, destination });
  return { ...state, transactions: [...(state.transactions ?? []), ...entries] };
}

export function deleteTransaction(state: FinanceState, id: string): FinanceState {
  const t = (state.transactions ?? []).find(entry => entry.id === id);
  if (!t) return state;
  let next = { ...state, transactions: deleteLedgerEntry(state.transactions ?? [], id) };
  if (t.referenceType === "expense") {
    next = { ...next, expenses: next.expenses.map(e => e.id === t.referenceId && e.paymentId === t.paymentId
      ? { ...e, isPaid: false, paymentId: undefined, paidDate: undefined } : e) };
  } else if (t.referenceType === "income") {
    next = { ...next, incomes: next.incomes.filter(i => i.id !== t.referenceId) };
  } else if (t.referenceType === "emi") {
    next = { ...next, emis: next.emis.map(e => {
      if (e.id !== t.referenceId) return e;
      const paymentHistory = (e.paymentHistory ?? []).filter(p => p.id !== t.paymentId);
      const legacyCount = e.paidInstallments - (e.paymentHistory ?? []).filter(p => p.paymentType === "monthly_emi").length;
      return { ...e, paymentHistory, paidInstallments: Math.max(0, legacyCount) + paymentHistory.filter(p => p.paymentType === "monthly_emi").length };
    }) };
  } else if (t.referenceType === "loan") {
    next = { ...next, loans: next.loans.map(l => l.id === t.referenceId
      ? { ...l, funding: !t.paymentId ? undefined : l.funding, payments: l.payments.filter(p => p.id !== t.paymentId) } : l) };
  } else if (t.referenceType === "savings_goal") {
    next = { ...next, savingsGoals: next.savingsGoals.map(g => g.id === t.referenceId
      ? { ...g, savedAmount: (minorUnits(g.savedAmount) - minorUnits(t.amount)) / 100 } : g) };
  }
  return next;
}

export type TransactionCorrection = Pick<Transaction, "amount" | "date" | "description" | "category" | "accountId" | "notes">;

function paymentCorrection<T extends { amount: number; date: string; notes?: string; accountId?: string }>(
  payment: T,
  changes: Partial<Pick<T, "amount" | "date" | "notes" | "accountId">>
): Pick<T, "amount" | "date" | "notes" | "accountId"> {
  return {
    amount: changes.amount ?? payment.amount,
    date: changes.date ?? payment.date,
    notes: "notes" in changes ? changes.notes : payment.notes,
    accountId: "accountId" in changes ? changes.accountId : payment.accountId,
  };
}

function validateLegacyPayment(state: FinanceState, amount: number, date: string, accountId: string | undefined, currency: string): void {
  positiveMoney(amount);
  if (!validLocalDate(date)) throw new Error("Enter a valid payment date.");
  if (accountId === undefined) return;
  const account = state.accounts.find(a => a.id === accountId);
  if (!account) throw new Error("The selected account no longer exists.");
  if ((account.currency ?? state.currency) !== currency) throw new Error("Select an account in the payment currency.");
}

/** A legacy record without a ledger event may be corrected as history only; it never creates cash. */
export function updateEMIPayment(state: FinanceState, emiId: string, paymentId: string, updates: Partial<Pick<EMIPayment, "amount" | "date" | "notes" | "accountId">>): FinanceState {
  const emi = state.emis.find(e => e.id === emiId);
  const payment = emi?.paymentHistory?.find(p => p.id === paymentId);
  if (!emi || !payment) throw new Error("EMI payment no longer exists.");
  const corrected = paymentCorrection(payment, updates);
  validateLegacyPayment(state, corrected.amount, corrected.date, corrected.accountId, emi.currency ?? state.currency);
  const history = emi.paymentHistory ?? [];
  if (payment.paymentType === "balloon") {
    const other = history.filter(p => p.paymentType === "balloon" && p.id !== paymentId)
      .reduce((sum, p) => sum + minorUnits(p.amount), 0);
    if (other + minorUnits(corrected.amount) > minorUnits(emi.balloonPaymentAmount ?? 0)) throw new Error("Amount exceeds the remaining balloon balance.");
  }
  const transaction = (state.transactions ?? []).find(t =>
    t.referenceType === "emi" && t.referenceId === emiId && t.paymentId === paymentId);
  if (transaction) {
    if (payment.paymentType === "monthly_emi" && minorUnits(corrected.amount) !== minorUnits(emi.monthlyEMIAmount ?? emi.monthlyAmount)) {
      throw new Error("Monthly payment must match the scheduled EMI amount.");
    }
    if (transaction.type !== (payment.paymentType === "balloon" ? "balloon_payment" : "emi_payment")) throw new Error("The linked EMI transaction has the wrong type.");
    return updateTransaction(state, transaction.id, {
      ...corrected, description: transaction.description, category: transaction.category,
    });
  }
  if (!payment.legacy && !payment.id.startsWith("imported-")) throw new Error("No linked EMI transaction exists. Payment history was preserved.");
  return { ...state, emis: state.emis.map(e => e.id === emiId ? {
    ...e, paymentHistory: history.map(p => p.id === paymentId ? { ...p, ...corrected } : p),
  } : e) };
}

export function updateLoanPayment(state: FinanceState, loanId: string, paymentId: string, updates: Partial<Pick<LoanPayment, "amount" | "date" | "notes" | "accountId">>): FinanceState {
  const loan = state.loans.find(l => l.id === loanId);
  const payment = loan?.payments.find(p => p.id === paymentId);
  if (!loan || !payment) throw new Error("Loan payment no longer exists.");
  const corrected = paymentCorrection(payment, updates);
  validateLegacyPayment(state, corrected.amount, corrected.date, corrected.accountId, loan.currency ?? state.currency);
  const newTotal = loan.payments.filter(p => p.id !== paymentId).reduce((sum, p) => sum + minorUnits(p.amount), minorUnits(corrected.amount));
  if (newTotal > minorUnits(loan.totalRepaymentAmount ?? loan.principalAmount)) throw new Error("Amount exceeds the remaining loan balance.");
  const transaction = (state.transactions ?? []).find(t =>
    t.referenceType === "loan" && t.referenceId === loanId && t.paymentId === paymentId);
  if (transaction) {
    if (transaction.type !== (loan.direction === "borrowed" ? "loan_repayment" : "loan_received")) throw new Error("The linked loan transaction has the wrong type.");
    return updateTransaction(state, transaction.id, {
      ...corrected, description: transaction.description, category: transaction.category,
    });
  }
  if (!payment.legacy) throw new Error("No linked loan transaction exists. Payment history was preserved.");
  return { ...state, loans: state.loans.map(l => l.id === loanId ? {
    ...l, payments: l.payments.map(p => p.id === paymentId ? { ...p, ...corrected } : p),
  } : l) };
}

export function reverseEMIPayment(state: FinanceState, emiId: string, paymentId: string): FinanceState {
  const payment = state.emis.find(e => e.id === emiId)?.paymentHistory?.find(p => p.id === paymentId);
  if (!payment) throw new Error("EMI payment no longer exists.");
  const transaction = (state.transactions ?? []).find(t =>
    t.referenceType === "emi" && t.referenceId === emiId && t.paymentId === paymentId);
  if (!transaction) throw new Error("No linked transaction exists; the historical EMI record was kept.");
  if (transaction.type !== (payment.paymentType === "balloon" ? "balloon_payment" : "emi_payment")) throw new Error("The linked EMI transaction has the wrong type.");
  return deleteTransaction(state, transaction.id);
}

export function reverseLoanPayment(state: FinanceState, loanId: string, paymentId: string): FinanceState {
  const loan = state.loans.find(l => l.id === loanId);
  if (!loan?.payments.some(p => p.id === paymentId)) throw new Error("Loan payment no longer exists.");
  const transaction = (state.transactions ?? []).find(t =>
    t.referenceType === "loan" && t.referenceId === loanId && t.paymentId === paymentId);
  if (!transaction) throw new Error("No linked transaction exists; the historical loan record was kept.");
  if (transaction.type !== (loan.direction === "borrowed" ? "loan_repayment" : "loan_received")) throw new Error("The linked loan transaction has the wrong type.");
  return deleteTransaction(state, transaction.id);
}

export function updateTransaction(state: FinanceState, id: string, changes: TransactionCorrection): FinanceState {
  const t = (state.transactions ?? []).find(entry => entry.id === id);
  if (!t) throw new Error("Transaction no longer exists.");
  const updated = { ...t, ...changes, updatedAt: new Date().toISOString() };
  validateTransaction(updated, ledgerAccounts(state));
  if (t.type === "transfer") {
    const pair = (state.transactions ?? []).filter(x => x.transferGroupId === t.transferGroupId);
    if (pair.length !== 2) throw new Error("Transfer pair is incomplete. Reconcile this account before editing.");
    const other = pair.find(x => x.id !== id)!;
    if (!updated.accountId || updated.accountId === other.accountId) throw new Error("Choose two different accounts.");
    const nextPair = pair.map(x => x.id === id ? updated : {
      ...x, amount: updated.amount, date: updated.date, description: updated.description,
      notes: updated.notes, updatedAt: updated.updatedAt,
    });
    nextPair.forEach(x => validateTransaction(x, ledgerAccounts(state)));
    return { ...state, transactions: (state.transactions ?? []).map(x => nextPair.find(p => p.id === x.id) ?? x) };
  }
  let next = { ...state, transactions: upsertTransaction(state.transactions ?? [], updated) };
  if (t.referenceType === "expense") {
    const e = state.expenses.find(x => x.id === t.referenceId);
    if (e && e.paymentId === t.paymentId) next = { ...next, expenses: next.expenses.map(x => x.id === e.id ? {
      ...x, name: changes.description, amount: changes.amount, category: changes.category,
      accountId: changes.accountId, paidDate: changes.date, notes: changes.notes,
    } : x) };
  } else if (t.referenceType === "income") {
    next = { ...next, incomes: next.incomes.map(i => i.id === t.referenceId ? {
      ...i, name: changes.description, amount: changes.amount, date: changes.date,
      accountId: changes.accountId, category: changes.category, notes: changes.notes,
    } : i) };
  } else if (t.referenceType === "emi") {
    const emi = next.emis.find(e => e.id === t.referenceId);
    if (!emi?.paymentHistory?.some(p => p.id === t.paymentId)) throw new Error("The linked EMI payment is missing.");
    const payment = emi.paymentHistory.find(p => p.id === t.paymentId)!;
    if (payment.paymentType === "monthly_emi" && minorUnits(changes.amount) !== minorUnits(emi.monthlyEMIAmount ?? emi.monthlyAmount)) {
      throw new Error("Monthly payment must match the scheduled EMI amount.");
    }
    if (t.type === "balloon_payment") {
      const other = emi.paymentHistory.filter(p => p.paymentType === "balloon" && p.id !== t.paymentId).reduce((sum, p) => sum + minorUnits(p.amount), 0);
      if (other + minorUnits(changes.amount) > minorUnits(emi.balloonPaymentAmount ?? 0)) throw new Error("Amount exceeds the remaining balloon balance.");
    }
    next = { ...next, emis: next.emis.map(e => e.id === emi.id ? {
      ...e, paymentHistory: e.paymentHistory?.map(p => p.id === t.paymentId
        ? { ...p, amount: changes.amount, date: changes.date, accountId: changes.accountId, notes: changes.notes } : p),
    } : e) };
  } else if (t.referenceType === "loan") {
    const loan = next.loans.find(l => l.id === t.referenceId);
    if (loan && !t.paymentId && loan.funding?.transactionId === t.id) {
      return { ...next, loans: next.loans.map(l => l.id === loan.id ? {
        ...l, funding: { transactionId: t.id, amount: changes.amount, date: changes.date, accountId: changes.accountId, notes: changes.notes },
      } : l) };
    }
    if (!loan?.payments.some(p => p.id === t.paymentId)) throw new Error("The linked loan payment is missing.");
    const other = loan.payments.filter(p => p.id !== t.paymentId).reduce((sum, p) => sum + minorUnits(p.amount), 0);
    if (other + minorUnits(changes.amount) > minorUnits(loan.totalRepaymentAmount ?? loan.principalAmount)) throw new Error("Amount exceeds the remaining loan balance.");
    next = { ...next, loans: next.loans.map(l => l.id === loan.id ? {
      ...l, payments: l.payments.map(p => p.id === t.paymentId
        ? { ...p, amount: changes.amount, date: changes.date, accountId: changes.accountId, notes: changes.notes } : p),
    } : l) };
  } else if (t.referenceType === "savings_goal") {
    next = { ...next, savingsGoals: next.savingsGoals.map(g => g.id === t.referenceId
      ? { ...g, savedAmount: (minorUnits(g.savedAmount) - minorUnits(t.amount) + minorUnits(changes.amount)) / 100 } : g) };
  }
  return next;
}

export function reconcileAccountBalance(state: FinanceState, input: {
  id: string; accountId: string; actualBalance: number; date: string; notes?: string;
}): FinanceState {
  if ((state.transactions ?? []).some(t => t.operationId === input.id)) return state;
  const account = ledgerAccounts(state).find(a => a.id === input.accountId);
  if (!account) throw new Error("Account no longer exists.");
  const difference = minorUnits(input.actualBalance) - minorUnits(getAccountBalance(account, state.transactions ?? []));
  const reconciledAccountIds = Array.from(new Set([...(state.reconciledAccountIds ?? []), account.id]));
  const reviewed = {
    ...state, reconciledAccountIds,
    reconciliationRequired: state.accounts.some(a => !reconciledAccountIds.includes(a.id)),
  };
  if (!difference) return reviewed;
  const t = movement(state, {
    id: input.id, type: "adjustment", amount: Math.abs(difference) / 100,
    date: input.date, description: "Balance reconciliation", category: "Reconciliation",
    accountId: input.accountId, notes: input.notes, currency: account.currency,
  });
  t.direction = difference > 0 ? "in" : "out";
  return { ...reviewed, transactions: [...(state.transactions ?? []), t] };
}

export const createOperationId = newId;

export function recordLoanFunding(state: FinanceState, loanId: string, input: { id: string; accountId?: string; date: string }): FinanceState {
  const loan = state.loans.find(l => l.id === loanId);
  if (!loan) throw new Error("Loan no longer exists.");
  if (loan.funding) return state;
  const id = `loan-funding:${input.id}`;
  const next = putMovement(state, {
    id, type: loan.direction === "borrowed" ? "loan_received" : "expense",
    amount: loan.principalAmount, date: input.date, accountId: input.accountId,
    description: `${loan.name} · principal ${loan.direction === "borrowed" ? "received" : "lent"}`,
    category: "Loan principal", currency: loan.currency ?? state.currency,
    referenceType: "loan", referenceId: loanId,
  });
  return { ...next, loans: next.loans.map(l => l.id === loanId ? {
    ...l, funding: { transactionId: id, amount: loan.principalAmount, date: input.date, accountId: input.accountId },
  } : l) };
}

export function contributeToSavings(state: FinanceState, input: {
  id: string; goalId: string; amount: number; accountId?: string; date: string; notes?: string;
}): FinanceState {
  if ((state.transactions ?? []).some(t => t.operationId === input.id)) return state;
  const goal = state.savingsGoals.find(g => g.id === input.goalId);
  if (!goal) throw new Error("Savings goal no longer exists.");
  const amount = positiveMoney(input.amount);
  const next = putMovement(state, {
    id: input.id, type: "savings_contribution", amount, date: input.date,
    description: goal.name, category: "Savings", accountId: input.accountId, notes: input.notes,
    currency: goal.currency ?? state.currency,
    referenceType: "savings_goal", referenceId: goal.id,
  });
  return { ...next, savingsGoals: next.savingsGoals.map(g => g.id === goal.id
    ? { ...g, savedAmount: (minorUnits(g.savedAmount) + minorUnits(amount)) / 100 } : g) };
}

export function confirmEMIPayment(state: FinanceState, emiId: string, input: Omit<EMIPayment, "id" | "status">): FinanceState {
  const emi = state.emis.find(e => e.id === emiId);
  if (!emi) throw new Error("EMI no longer exists.");
  if (input.operationId && emi.paymentHistory?.some(p => p.operationId === input.operationId)) return state;
  positiveMoney(input.amount);
  if (!validLocalDate(input.date)) throw new Error("Enter a valid payment date.");
  if (input.paymentType !== "monthly_emi" && input.paymentType !== "balloon") throw new Error("Invalid payment type.");
  if (input.paymentType === "monthly_emi") {
    if (emi.paidInstallments >= emi.totalInstallments) throw new Error("All installments have already been recorded.");
    if (minorUnits(input.amount) !== minorUnits(emi.monthlyEMIAmount ?? emi.monthlyAmount)) throw new Error("Payment must match the scheduled installment.");
  } else {
    const paid = (emi.paymentHistory ?? []).filter(p => p.paymentType === "balloon").reduce((s, p) => s + minorUnits(p.amount), 0);
    if (paid + minorUnits(input.amount) > minorUnits(emi.balloonPaymentAmount ?? 0)) throw new Error("Payment exceeds the balloon balance.");
  }
  const p: EMIPayment = {
    ...input, id: input.operationId ?? newId(), status: "paid",
    accountId: "accountId" in input ? input.accountId : emi.linkedAccountId,
  };
  return synchronizeDomain(state, { ...state, emis: state.emis.map(e => e.id === emiId ? {
    ...e, paymentHistory: [...(e.paymentHistory ?? []), p],
    paidInstallments: e.paidInstallments + (p.paymentType === "monthly_emi" ? 1 : 0),
  } : e) });
}

export function confirmLoanPayment(state: FinanceState, loanId: string, input: Omit<LoanPayment, "id">): FinanceState {
  const loan = state.loans.find(l => l.id === loanId);
  if (!loan) throw new Error("Loan no longer exists.");
  if (input.operationId && loan.payments.some(p => p.operationId === input.operationId)) return state;
  positiveMoney(input.amount);
  if (!validLocalDate(input.date)) throw new Error("Enter a valid payment date.");
  const paid = loan.payments.reduce((s, p) => s + minorUnits(p.amount), 0);
  if (paid + minorUnits(input.amount) > minorUnits(loan.totalRepaymentAmount ?? loan.principalAmount)) throw new Error("Payment exceeds the loan balance.");
  const p = { ...input, id: input.operationId ?? newId() };
  return synchronizeDomain(state, { ...state, loans: state.loans.map(l => l.id === loanId ? { ...l, payments: [...l.payments, p] } : l) });
}

/** Synchronize domain-owned changes in the same state document, never a second balance mutation. */
export function synchronizeDomain(previous: FinanceState, proposed: FinanceState): FinanceState {
  let next = proposed;
  for (const e of next.expenses) {
    const before = previous.expenses.find(x => x.id === e.id);
    if (e.isPaid && (!before?.isPaid || e.paymentId) && before !== e) {
      const paymentId = e.paymentId ?? newId();
      const normalized = { ...e, paymentId, paidDate: e.paidDate ?? localDate(), currency: e.currency ?? next.currency };
      next = { ...next, expenses: next.expenses.map(x => x.id === e.id ? normalized : x) };
      next = putMovement(next, {
        id: `expense:${paymentId}`, type: "expense", amount: e.amount,
        date: normalized.paidDate, description: e.name, category: e.category,
        accountId: e.accountId, notes: e.notes, currency: normalized.currency,
        referenceType: "expense", referenceId: e.id, paymentId,
        recurringOccurrenceId: e.recurringOccurrenceId,
      });
    } else if (!e.isPaid && before?.isPaid && before.paymentId) {
      next = { ...next, transactions: (next.transactions ?? []).filter(t => !(t.referenceType === "expense" && t.referenceId === e.id && t.paymentId === before.paymentId)) };
      next = { ...next, expenses: next.expenses.map(x => x.id === e.id ? { ...x, paymentId: undefined, paidDate: undefined } : x) };
    }
  }
  for (const e of previous.expenses) if (!next.expenses.some(x => x.id === e.id)) {
    // Source metadata is still available in previous when the paid source is removed.
    next = { ...next, transactions: detachReference({ ...next, expenses: previous.expenses }, "expense", e.id).transactions };
  }
  for (const emi of next.emis) {
    const before = previous.emis.find(e => e.id === emi.id);
    for (const p of emi.paymentHistory ?? []) {
      const old = before?.paymentHistory?.find(x => x.id === p.id);
      if (p.legacy || p.id.startsWith("imported-")) continue;
      if (old === p && (next.transactions ?? []).some(t => t.referenceType === "emi" && t.paymentId === p.id)) continue;
      next = putMovement(next, {
        id: `emi:${emi.id}:${p.id}`, type: p.paymentType === "balloon" ? "balloon_payment" : "emi_payment",
        amount: p.amount, date: p.date,
        description: (next.transactions ?? []).find(t => t.paymentId === p.id)?.description ?? emi.name,
        category: (next.transactions ?? []).find(t => t.paymentId === p.id)?.category ?? (p.paymentType === "balloon" ? "Balloon payment" : "EMI"),
        accountId: p.accountId, notes: p.notes,
        currency: emi.currency ?? next.currency,
        referenceType: "emi", referenceId: emi.id, paymentId: p.id,
      });
    }
    for (const p of before?.paymentHistory ?? []) {
      if (!(emi.paymentHistory ?? []).some(x => x.id === p.id)) next = removeReference(next, "emi", emi.id, p.id);
    }
  }
  for (const e of previous.emis) if (!next.emis.some(x => x.id === e.id)) next = detachReference(next, "emi", e.id);
  for (const loan of next.loans) {
    const before = previous.loans.find(l => l.id === loan.id);
    for (const p of loan.payments) {
      const old = before?.payments.find(x => x.id === p.id);
      if (p.legacy) continue;
      if (old === p && (next.transactions ?? []).some(t => t.referenceType === "loan" && t.paymentId === p.id)) continue;
      next = putMovement(next, {
        id: `loan:${loan.id}:${p.id}`, type: loan.direction === "borrowed" ? "loan_repayment" : "loan_received",
        amount: p.amount, date: p.date,
        description: (next.transactions ?? []).find(t => t.paymentId === p.id)?.description ?? loan.name,
        category: (next.transactions ?? []).find(t => t.paymentId === p.id)?.category ?? "Loan payment",
        accountId: p.accountId, notes: p.notes, currency: loan.currency ?? next.currency, referenceType: "loan", referenceId: loan.id, paymentId: p.id,
      });
    }
    for (const p of before?.payments ?? []) if (!loan.payments.some(x => x.id === p.id)) next = removeReference(next, "loan", loan.id, p.id);
  }
  for (const l of previous.loans) if (!next.loans.some(x => x.id === l.id)) next = detachReference(next, "loan", l.id);
  for (const income of next.incomes) {
    if (income.kind !== "received") {
      if (previous.incomes.find(i => i.id === income.id)?.kind === "received") throw new Error("Received income cannot be changed into expected income.");
      continue;
    }
    const oldIncome = previous.incomes.find(i => i.id === income.id);
    if (oldIncome === income) continue;
    // Legacy receipts without ledger evidence are not silently replayed.
    if (oldIncome?.kind === "received" && !(next.transactions ?? []).some(t => t.referenceType === "income" && t.referenceId === income.id)) continue;
    next = putMovement(next, {
      id: `income:${income.id}`, type: "income", amount: income.amount, date: income.date ?? localDate(),
      description: income.name, category: income.category ?? income.type, accountId: income.accountId,
      notes: income.notes, currency: income.currency, referenceType: "income", referenceId: income.id,
    });
  }
  for (const i of previous.incomes) if (!next.incomes.some(x => x.id === i.id)) next = detachReference(next, "income", i.id);
  for (const g of previous.savingsGoals) if (!next.savingsGoals.some(x => x.id === g.id)) next = detachReference(next, "savings_goal", g.id);
  return next;
}
