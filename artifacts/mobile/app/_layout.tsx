import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { FinanceProvider, PIN_STORAGE_KEY, useFinance } from "@/context/FinanceContext";
import {
  cancelAllScheduledNotifications,
  scheduleAllNotifications,
  setupNotificationHandler,
} from "@/utils/notifications";

SplashScreen.preventAutoHideAsync();

setupNotificationHandler().catch(() => {});

const queryClient = new QueryClient();

function NumPad({
  onPress,
  onBackspace,
}: {
  onPress: (d: string) => void;
  onBackspace: () => void;
}) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  return (
    <View style={pinStyles.numpad}>
      {keys.map((k, i) => (
        <Pressable
          key={i}
          onPress={() => (k === "⌫" ? onBackspace() : k ? onPress(k) : undefined)}
          style={({ pressed }) => [
            pinStyles.numKey,
            { opacity: k === "" ? 0 : pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={pinStyles.numKeyText}>{k}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function PinEntry({ storedPin, onUnlock }: { storedPin: string; onUnlock: () => void }) {
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  function handlePress(digit: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = entered + digit;
    setEntered(next);
    if (next.length === 4) {
      if (next === storedPin) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onUnlock();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setError(true);
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: false }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: false }),
          Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: false }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: false }),
        ]).start(() => {
          setEntered("");
          setError(false);
        });
      }
    }
  }

  function handleBackspace() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEntered(entered.slice(0, -1));
  }

  return (
    <View style={pinStyles.screen}>
      <View style={pinStyles.lockIcon}>
        <Text style={pinStyles.lockEmoji}>🔒</Text>
      </View>
      <Text style={pinStyles.title}>Enter PIN</Text>
      <Text style={pinStyles.subtitle}>Your data is protected</Text>

      <Animated.View style={[pinStyles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              pinStyles.dot,
              i < entered.length
                ? { backgroundColor: error ? "#EF4444" : "#60A5FA", borderColor: error ? "#EF4444" : "#60A5FA" }
                : { backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.3)" },
            ]}
          />
        ))}
      </Animated.View>

      {error && <Text style={pinStyles.errorText}>Incorrect PIN</Text>}

      <NumPad onPress={handlePress} onBackspace={handleBackspace} />
    </View>
  );
}

function PinGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "locked" | "open">("loading");
  const [storedPin, setStoredPin] = useState("");

  useEffect(() => {
    AsyncStorage.getItem(PIN_STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const { pinEnabled, pin } = JSON.parse(raw);
          if (pinEnabled && pin && pin.length === 4) {
            setStoredPin(pin);
            setStatus("locked");
            return;
          }
        } catch {
          // ignore
        }
      }
      setStatus("open");
    });
  }, []);

  if (status === "loading") return null;
  if (status === "locked") {
    return <PinEntry storedPin={storedPin} onUnlock={() => setStatus("open")} />;
  }
  return <>{children}</>;
}

function NotificationScheduler() {
  const finance = useFinance();

  useEffect(() => {
    const s = finance.notificationSettings;
    if (!s.enabled) {
      cancelAllScheduledNotifications().catch(() => {});
      return;
    }
    scheduleAllNotifications({
      expenses: finance.expenses,
      emis: finance.emis,
      settings: s,
      currency: finance.currency,
      monthlyBudget: finance.monthlyBudget,
      totalMonthlyExpenses: finance.totalMonthlyExpenses,
      totalEMIMonthly: finance.totalEMIMonthly,
    }).catch(() => {});
  }, [
    finance.notificationSettings,
    finance.expenses,
    finance.emis,
    finance.currency,
    finance.monthlyBudget,
    finance.totalMonthlyExpenses,
    finance.totalEMIMonthly,
  ]);

  return null;
}

function RootLayoutNav() {
  return (
    <>
      <NotificationScheduler />
      <Stack screenOptions={{ headerBackTitle: "Back" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false, presentation: "card" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <FinanceProvider>
            <GestureHandlerRootView>
              <KeyboardProvider>
                <PinGate>
                  <RootLayoutNav />
                </PinGate>
              </KeyboardProvider>
            </GestureHandlerRootView>
          </FinanceProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const pinStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#0B1E3D",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  lockIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "rgba(96,165,250,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  lockEmoji: { fontSize: 32 },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 40,
  },
  dotsRow: { flexDirection: "row", gap: 18, marginBottom: 12 },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#EF4444",
    marginBottom: 8,
  },
  numpad: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 264,
    gap: 14,
    marginTop: 32,
    justifyContent: "center",
  },
  numKey: {
    width: 78,
    height: 60,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  numKeyText: {
    fontSize: 24,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
