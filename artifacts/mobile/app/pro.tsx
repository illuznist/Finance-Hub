import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandAttribution } from "@/components/BrandAttribution";
import { HeaderAction, ScreenHeader } from "@/components/ScreenHeader";
import { useEntitlements } from "@/context/EntitlementContext";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";
import { FREE_PLAN_LIMITS, type LimitedResource } from "@/finance/entitlements";
import { formatAppNumber } from "@/i18n/localization";
import { TYPOGRAPHY } from "@/constants/typography";

const RESOURCE_LABELS: Record<LimitedResource, string> = {
  account: "Active wallets",
  loan: "Active loans",
  emi: "Active EMI agreements",
};

export default function ProScreen() {
  const colors = useColors();
  const { t, isRTL } = usePreferences();
  const entitlements = useEntitlements();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { limit } = useLocalSearchParams<{ limit?: string }>();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const resource = limit === "account" || limit === "loan" || limit === "emi" ? limit : undefined;

  const limitMessage = resource === "account"
    ? t("Archive the currently active wallet to make room. Existing history and balances stay unchanged.")
    : resource === "loan"
      ? t("Complete an active loan to free a slot, or compare Pro plans.")
      : resource === "emi"
        ? t("Complete an active EMI agreement to free a slot, or compare Pro plans.")
        : null;

  const usageText = (key: LimitedResource) => t("{count} active", {
    count: formatAppNumber(FREE_PLAN_LIMITS[key]),
  });

  const previewAction = () => {
    if (entitlements.isPro && entitlements.source === "development_preview") entitlements.resetDevelopmentPreview();
    else entitlements.enableDevelopmentPreview();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={t("Finance Hub Pro")}
        topInset={topInset}
        colors={colors}
        leading={<HeaderAction
          icon={isRTL ? "arrow-right" : "arrow-left"}
          label={t("Back")}
          variant="neutral"
          testID="pro-back"
          onPress={() => router.canGoBack() ? router.back() : router.replace("/settings")}
        />}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="star" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>{t("More room for your plans.")}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{t("Unlock more room for accounts and repayments, plus advanced analytics.")}</Text>
        </View>

        {limitMessage ? (
          <View testID="pro-limit-message" style={[styles.notice, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Feather name="info" size={17} color={colors.primary} />
            <Text style={[styles.noticeText, { color: colors.foreground }]}>{limitMessage}</Text>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("Compare plans")}</Text>
            <Text style={[styles.currentPlan, { color: colors.primary }]}>
              {entitlements.isPro ? t("Pro") : t("Free")}
            </Text>
          </View>
          <View style={[styles.planRow, { borderTopColor: colors.border }]}>
            <Text style={styles.planLabel} />
            <Text style={[styles.planValue, { color: colors.mutedForeground }]}>{t("Free")}</Text>
            <Text style={[styles.planValue, { color: colors.primary }]}>{t("Pro")}</Text>
          </View>
          {(Object.keys(RESOURCE_LABELS) as LimitedResource[]).map((key) => (
            <View key={key} style={[styles.planRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.planLabel, { color: colors.foreground }]}>{t(RESOURCE_LABELS[key])}</Text>
              <Text style={[styles.planValue, { color: colors.mutedForeground }]}>{usageText(key)}</Text>
              <Text style={[styles.planValue, { color: colors.primary }]}>{t("Unlimited")}</Text>
            </View>
          ))}
          <View style={[styles.planRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.planLabel, { color: colors.foreground }]}>{t("Advanced analytics")}</Text>
            <Text style={[styles.planValue, { color: colors.mutedForeground }]}>{t("Not included")}</Text>
            <Feather name="check" size={17} color={colors.success} />
          </View>
          <View style={[styles.planRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.planLabel, { color: colors.foreground }]}>{t("Cash-flow forecasting")}</Text>
            <Text style={[styles.planValue, { color: colors.mutedForeground }]}>{t("Not included")}</Text>
            <Feather name="check" size={17} color={colors.success} />
          </View>
          <View style={[styles.planRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.planLabel, { color: colors.foreground }]}>{t("Purchase type")}</Text>
            <Text style={[styles.planValue, { color: colors.mutedForeground }]}>{t("Free")}</Text>
            <Text style={[styles.planValue, { color: colors.primary }]}>{t("Lifetime")}</Text>
          </View>
        </View>

        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{t("Current access")}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {entitlements.source === "development_preview"
              ? t("Development preview")
              : entitlements.source === "promotional_grant"
                ? t("Promotional Pro")
                : entitlements.source === "super_admin"
                  ? t("Super Admin Pro")
                  : entitlements.source === "paid_purchase"
                    ? t("Paid Pro")
                    : t("Free plan")}
          </Text>
          {entitlements.isDevelopmentBuild ? (
            <>
              <Pressable
                testID="pro-development-preview"
                accessibilityRole="button"
                onPress={previewAction}
                style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, opacity: pressed ? 0.78 : 1 }]}
              >
                <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                  {entitlements.source === "development_preview" ? t("Reset Pro preview") : t("Preview Pro access")}
                </Text>
              </Pressable>
              <Text style={[styles.footnote, { color: colors.mutedForeground }]}>{t("Development preview only. Not a purchase and resets when you restart the app.")}</Text>
            </>
          ) : (
            <>
              <View testID="pro-purchase-unavailable" style={[styles.disabledButton, { backgroundColor: colors.muted }]}>
                <Text style={[styles.buttonText, { color: colors.mutedForeground }]}>{t("Purchases are not available yet")}</Text>
              </View>
              <Text style={[styles.footnote, { color: colors.mutedForeground }]}>{t("Apple purchase setup is not configured yet. No payment will be taken.")}</Text>
            </>
          )}
        </View>
        <Text style={[styles.footnote, { color: colors.mutedForeground }]}>{t("Your finance records remain on this device. Plan access does not move your financial data to another service.")}</Text>
        <BrandAttribution />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 14 },
  hero: { borderWidth: 1, borderRadius: 20, padding: 20, gap: 9 },
  heroIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  heroTitle: { fontSize: TYPOGRAPHY.dialogTitle, lineHeight: 28, fontFamily: "Inter_700Bold" },
  body: { fontSize: TYPOGRAPHY.body, lineHeight: 21, fontFamily: "Inter_400Regular" },
  notice: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 9 },
  noticeText: { flex: 1, fontSize: TYPOGRAPHY.bodySmall, lineHeight: 20, fontFamily: "Inter_500Medium" },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
  cardHeader: { minHeight: 34, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sectionTitle: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_700Bold" },
  currentPlan: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_700Bold" },
  planRow: { minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  planLabel: { flex: 1, fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_500Medium" },
  planValue: { minWidth: 58, textAlign: "right", fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium" },
  statusCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 9 },
  primaryButton: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, marginTop: 4 },
  disabledButton: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, marginTop: 4, opacity: 0.7 },
  buttonText: { fontSize: TYPOGRAPHY.body, textAlign: "center", fontFamily: "Inter_600SemiBold" },
  footnote: { fontSize: TYPOGRAPHY.supporting, lineHeight: 18, fontFamily: "Inter_400Regular" },
});
