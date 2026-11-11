import React from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFinance } from "@/context/FinanceContext";
import { useColors } from "@/hooks/useColors";

export function FinanceStorageGate({ children }: { children: React.ReactNode }) {
  const finance = useFinance();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  if (!finance.isReady || finance.storageError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: (Platform.OS === "web" ? 67 : insets.top) + 24, justifyContent: "center", gap: 20 }}>
        {finance.storageError ? <>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 24 }}>Your records are protected</Text>
          <Text accessibilityRole="alert" style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 22 }}>{finance.storageError}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Do not clear app storage. The original data is retained if migration cannot finish. If a save failed, keep this app open and retry.</Text>
          <Pressable testID="finance-storage-retry" onPress={finance.retryStorage} style={{ padding: 16, backgroundColor: colors.primary, borderRadius: 14 }}>
            <Text style={{ color: colors.primaryForeground, textAlign: "center", fontFamily: "Inter_600SemiBold" }}>Retry safely</Text>
          </Pressable>
        </> : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }
  return <>{children}</>;
}
