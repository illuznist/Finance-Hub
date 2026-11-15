import React from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFinance } from "@/context/FinanceContext";
import { useColors } from "@/hooks/useColors";
import { usePreferences } from "@/context/PreferencesContext";

export function FinanceStorageGate({ children }: { children: React.ReactNode }) {
  const finance = useFinance();
  const colors = useColors();
  const { t } = usePreferences();
  const insets = useSafeAreaInsets();
  if (!finance.isReady || finance.storageError || finance.storageRetrying) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 24, paddingTop: (Platform.OS === "web" ? 67 : insets.top) + 24, justifyContent: "center", gap: 20 }}>
        {finance.storageRetrying ? (
          <View accessibilityRole="progressbar" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }}>{t("Retrying...")}</Text>
          </View>
        ) : finance.storageError ? <>
          <Text style={{ color: colors.foreground, fontFamily: "Inter_700Bold", fontSize: 24 }}>{t("Your records are protected")}</Text>
          <Text accessibilityRole="alert" style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 14, lineHeight: 22 }}>{t(finance.storageError)}</Text>
          {finance.storageErrorStage ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>
              {t("Load step: {step}", { step: t(finance.storageErrorStage) })}
            </Text>
          ) : null}
          {finance.storageErrorCode ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18, writingDirection: "ltr" }}>
              {t("Recovery code: {code}", { code: finance.storageErrorCode })}
            </Text>
          ) : null}
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{t("Do not clear app storage. The original data is retained if migration cannot finish. If a save failed, keep this app open and retry.")}</Text>
          {finance.storageErrorNextAction ? (
            <Text style={{ color: colors.mutedForeground, fontSize: 13, lineHeight: 19 }}>{t(finance.storageErrorNextAction)}</Text>
          ) : null}
          <Pressable
            testID="finance-storage-retry"
            accessibilityRole="button"
            accessibilityState={{ disabled: finance.storageRetrying }}
            onPress={() => { void finance.retryStorage(); }}
            style={{ padding: 16, backgroundColor: colors.primary, borderRadius: 14 }}
          >
            <Text style={{ color: colors.primaryForeground, textAlign: "center", fontFamily: "Inter_600SemiBold" }}>{t("Retry safely")}</Text>
          </Pressable>
        </> : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }
  return <>{children}</>;
}
