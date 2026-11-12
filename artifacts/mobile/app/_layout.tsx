import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppLockGate } from "@/components/AppLockGate";
import OnboardingScreen, { ONBOARDING_KEY } from "@/components/OnboardingScreen";
import AuthScreen from "@/components/AuthScreen";
import {
  AuthProvider,
  useAuth,
} from "@/context/AuthContext";
import { FinanceProvider, useFinance } from "@/context/FinanceContext";
import { FinanceStorageGate } from "@/components/FinanceStorageGate";
import { ThemeProvider } from "@/context/ThemeContext";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";
import { ToastProvider, useToast } from "@/context/ToastContext";
import {
  scheduleAllNotifications,
  setupNotificationHandler,
} from "@/utils/notifications";
import { formatAppNumber, translateAppPlural, translateAppText, type LocalizedPluralForms } from "@/i18n/localization";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const RESET_NOTIFICATION_FORMS: LocalizedPluralForms = {
  en: {
    one: "One recurring expense was reset for {month}.",
    other: "{count} recurring expenses were reset for {month}.",
  },
  ar: {
    zero: "No recurring expenses were reset for {month}.",
    one: "One recurring expense was reset for {month}.",
    two: "Two recurring expenses were reset for {month}.",
    few: "{count} recurring expenses were reset for {month} (few).",
    many: "{count} recurring expenses were reset for {month} (many).",
    other: "{count} recurring expenses were reset for {month} (other).",
  },
};

// ── AuthGate ──
function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const colors = useColors();
  if (auth.isLoading) return null;
  if (auth.authError) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 28, backgroundColor: colors.background }}>
        <Feather name="shield" size={30} color={colors.primary} />
        <Text style={{ color: colors.foreground, fontSize: 19, fontWeight: "700", marginTop: 16, textAlign: "center" }}>
          {translateAppText("Account security data is unavailable")}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: "center" }}>
          {translateAppText("Your saved records have not been changed. Retry safely; do not clear app storage.")}
        </Text>
        <Pressable onPress={auth.retryAuthStorage} style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 13, marginTop: 20 }}>
          <Text style={{ color: colors.primaryForeground, fontWeight: "700" }}>{translateAppText("Retry safely")}</Text>
        </Pressable>
      </View>
    );
  }
  if (!auth.isLoggedIn) {
    return <AuthScreen onComplete={() => {}} />;
  }
  return <>{children}</>;
}
// ── OnboardingGate ──
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "onboarding" | "done">("loading");

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      setStatus(val ? "done" : "onboarding");
    });
  }, []);

  if (status === "loading") return null;
  if (status === "onboarding") {
    return <OnboardingScreen onComplete={() => setStatus("done")} />;
  }
  return <>{children}</>;
}

// ── ResetNotifier ──
function ResetNotifier() {
  const finance = useFinance();
  const info = finance.monthResetInfo;
  const sentRef = useRef(false);

  useEffect(() => {
    if (!info || sentRef.current) return;
    if (!finance.notificationSettings.enabled) return;
    sentRef.current = true;

    import("@/utils/notifications").then(async ({ requestNotificationPermissions }) => {
      await setupNotificationHandler();
      requestNotificationPermissions().then((granted) => {
        if (!granted) return;
        const Notifications = require("expo-notifications");
        Notifications.scheduleNotificationAsync({
          content: {
            title: translateAppText("{month} tracker reset", { month: info.month }),
            body: translateAppPlural(RESET_NOTIFICATION_FORMS, info.count, {
              count: formatAppNumber(info.count),
              month: info.month,
            }),
            data: { type: "reset" },
            sound: "default",
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(Date.now() + 3000),
          },
        }).catch(() => {});
      });
    });
  }, [info, finance.notificationSettings.enabled]);

  return null;
}

// ── NotificationScheduler ──
function NotificationScheduler() {
  const finance = useFinance();

  useEffect(() => {
    if (!finance.isReady || finance.storageError) return;
    setupNotificationHandler()
      .then(() => scheduleAllNotifications(finance))
      .catch(error => console.warn("Payment reminders could not be updated:", error));
  }, [
    finance.isReady,
    finance.storageError,
    finance.calendarKey,
    finance.notificationSettings,
    finance.expenses,
    finance.emis,
    finance.loans,
    finance.planning,
    finance.transactions,
    finance.currency,
    finance.monthlyBudget,
    finance.totalMonthlyExpenses,
    finance.totalEMIMonthly,
  ]);

  return null;
}

function StorageRecoveryNotifier() {
  const finance = useFinance();
  const toast = useToast();
  const shownRef = useRef(false);

  useEffect(() => {
    if (!finance.storageRecoveryNotice || shownRef.current) return;
    shownRef.current = true;
    toast.show(finance.storageRecoveryNotice, "info");
  }, [finance.storageRecoveryNotice, toast]);

  return null;
}

// ── RootLayoutNav ──
function RootLayoutNav() {
  return (
    <>
      <ResetNotifier />
      <NotificationScheduler />
      <StorageRecoveryNotifier />
      <Stack screenOptions={{ headerShown: false, headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="analytics" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="forecast" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="transactions" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="budget" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="recurring" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="upcoming" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="settings" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="backup" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="support" options={{ headerShown: false, presentation: "card" }} />
        <Stack.Screen name="legal" options={{ headerShown: false, presentation: "card" }} />
      </Stack>
    </>
  );
}

// ── RootLayout ──
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
          <PreferencesProvider>
          <AuthProvider>
            <FinanceProvider>
              <GestureHandlerRootView>
                <ToastProvider>
                <KeyboardProvider>
                  <AuthGate>
                    <FinanceStorageGate>
                    <OnboardingGate>
                      <AppLockGate>
                        <RootLayoutNav />
                      </AppLockGate>
                    </OnboardingGate>
                    </FinanceStorageGate>
                  </AuthGate>
                </KeyboardProvider>
                </ToastProvider>
              </GestureHandlerRootView>
            </FinanceProvider>
          </AuthProvider>
          </PreferencesProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
