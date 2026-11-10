import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { Expense, EMI, NotificationSettings } from "@/context/FinanceContext";

export const NOTIFICATION_CHANNEL = "finance-reminders";

export async function setupNotificationHandler(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
      name: "Payment Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
      showBadge: true,
    });
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

function timingOffsetDays(timing: NotificationSettings["timing"]): number {
  if (timing === "3days") return 3;
  if (timing === "1day") return 1;
  return 0;
}

function nextOccurrenceOfDay(dayOfMonth: number, offsetDays: number): Date | null {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const candidate = new Date(year, month, dayOfMonth - offsetDays, 9, 0, 0);
  if (candidate > now) return candidate;

  // Try next month
  const next = new Date(year, month + 1, dayOfMonth - offsetDays, 9, 0, 0);
  if (next > now) return next;

  return null;
}

function nextEMIPaymentDate(emi: EMI): Date | null {
  const first = emi.firstPaymentDate;
  if (!first || !/^\d{4}-\d{2}-\d{2}$/.test(first)) {
    return nextOccurrenceOfDay(emi.paymentDueDay ?? emi.dueDayOfMonth, 0);
  }

  const [year, month, day] = first.split("-").map(Number);
  const dueDay = emi.paymentDueDay ?? emi.dueDayOfMonth ?? day;
  const duration = emi.durationMonths ?? emi.totalInstallments;
  let index = emi.paidInstallments;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  while (index < duration) {
    const date = new Date(year, month - 1 + index, 1, 9, 0, 0);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(index === 0 ? day : dueDay, lastDay));
    if (date >= today) return date;
    index += 1;
  }
  return null;
}

function dateWithReminderOffset(dateString: string, offsetDays: number): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  const due = new Date(year, month - 1, day, 9, 0, 0);
  if (due.getFullYear() !== year || due.getMonth() !== month - 1 || due.getDate() !== day) return null;
  const date = new Date(year, month - 1, day, 9, 0, 0);
  date.setDate(date.getDate() - offsetDays);
  return date > new Date() ? date : null;
}

function dueDateLabel(timing: NotificationSettings["timing"]): string {
  if (timing === "1day") return "tomorrow";
  if (timing === "3days") return "in 3 days";
  return "today";
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleAllNotifications(params: {
  expenses: Expense[];
  emis: EMI[];
  settings: NotificationSettings;
  currency: string;
  monthlyBudget: number;
  totalMonthlyExpenses: number;
  totalEMIMonthly: number;
}): Promise<void> {
  if (Platform.OS === "web") return;

  const { expenses, emis, settings, currency, monthlyBudget, totalMonthlyExpenses, totalEMIMonthly } = params;

  if (!settings.enabled) {
    await cancelAllScheduledNotifications();
    return;
  }

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  await cancelAllScheduledNotifications();

  const offset = timingOffsetDays(settings.timing);
  const when = dueDateLabel(settings.timing);

  const scheduled: Promise<string>[] = [];

  // ── Expense reminders ──
  if (settings.expenseEnabled) {
    const unpaidExpenses = expenses.filter((e) => !e.isPaid);
    const upcomingCount = unpaidExpenses.length;

    for (const expense of unpaidExpenses) {
      const fireDate = nextOccurrenceOfDay(expense.dueDate, offset);
      if (!fireDate) continue;

      scheduled.push(
        Notifications.scheduleNotificationAsync({
          content: {
            title: `${expense.name} due ${when}`,
            body: `Your ${expense.name} payment of ${currency} ${expense.amount.toLocaleString()} is due ${when}.`,
            data: { type: "expense", id: expense.id },
            sound: "default",
            categoryIdentifier: NOTIFICATION_CHANNEL,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireDate,
          },
        })
      );
    }

    // Summary notification: "N payments due this week"
    if (upcomingCount > 1) {
      const summaryDate = nextOccurrenceOfDay(1, offset);
      if (summaryDate) {
        scheduled.push(
          Notifications.scheduleNotificationAsync({
            content: {
              title: "Upcoming payments",
              body: `You have ${upcomingCount} payments due this month. Stay on top of your budget.`,
              data: { type: "summary" },
              sound: "default",
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: summaryDate,
            },
          })
        );
      }
    }
  }

  // ── EMI reminders ──
  if (settings.emiEnabled) {
    for (const emi of emis) {
      const duration = emi.durationMonths ?? emi.totalInstallments;
      const paid = emi.paidInstallments;
      const remaining = Math.max(0, duration - paid);
      if (remaining > 0) {
        const fireDate = nextEMIPaymentDate(emi);
        if (fireDate) {
          fireDate.setDate(fireDate.getDate() - offset);
          if (fireDate > new Date()) {
            scheduled.push(
              Notifications.scheduleNotificationAsync({
                content: {
                  title: `${emi.name} EMI due ${when}`,
                  body: `${currency} ${(emi.monthlyEMIAmount ?? emi.monthlyAmount).toLocaleString()} installment due ${when}. ${remaining} payments remaining.`,
                  data: { type: "emi", id: emi.id, paymentType: "monthly_emi" },
                  sound: "default",
                  categoryIdentifier: NOTIFICATION_CHANNEL,
                },
                trigger: {
                  type: Notifications.SchedulableTriggerInputTypes.DATE,
                  date: fireDate,
                },
              })
            );
          }
        }
      }

      if ((emi.balloonPaymentAmount ?? 0) > 0 && emi.balloonPaymentDueDate) {
        const balloonPaid = (emi.paymentHistory ?? [])
          .filter((payment) => payment.paymentType === "balloon" && payment.status === "paid")
          .reduce((sum, payment) => sum + payment.amount, 0);
        const balloonRemaining = Math.max(0, (emi.balloonPaymentAmount ?? 0) - balloonPaid);
        const balloonDate = balloonRemaining > 0 ? dateWithReminderOffset(emi.balloonPaymentDueDate, offset) : null;
        if (balloonDate) {
          scheduled.push(
            Notifications.scheduleNotificationAsync({
              content: {
                title: `${emi.name} balloon payment due ${when}`,
                body: `${currency} ${balloonRemaining.toLocaleString()} balloon payment due ${when}.`,
                data: { type: "emi", id: emi.id, paymentType: "balloon" },
                sound: "default",
                categoryIdentifier: NOTIFICATION_CHANNEL,
              },
              trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: balloonDate,
              },
            })
          );
        }
      }
    }
  }

  // ── Budget alerts ──
  if (settings.budgetEnabled && monthlyBudget > 0) {
    const totalSpent = totalMonthlyExpenses + totalEMIMonthly;
    const pct = totalSpent / monthlyBudget;

    let budgetTitle = "";
    let budgetBody = "";

    if (pct >= 1) {
      budgetTitle = "Budget exceeded";
      budgetBody = `You've exceeded your ${currency} ${monthlyBudget.toLocaleString()} monthly budget by ${currency} ${Math.round(totalSpent - monthlyBudget).toLocaleString()}.`;
    } else if (pct >= 0.95) {
      budgetTitle = "Low budget warning";
      budgetBody = `Only ${currency} ${Math.round(monthlyBudget - totalSpent).toLocaleString()} left in your ${currency} ${monthlyBudget.toLocaleString()} monthly budget.`;
    } else if (pct >= 0.8) {
      budgetTitle = "Budget at 80%";
      budgetBody = `You've used ${Math.round(pct * 100)}% of your monthly budget. ${currency} ${Math.round(monthlyBudget - totalSpent).toLocaleString()} remaining.`;
    }

    if (budgetTitle) {
      // Schedule a "right now + 5 seconds" alert so it fires shortly after app open
      const alertDate = new Date(Date.now() + 5000);
      scheduled.push(
        Notifications.scheduleNotificationAsync({
          content: {
            title: budgetTitle,
            body: budgetBody,
            data: { type: "budget" },
            sound: "default",
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: alertDate,
          },
        })
      );
    }
  }

  await Promise.allSettled(scheduled);
}
