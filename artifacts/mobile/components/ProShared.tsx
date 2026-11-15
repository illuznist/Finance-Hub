import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { FREE_PLAN_LIMITS, type LimitedResource } from "@/finance/entitlements";
import { formatAppNumber } from "@/i18n/localization";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";
import { TYPOGRAPHY } from "@/constants/typography";

const RESOURCE_LABELS: Record<LimitedResource, string> = {
  account: "Active accounts",
  loan: "Active loans",
  emi: "Active EMI agreements",
};

export function ProFeatureIndicator() {
  const colors = useColors();
  const { t } = usePreferences();
  return <View style={[styles.indicator, { backgroundColor: colors.secondary }]}><Feather name="star" size={12} color={colors.primary} /><Text style={[styles.indicatorText, { color: colors.primary }]}>{t("FINANCE HUB PRO")}</Text></View>;
}

export function UpgradeCTA({ label, testID, onPress }: { label: string; testID: string; onPress: () => void }) {
  const colors = useColors();
  const { t, isRTL } = usePreferences();
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={t(label)} onPress={onPress}
    style={({ pressed }) => [styles.cta, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}>
    <Text style={[styles.ctaText, { color: colors.primaryForeground }]}>{t(label)}</Text>
    <Feather name={isRTL ? "arrow-left" : "arrow-right"} size={17} color={colors.primaryForeground} />
  </Pressable>;
}

export function ProBenefitsList({ benefits }: { benefits: string[] }) {
  const colors = useColors();
  const { t, isRTL } = usePreferences();
  return <View style={{ gap: 12 }}>{benefits.map(benefit => <View key={benefit} style={styles.benefitRow}>
    <View style={[styles.check, { backgroundColor: colors.successLight }]}><Feather name="check" size={13} color={colors.success} /></View>
    <Text style={[styles.benefit, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>{t(benefit)}</Text>
  </View>)}</View>;
}

export function ProPlanComparison() {
  const colors = useColors();
  const { t, isRTL } = usePreferences();
  const rows: { label: string; free: string; pro: string }[] = [
    ...(["account", "loan", "emi"] as LimitedResource[]).map(resource => ({
      label: RESOURCE_LABELS[resource],
      free: t("{count} active", { count: formatAppNumber(FREE_PLAN_LIMITS[resource]) }),
      pro: t("Unlimited"),
    })),
    { label: "Advanced analytics", free: "Not included", pro: "Included" },
    { label: "Cash-flow forecasting", free: "Not included", pro: "Included" },
  ];
  return <View testID="pro-plan-comparison" style={[styles.comparison, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <Text style={[styles.title, { color: colors.foreground }]}>{t("Free vs Pro")}</Text>
    <View style={styles.columns}>
      <Text style={[styles.columnSpacer, { textAlign: isRTL ? "left" : "right" }]} />
      <Text style={[styles.columnLabel, { color: colors.mutedForeground, textAlign: isRTL ? "left" : "right" }]}>{t("Free")}</Text>
      <Text style={[styles.columnLabel, { color: colors.primary, textAlign: isRTL ? "left" : "right" }]}>{t("Pro")}</Text>
    </View>
    {rows.map(row => <View key={row.label} style={[styles.row, { borderTopColor: colors.border }]}>
      <Text style={[styles.rowLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>{t(row.label)}</Text>
      <Text style={[styles.value, { color: colors.mutedForeground, textAlign: isRTL ? "left" : "right" }]}>{t(row.free)}</Text>
      <Text style={[styles.value, { color: colors.primary, textAlign: isRTL ? "left" : "right" }]}>{t(row.pro)}</Text>
    </View>)}
    <View style={[styles.lifetime, { borderTopColor: colors.border }]}>
      <Feather name="check-circle" size={16} color={colors.primary} />
      <Text style={[styles.benefit, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>{t("One-time lifetime ownership. No subscription.")}</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  indicator: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20 },
  indicatorText: { fontSize: 10, letterSpacing: 0.65, fontFamily: "Inter_700Bold" },
  benefitRow: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 10 },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  benefit: { flex: 1, fontSize: TYPOGRAPHY.body, lineHeight: 20, fontFamily: "Inter_500Medium" },
  comparison: { borderWidth: 1, borderRadius: 18, padding: 16 },
  title: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_700Bold", marginBottom: 12 },
  columns: { flexDirection: "row", alignItems: "center", paddingBottom: 8 },
  columnSpacer: { flex: 1 },
  columnLabel: { width: 76, textAlign: "right", fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold" },
  row: { minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", paddingVertical: 7 },
  rowLabel: { flex: 1, fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_500Medium" },
  value: { width: 76, textAlign: "right", fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium" },
  lifetime: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4, paddingTop: 13, flexDirection: "row", alignItems: "center", gap: 9 },
  cta: { minHeight: 52, borderRadius: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  ctaText: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_700Bold" },
});
