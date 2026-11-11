import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { FinanceState } from "@/context/FinanceContext";
import { createReminderSynchronizer, type ReminderAdapter } from "@/finance/reminderPlan";
export const NOTIFICATION_CHANNEL = "finance-reminders";
export async function setupNotificationHandler(): Promise<void> {
  if (Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
  if (Platform.OS === "android") await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL, {
    name: "Payment Reminders", importance: Notifications.AndroidImportance.DEFAULT, sound: "default",
  });
}
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if ((await Notifications.getPermissionsAsync()).granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}
const adapter: ReminderAdapter = {
  permission: async () => (await Notifications.getPermissionsAsync()).granted,
  list: async () => (await Notifications.getAllScheduledNotificationsAsync()).map(n => ({ id: n.identifier, data: n.content.data ?? {} })),
  cancel: id => Notifications.cancelScheduledNotificationAsync(id),
  schedule: async r => {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id, content: { title: r.title, body: r.body, data: r.data, sound: "default" },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(r.timestamp), channelId: NOTIFICATION_CHANNEL },
    });
  },
};
const synchronize = createReminderSynchronizer(adapter, AsyncStorage);
export async function scheduleAllNotifications(state: FinanceState): Promise<void> {
  if (Platform.OS !== "web") await synchronize(state);
}
export async function cancelAllScheduledNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  const owned = (await adapter.list()).filter(n => n.data.owner === "finance-v2" || ["expense", "emi", "budget", "summary"].includes(String(n.data.type)));
  await Promise.all(owned.map(n => adapter.cancel(n.id)));
}
