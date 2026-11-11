import type { FinanceState } from "../context/FinanceContext";
import { getUpcoming } from "./upcoming";
import { addDays, parseLocal } from "./calendar";
import { getBudgetView } from "./budgets";
import { localDate } from "./ledger";
export interface PlannedReminder {
  id: string; title: string; body: string; timestamp: number;
  data: Record<string, string>;
  alertKey?: string;
}
export interface ScheduledReminder { id: string; data: Record<string, unknown> }
export interface ReminderAdapter {
  permission(): Promise<boolean>;
  list(): Promise<ScheduledReminder[]>;
  schedule(reminder: PlannedReminder): Promise<void>;
  cancel(id: string): Promise<void>;
}
export interface ReceiptStorage { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> }
export const ALERT_RECEIPTS_KEY = "@finance_budget_alert_receipts_v2";
export function reminderOffset(timing: string): number {
  return ({ same: 0, "1day": 1, "3days": 3, "7days": 7 } as Record<string, number>)[timing] ?? 0;
}
export function buildReminderPlan(state: FinanceState, receipts: Set<string>, now = new Date()): PlannedReminder[] {
  const settings = state.notificationSettings;
  if (!settings.enabled) return [];
  const today = localDate(now), offset = reminderOffset(settings.timing), items: PlannedReminder[] = [];
  const enabled = { expense: settings.expenseEnabled, emi: settings.emiEnabled,
    balloon: settings.balloonEnabled ?? settings.emiEnabled, loan: settings.loanEnabled ?? true };
  // Platform queue is deliberately bounded. Foregrounding re-fills the rolling window.
  for (const payment of getUpcoming(state, today, addDays(today, 60), today)) {
    if (!payment.reminder || !enabled[payment.type] || payment.status === "paid" || payment.status === "skipped") continue;
    const date = parseLocal(addDays(payment.dueDate, -offset)); date.setHours(9, 0, 0, 0);
    if (date.getTime() <= now.getTime()) continue;
    items.push({ id: `finance:v2:due:${payment.id}`, timestamp: date.getTime(),
      title: `${payment.name} · Payment reminder`,
      body: `${payment.currency} ${payment.amount.toLocaleString()} due ${payment.dueDate}`,
      data: { owner: "finance-v2", type: payment.type, sourceId: payment.sourceId, occurrenceId: payment.id, dueDate: payment.dueDate } });
  }
  const alerts: PlannedReminder[] = [];
  if (settings.budgetEnabled) {
    for (const plan of state.planning?.plans ?? []) {
      const view = getBudgetView(state, today.slice(0, 7), plan.currency);
      if (!view.period.alerts) continue;
      const targets = [{ id: "overall", name: "Monthly budget", limit: view.period.limit, spent: view.spent, enabled: true },
        ...view.categories.map(c => ({ id: c.id, name: c.name, limit: c.limit, spent: c.spent, enabled: c.alerts }))];
      for (const target of targets) for (const threshold of view.period.thresholds) {
        const key = `${view.period.id}:${target.id}:${threshold}`;
        if (!target.enabled || target.limit <= 0 || target.spent / target.limit * 100 < threshold || receipts.has(key)) continue;
        alerts.push({ id: `finance:v2:budget:${key}`, alertKey: key, timestamp: now.getTime() + 5000,
          title: `${target.name} · ${threshold}% used`,
          body: `${plan.currency} ${target.spent.toLocaleString()} spent of ${target.limit.toLocaleString()}.`,
          data: { owner: "finance-v2", type: "budget", alertKey: key, currency: plan.currency, month: view.period.month, categoryId: target.id } });
      }
    }
  }
  // Leave headroom under iOS's 64 pending-notification limit.
  return [...alerts, ...items.sort((a, b) => a.timestamp - b.timestamp)].slice(0, 60);
}
function owned(item: ScheduledReminder): boolean {
  return item.data.owner === "finance-v2" || ["expense", "emi", "budget", "summary"].includes(String(item.data.type));
}
/** One queue owns reconciliation. IDs are stable; only changed/obsolete reminders are canceled. */
export function createReminderSynchronizer(adapter: ReminderAdapter, storage: ReceiptStorage) {
  let pending = Promise.resolve();
  return (state: FinanceState, now = new Date()): Promise<void> => {
    const work = pending.then(async () => {
      const scheduled = await adapter.list();
      const allowed = state.notificationSettings.enabled && await adapter.permission();
      if (!allowed) {
        await Promise.all(scheduled.filter(owned).map(r => adapter.cancel(r.id)));
        return;
      }
      const raw = await storage.getItem(ALERT_RECEIPTS_KEY);
      const parsed: unknown = raw === null ? [] : JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(k => typeof k === "string")) throw new Error("Budget reminder receipts could not be read.");
      const receipts = new Set<string>(parsed);
      const desired = buildReminderPlan(state, receipts, now);
      const byId = new Map(desired.map(r => [r.id, r]));
      for (const old of scheduled.filter(owned)) {
        // Already-claimed but still-pending budget alerts must not be canceled on the next render.
        const budget = old.data.type === "budget" && typeof old.data.currency === "string" && typeof old.data.month === "string"
          ? getBudgetView(state, old.data.month, old.data.currency) : undefined;
        const thresholdEnabled = budget?.period.thresholds.includes(Number(String(old.data.alertKey ?? "").split(":").pop()));
        const targetEnabled = budget?.period.alerts && thresholdEnabled && (old.data.categoryId === "overall" ||
          budget.categories.some(c => c.id === old.data.categoryId && c.alerts));
        const keepBudget = old.data.owner === "finance-v2" && typeof old.data.alertKey === "string" &&
          receipts.has(old.data.alertKey) && state.notificationSettings.budgetEnabled && targetEnabled;
        if (!byId.has(old.id) && !keepBudget) await adapter.cancel(old.id);
      }
      for (const reminder of desired) {
        const old = scheduled.find(s => s.id === reminder.id);
        const signature = JSON.stringify([reminder.timestamp, reminder.title, reminder.body]);
        if (!old || old.data.signature !== signature) {
          if (old) await adapter.cancel(old.id);
          await adapter.schedule({ ...reminder, data: { ...reminder.data, signature } });
        }
        if (reminder.alertKey) {
          receipts.add(reminder.alertKey);
          // Persist immediately, so later edits below/above the threshold cannot spam alerts.
          await storage.setItem(ALERT_RECEIPTS_KEY, JSON.stringify([...receipts]));
        }
      }
    });
    pending = work.catch(() => {});
    return work;
  };
}
