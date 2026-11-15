import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandAttribution } from "@/components/BrandAttribution";
import { HeaderAction, ScreenHeader } from "@/components/ScreenHeader";
import { ProBenefitsList, ProFeatureIndicator, ProPlanComparison } from "@/components/ProShared";
import { useEntitlements } from "@/context/EntitlementContext";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";
import { TYPOGRAPHY } from "@/constants/typography";

export default function ProScreen() {
  const colors = useColors();
  const { t, isRTL } = usePreferences();
  const entitlements = useEntitlements();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const previewAction = () => {
    if (entitlements.isPro && entitlements.source === "development_preview") entitlements.resetDevelopmentPreview();
    else entitlements.enableDevelopmentPreview();
  };

  return <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <ScreenHeader title={t("Finance Hub Pro")} topInset={topInset} colors={colors}
      leading={<HeaderAction icon="arrow-left" label={t("Back")} variant="neutral" testID="pro-back"
        onPress={() => router.canGoBack() ? router.back() : router.replace("/settings")} />} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 28 + (Platform.OS === "web" ? 34 : insets.bottom) }]} showsVerticalScrollIndicator={false}>
      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.heroTop}><ProFeatureIndicator /><Feather name="shield" size={19} color={colors.mutedForeground} /></View>
        <Text style={[styles.heroTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>{t("More room for your plans.")}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>{t("A clearer view of your money, with more room to track what matters. Your records stay on this device.")}</Text>
        <ProBenefitsList benefits={["Unlimited accounts, loans, and EMIs", "Advanced analytics for recorded activity", "Cash-flow forecasts and private scenarios"]} />
      </View>

      <ProPlanComparison />

      <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.statusHeading}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("Availability")}</Text>
            <Text style={[styles.body, { color: colors.mutedForeground, marginTop: 4, textAlign: isRTL ? "right" : "left" }]}>{t("Purchases are not available yet")}</Text>
          </View>
          <View style={[styles.statusMark, { backgroundColor: colors.warningLight }]}><Feather name="clock" size={16} color={colors.warning} /></View>
        </View>
        <Text style={[styles.footnote, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>{t("Apple purchase and RevenueCat infrastructure is not configured. No payment will be taken.")}</Text>
        <View
          testID="restore-purchases-unavailable"
          accessible
          accessibilityLabel={t("Restore purchases are unavailable until Apple and RevenueCat are configured.")}
          style={[styles.restoreRow, { borderTopColor: colors.border }]}
        >
          <Feather name="rotate-ccw" size={17} color={colors.mutedForeground} />
          <Text style={[styles.restoreLabel, { color: colors.foreground }]}>{t("Restore purchases")}</Text>
          <Text style={[styles.restoreUnavailable, { color: colors.mutedForeground }]}>{t("Unavailable")}</Text>
        </View>
        <Text style={[styles.footnote, { color: colors.mutedForeground }]}>{t("Restore is unavailable until Apple and RevenueCat are configured.")}</Text>
      </View>

      {entitlements.isDevelopmentBuild ? (
        <View style={[styles.devCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <View style={styles.devTitleRow}><Feather name="code" size={16} color={colors.primary} /><Text style={[styles.devTitle, { color: colors.foreground }]}>{t("Development preview")}</Text></View>
          <Text style={[styles.footnote, { color: colors.mutedForeground }]}>{t("Development preview only. In-memory access for interface testing; resets when you restart the app. Not a purchase or permanent entitlement.")}</Text>
          <Pressable testID="pro-development-preview" accessibilityRole="button" onPress={previewAction}
            style={({ pressed }) => [styles.previewButton, { backgroundColor: colors.primary, opacity: pressed ? 0.78 : 1 }]}>
            <Text style={[styles.previewButtonText, { color: colors.primaryForeground }]}>{t(entitlements.source === "development_preview" ? "Reset Pro preview" : "Preview Pro access")}</Text>
          </Pressable>
        </View>
      ) : null}
        <Text style={[styles.privacyNote, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>{t("One-time lifetime ownership. No subscription. Finance records remain on this device and are never sent to another service.")}</Text>
      <BrandAttribution />
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 14, gap: 14 },
  hero: { borderWidth: 1, borderRadius: 20, padding: 19, gap: 12 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroTitle: { fontSize: TYPOGRAPHY.dialogTitle + 2, lineHeight: 29, fontFamily: "Inter_700Bold" },
  body: { fontSize: TYPOGRAPHY.body, lineHeight: 21, fontFamily: "Inter_400Regular" },
  statusCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 11 },
  statusHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_700Bold" },
  statusMark: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  footnote: { fontSize: TYPOGRAPHY.supporting, lineHeight: 18, fontFamily: "Inter_400Regular" },
  restoreRow: { minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 8 },
  restoreLabel: { flex: 1, fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_600SemiBold" },
  restoreUnavailable: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium" },
  devCard: { borderWidth: 1, borderRadius: 16, padding: 15, gap: 9 },
  devTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  devTitle: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_700Bold" },
  previewButton: { minHeight: 46, borderRadius: 13, alignItems: "center", justifyContent: "center", marginTop: 2 },
  previewButtonText: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_600SemiBold" },
  privacyNote: { textAlign: "center", fontSize: TYPOGRAPHY.supporting, lineHeight: 18, paddingHorizontal: 8 },
});
