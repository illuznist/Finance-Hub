import type { FinanceState } from "../context/FinanceContext";
import { localDate, minorUnits, validLocalDate } from "./ledger";
import { balances } from "./service";
import type { NetWorthSnapshot, NetWorthView, NetWorthItem } from "./analyticsTypes";

export function analyticsCurrencies(state: FinanceState): string[] {
  return [...new Set([state.currency, ...state.accounts.map(a => a.currency ?? state.currency),
    ...(state.transactions ?? []).map(t => t.currency), ...state.loans.map(l => l.currency ?? state.currency),
    ...state.incomes.map(i => i.currency ?? state.currency), ...state.savingsGoals.map(g => g.currency ?? state.currency),
    ...(state.netWorthSnapshots ?? []).map(s => s.currency)])].sort();
}
export function validSnapshot(s: NetWorthSnapshot): boolean {
  return !!s && validLocalDate(s.date) && typeof s.currency === "string" && !!s.currency &&
    [s.assets, s.liabilities, s.netWorth].every(v => Number.isFinite(v) && Number.isSafeInteger(Math.round(v * 100)) && Math.abs(v * 100 - Math.round(v * 100)) < 0.00001) &&
    s.assets >= 0 && s.liabilities >= 0 && minorUnits(s.netWorth) === minorUnits(s.assets) - minorUnits(s.liabilities) &&
    Number.isFinite(Date.parse(s.capturedAt));
}
export function currentNetWorth(state: FinanceState, currency: string, today = localDate()): NetWorthView {
  const accounts = balances(state).filter(a => a.currency === currency);
  const transactions = state.transactions ?? [];
  const transactionById = new Map(transactions.map(t => [t.id, t]));
  const paymentByReference = new Map(transactions.filter(t => t.referenceType === "loan" && t.paymentId).map(t => [`${t.referenceId}:${t.paymentId}`, t]));
  const accountIds = new Set(accounts.map(a => a.id));
  const assetItems: NetWorthItem[] = [], liabilityItems: NetWorthItem[] = [];
  const excludedReceivables: NetWorthView["excludedReceivables"] = [];
  for (const a of accounts) {
    if (a.balance >= 0) assetItems.push({ id: a.id, name: a.name, kind: "account", amount: a.balance });
    else liabilityItems.push({ id: a.id, name: a.name, kind: "overdraft", amount: -a.balance });
  }
  for (const l of state.loans.filter(l => (l.currency ?? state.currency) === currency)) {
    const obligation = minorUnits(l.totalRepaymentAmount ?? l.principalAmount);
    const paid = l.payments.reduce((sum, p) => sum + minorUnits(p.amount), 0);
    const outstanding = Math.max(0, obligation - paid) / 100;
    if (l.direction === "borrowed") {
      liabilityItems.push({ id: l.id, name: l.name, kind: "borrowed", amount: outstanding });
      continue;
    }
    const funding = transactionById.get(l.funding?.transactionId ?? "");
    const account = accounts.find(a => a.id === funding?.accountId);
    let reason = "";
    if (!funding || funding.type !== "expense" || funding.direction !== "out" || funding.referenceType !== "loan" || funding.referenceId !== l.id || funding.currency !== currency || !account) reason = "No matching principal outflow from a tracked account.";
    else if (minorUnits(funding.amount) !== minorUnits(l.principalAmount)) reason = "Recorded funding differs from principal.";
    else if ((l.interestRate ?? 0) !== 0 || obligation !== minorUnits(l.principalAmount)) reason = "Principal and future interest cannot be allocated reliably.";
    else if (l.payments.some(p => {
      const t = paymentByReference.get(`${l.id}:${p.id}`);
      return p.legacy || p.date < funding.date || !t || t.type !== "loan_received" || t.currency !== currency ||
        !t.accountId || !accountIds.has(t.accountId) || minorUnits(t.amount) !== minorUnits(p.amount);
    })) {
      reason = "Repayment-to-account history is incomplete.";
    }
    if (reason) excludedReceivables.push({ id: l.id, name: l.name, reason });
    else assetItems.push({ id: l.id, name: l.name, kind: "receivable", amount: outstanding });
  }
  const assets = assetItems.reduce((s, i) => s + minorUnits(i.amount), 0) / 100;
  const liabilities = liabilityItems.reduce((s, i) => s + minorUnits(i.amount), 0) / 100;
  minorUnits(assets); minorUnits(liabilities);
  const history = (state.netWorthSnapshots ?? []).filter(s => s.currency === currency && validSnapshot(s)).sort((a, b) => a.date.localeCompare(b.date));
  const [year, month] = today.split("-").map(Number);
  const previousMonth = localDate(new Date(year, month - 2, 1)).slice(0, 7);
  const previous = history.filter(s => s.date.slice(0, 7) === previousMonth).at(-1);
  const reliable = !state.reconciliationRequired;
  const notices = [
    "Current recorded position, not a backdated balance. Goals have no independent account/custody model and are not added as assets. EMI schedules are not additional liabilities without a reliable outstanding-principal model.",
    "Borrowed liabilities use recorded remaining repayment obligations, including contractual charges where entered. No principal is automatically added to cash.",
  ];
  if (!reliable) notices.push("Account balances need reconciliation before reliable net-worth snapshots can begin.");
  if (excludedReceivables.length) notices.push(`${excludedReceivables.length} lent-loan receivable(s) excluded because funding or principal allocation is not reliable.`);
  if (analyticsCurrencies(state).length > 1) notices.push("Currencies are reported separately. A combined net worth is unavailable without conversion.");
  return { currency, assets, liabilities, netWorth: (minorUnits(assets) - minorUnits(liabilities)) / 100,
    assetItems, liabilityItems, excludedReceivables, history, historyStart: history[0]?.date ?? null,
    monthChange: reliable && previous ? (minorUnits(assets) - minorUnits(liabilities) - minorUnits(previous.netWorth)) / 100 : null, reliable, notices };
}
/** Daily observed positions only. Never fill gaps or reconstruct pre-ledger history. */
export function captureNetWorthSnapshots(state: FinanceState, today = localDate(), capturedAt = new Date().toISOString()): FinanceState {
  if (state.reconciliationRequired) return state;
  let snapshots = state.netWorthSnapshots ?? [], changed = false;
  for (const currency of analyticsCurrencies(state)) {
    const view = currentNetWorth(state, currency, today);
    const old = snapshots.find(s => s.date === today && s.currency === currency);
    if (old && old.assets === view.assets && old.liabilities === view.liabilities && old.netWorth === view.netWorth) continue;
    const next: NetWorthSnapshot = { date: today, currency, assets: view.assets, liabilities: view.liabilities, netWorth: view.netWorth, capturedAt };
    snapshots = [...snapshots.filter(s => !(s.date === today && s.currency === currency)), next];
    changed = true;
  }
  return changed ? { ...state, netWorthSnapshots: snapshots } : state;
}
