import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HeaderAction, ScreenHeader } from "@/components/ScreenHeader";
import { ProBenefitsList, UpgradeCTA } from "@/components/ProShared";
import { TYPOGRAPHY } from "@/constants/typography";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";

type ProFeature = "Advanced analytics" | "Cash-flow forecasting";

const FEATURE_COPY: Record<ProFeature, { icon: React.ComponentProps<typeof Feather>["name"]; benefit: string[]; preview: "analytics" | "forecast" }> = {
  "Advanced analytics": {
    icon: "bar-chart-2",
    preview: "analytics",
    benefit: ["See income and spending patterns", "Understand savings and financial health", "Explore net worth over time"],
  },
  "Cash-flow forecasting": {
    icon: "trending-up",
    preview: "forecast",
    benefit: ["See upcoming inflows and commitments", "Compare conservative and expected views", "Test scenarios without changing records"],
  },
};

export function ProFeatureGate({ feature }: { feature: ProFeature }) {
  const colors = useColors();
  const { t, isRTL } = usePreferences();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const copy = FEATURE_COPY[feature];

  return (
    <View testID="pro-feature-preview" style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title={t(feature)} topInset={topInset} colors={colors}
        leading={<HeaderAction icon="arrow-left" label={t("Back")} variant="neutral"
          testID="pro-feature-back" onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} />} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + (Platform.OS === "web" ? 34 : insets.bottom) }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.topline}>
            <View style={[styles.featureIcon, { backgroundColor: colors.secondary }]}><Feather name={copy.icon} size={22} color={colors.primary} /></View>
            <View style={[styles.proPill, { backgroundColor: colors.secondary }]}><Feather name="star" size={12} color={colors.primary} /><Text style={[styles.proLabel, { color: colors.primary }]}>{t("PRO PREVIEW")}</Text></View>
          </View>
          <Text style={[styles.title, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>{t(feature === "Advanced analytics" ? "A clearer view of your money." : "See what your money can handle.")}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>{t(feature === "Advanced analytics" ? "Explore patterns across your recorded activity, with every figure traceable to your own records." : "Look ahead at known schedules and try what-if scenarios while keeping your records untouched.")}</Text>
        </View>

        <View style={[styles.preview, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.previewHeader}>
            <View><Text style={[styles.previewEyebrow, { color: colors.primary }]}>{t(copy.preview === "analytics" ? "SAMPLE REPORT" : "SAMPLE OUTLOOK")}</Text>
              <Text style={[styles.previewTitle, { color: colors.foreground }]}>{t(copy.preview === "analytics" ? "A month at a glance" : "The next 30 days")}</Text></View>
            <Feather name={copy.icon} size={18} color={colors.mutedForeground} />
          </View>
          {copy.preview === "analytics" ? (
            <View accessible accessibilityRole="image" style={[styles.barChart, { borderBottomColor: colors.border }]} accessibilityLabel={t("Illustrative sample chart")}>
              {[38, 62, 48, 78, 56, 88, 67].map((height, index) => <View key={index} style={styles.barPair}>
                <View style={[styles.bar, { height: height * 0.62, backgroundColor: colors.primary, opacity: 0.52 }]} />
                <View style={[styles.bar, { height: height, backgroundColor: colors.primary }]} />
              </View>)}
            </View>
          ) : (
            <View style={styles.timeline}>
              {[["calendar", "Scheduled income", "Day 05", "in"], ["credit-card", "Monthly commitment", "Day 14", "out"], ["trending-up", "Projected balance", "Day 30", "balance"]].map((row, index) => (
                <View key={row[1]} style={[styles.timelineRow, { borderTopColor: colors.border }]}>
                  <View style={[styles.timelineIcon, { backgroundColor: colors.secondary }]}><Feather name={row[0] as React.ComponentProps<typeof Feather>["name"]} size={15} color={colors.primary} /></View>
                  <Text style={[styles.timelineName, { color: colors.foreground }]}>{t(row[1])}</Text>
                  <Text style={[styles.timelineDate, { color: colors.mutedForeground }]}>{t(row[2])}</Text>
                  <View style={[styles.sampleMark, { backgroundColor: index === 2 ? colors.successLight : colors.muted }]} />
                </View>
              ))}
            </View>
          )}
          <Text style={[styles.sampleNote, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>{t("Illustrative preview only. No personal finance data is shown.")}</Text>
        </View>

        <ProBenefitsList benefits={copy.benefit} />
        <UpgradeCTA testID="pro-feature-upgrade" label="Upgrade to Pro" onPress={() => router.push("/pro")} />
        <Text style={[styles.footnote, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>{t("One-time lifetime access. No subscription. Your records stay on this device.")}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 14, gap: 16 },
  hero: { borderWidth: 1, borderRadius: 22, padding: 20, gap: 12 },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  featureIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  proPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  proLabel: { fontSize: 10, letterSpacing: 0.7, fontFamily: "Inter_700Bold" },
  title: { fontSize: TYPOGRAPHY.dialogTitle + 2, lineHeight: 29, fontFamily: "Inter_700Bold" },
  body: { fontSize: TYPOGRAPHY.body, lineHeight: 21, fontFamily: "Inter_400Regular" },
  preview: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 14 },
  previewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  previewEyebrow: { fontSize: 10, letterSpacing: 0.8, fontFamily: "Inter_700Bold" },
  previewTitle: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_700Bold", marginTop: 4 },
  barChart: { height: 112, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingHorizontal: 8, paddingTop: 12, borderBottomWidth: 1 },
  barPair: { height: "100%", flexDirection: "row", alignItems: "flex-end", gap: 4 },
  bar: { width: 10, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  timeline: { gap: 0 },
  timelineRow: { minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 9 },
  timelineIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  timelineName: { flex: 1, fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_500Medium" },
  timelineDate: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular" },
  sampleMark: { width: 7, height: 7, borderRadius: 4 },
  sampleNote: { fontSize: TYPOGRAPHY.supporting, lineHeight: 17, fontFamily: "Inter_400Regular" },
  footnote: { textAlign: "center", fontSize: TYPOGRAPHY.supporting, lineHeight: 18, paddingHorizontal: 6, fontFamily: "Inter_400Regular" },
});
