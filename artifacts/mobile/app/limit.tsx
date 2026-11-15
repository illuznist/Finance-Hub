import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HeaderAction, ScreenHeader } from "@/components/ScreenHeader";
import { UpgradeCTA } from "@/components/ProShared";
import { useFinance } from "@/context/FinanceContext";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";
import { FREE_PLAN_LIMITS, getPlanUsage, type LimitedResource } from "@/finance/entitlements";
import { formatAppNumber } from "@/i18n/localization";
import { TYPOGRAPHY } from "@/constants/typography";

const RESOURCE_LABELS: Record<LimitedResource, string> = {
  account: "Active accounts",
  loan: "Active loans",
  emi: "Active EMI agreements",
};
const LIMIT_TITLES: Record<LimitedResource, string> = {
  account: "Free active-wallet limit reached",
  loan: "Free active-loan limit reached",
  emi: "Free active EMI limit reached",
};
const FALLBACK_ROUTE: Record<LimitedResource, string> = {
  account: "/(tabs)/wallets",
  loan: "/(tabs)/loans",
  emi: "/(tabs)/emis",
};

export default function LimitScreen() {
  const { t, isRTL } = usePreferences();
  const colors = useColors();
  const finance = useFinance();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ resource?: string }>();
  const resource: LimitedResource = params.resource === "loan" || params.resource === "emi" ? params.resource : "account";
  const usage = getPlanUsage(finance)[resource];
  const limit = FREE_PLAN_LIMITS[resource];
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const back = () => router.canGoBack() ? router.back() : router.replace(FALLBACK_ROUTE[resource] as never);

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <ScreenHeader title={t("Free plan limit")} topInset={topInset} colors={colors}
      leading={<HeaderAction icon="arrow-left" label={t("Back")} variant="neutral" testID="limit-back" onPress={back} />} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 28 + (Platform.OS === "web" ? 34 : insets.bottom) }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}><Feather name={resource === "account" ? "credit-card" : resource === "loan" ? "briefcase" : "calendar"} size={22} color={colors.primary} /></View>
        <Text style={[styles.kicker, { color: colors.primary }]}>{t("FREE PLAN")}</Text>
        <Text style={[styles.title, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>{t(LIMIT_TITLES[resource])}</Text>
        <Text style={[styles.description, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>{t("You can keep managing your existing records. Pro removes this active-item limit.")}</Text>
        <View style={[styles.counter, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.counterLabel, { color: colors.mutedForeground }]}>{t(RESOURCE_LABELS[resource])}</Text>
            <Text style={[styles.count, { color: colors.foreground }]}>{t("{used} of {limit} active", { used: formatAppNumber(usage), limit: formatAppNumber(limit) })}</Text>
          </View>
          <Feather name="check-circle" size={20} color={colors.primary} />
        </View>
      </View>
      <View style={[styles.safeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="shield" size={18} color={colors.success} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.safeTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>{t("Your existing records are safe")}</Text>
          <Text style={[styles.description, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>{t("Nothing is removed or changed. Continue viewing, updating, and managing the records already in your account.")}</Text>
        </View>
      </View>
      <UpgradeCTA testID="limit-upgrade" label="Upgrade to Pro" onPress={() => router.push("/pro")} />
      <Pressable testID="limit-not-now" accessibilityRole="button" onPress={back} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}>
        <Text style={[styles.secondaryText, { color: colors.foreground }]}>{t("Not now")}</Text>
      </Pressable>
      <Text style={[styles.note, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>{t("One-time lifetime access. No subscription. Purchases are not available yet.")}</Text>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 14, gap: 14 },
  hero: { borderWidth: 1, borderRadius: 22, padding: 20, gap: 11 },
  iconWrap: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  kicker: { fontSize: 10, letterSpacing: 0.8, fontFamily: "Inter_700Bold" },
  title: { fontSize: TYPOGRAPHY.dialogTitle + 1, lineHeight: 28, fontFamily: "Inter_700Bold" },
  description: { fontSize: TYPOGRAPHY.body, lineHeight: 21, fontFamily: "Inter_400Regular" },
  counter: { minHeight: 72, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
  counterLabel: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium" },
  count: { fontSize: TYPOGRAPHY.cardTitle, marginTop: 4, fontFamily: "Inter_700Bold" },
  safeCard: { borderWidth: 1, borderRadius: 16, padding: 15, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  safeTitle: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_700Bold" },
  secondaryButton: { minHeight: 50, borderWidth: 1, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_600SemiBold" },
  note: { textAlign: "center", fontSize: TYPOGRAPHY.supporting, lineHeight: 18, paddingHorizontal: 8 },
});
