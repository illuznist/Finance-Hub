import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandAttribution } from "@/components/BrandAttribution";
import { HeaderAction, ScreenHeader } from "@/components/ScreenHeader";
import { TYPOGRAPHY } from "@/constants/typography";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";
import { getApplicationVersion } from "@/utils/appVersion";

export default function AboutScreen() {
  const colors = useColors();
  const { t, isRTL } = usePreferences();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const textDirection = isRTL ? "rtl" : "ltr";
  const rowDirection = isRTL ? "row-reverse" : "row";

  const links = [
    {
      label: "Help & Support",
      icon: "life-buoy" as const,
      onPress: () => router.push("/support"),
      testID: "about-support",
    },
    {
      label: "Privacy Policy",
      icon: "shield" as const,
      onPress: () => router.push({ pathname: "/legal", params: { type: "privacy" } }),
      testID: "about-privacy-policy",
    },
    {
      label: "Terms & Conditions",
      icon: "file-text" as const,
      onPress: () => router.push({ pathname: "/legal", params: { type: "terms" } }),
      testID: "about-terms",
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={t("About")}
        topInset={Platform.OS === "web" ? 67 : insets.top}
        colors={colors}
        leading={<HeaderAction
          icon={isRTL ? "arrow-right" : "arrow-left"}
          label={t("Back")}
          variant="neutral"
          testID="about-back"
          onPress={() => router.canGoBack() ? router.back() : router.replace("/settings")}
        />}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 28 + Math.max(insets.bottom, Platform.OS === "web" ? 34 : 0) },
        ]}
      >
        <View style={[styles.appCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.appIcon}
            resizeMode="contain"
            accessibilityLabel={t("FinanceApp app icon")}
          />
          <Text accessibilityRole="header" style={[styles.appName, { color: colors.foreground }]}>
            FinanceApp
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground, textAlign: "center" }]}>
            {t("Personal finance, simplified.")}
          </Text>
          <View style={[styles.versionRow, { borderTopColor: colors.border, flexDirection: rowDirection }]}>
            <Text style={[styles.versionLabel, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
              {t("Version")}
            </Text>
            <Text
              testID="about-app-version"
              style={[styles.versionValue, { color: colors.foreground, writingDirection: textDirection }]}
            >
              {getApplicationVersion()}
            </Text>
          </View>
        </View>

        <View testID="about-description" style={styles.section}>
          <Text
            accessibilityRole="header"
            style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
          >
            {t("About Finance Hub")}
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
            {t("Finance Hub is designed to make managing your money simpler, clearer, and more organized.")}
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
            {t("From everyday expenses and monthly budgets to loans, EMIs, savings, and financial insights, everything you need to understand your finances is brought together in one place.")}
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
            {t("Built with a focus on simplicity, privacy, and control, Finance Hub helps you stay on top of your money without unnecessary complexity.")}
          </Text>
        </View>

        <View
          testID="about-privacy"
          style={[styles.privacyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View style={[styles.privacyHeading, { flexDirection: rowDirection }]}>
            <View style={[styles.privacyIcon, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="shield" size={18} color={colors.primary} />
            </View>
            <Text
              accessibilityRole="header"
              style={[styles.sectionTitle, styles.privacyTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
            >
              {t("Your finances. Your privacy.")}
            </Text>
          </View>
          <Text style={[styles.body, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
            {t("Your financial records stay on this device.")}
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
            {t("Optional online account and plan metadata is handled separately and does not include your financial records.")}
          </Text>
          <Text style={[styles.body, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
            {t("Encrypted backups are available when you choose to export them.")}
          </Text>
        </View>

        <View style={styles.section}>
          <Text
            accessibilityRole="header"
            style={[styles.sectionTitle, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}
          >
            {t("Support & legal")}
          </Text>
          <View style={[styles.linksCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {links.map((link, index) => (
              <React.Fragment key={link.testID}>
                {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
                <Pressable
                  testID={link.testID}
                  accessibilityRole="button"
                  accessibilityLabel={t(link.label)}
                  onPress={link.onPress}
                  style={({ pressed }) => [
                    styles.linkRow,
                    { flexDirection: rowDirection, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View style={[styles.linkIcon, { backgroundColor: colors.primary + "18" }]}>
                    <Feather name={link.icon} size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.linkLabel, { color: colors.foreground, textAlign: isRTL ? "right" : "left" }]}>
                    {t(link.label)}
                  </Text>
                  <View style={styles.linkSpacer} />
                  <Feather
                    name={isRTL ? "chevron-left" : "chevron-right"}
                    size={17}
                    color={colors.mutedForeground}
                  />
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        </View>

        <BrandAttribution />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 22 },
  appCard: { borderWidth: 1, borderRadius: 20, alignItems: "center", padding: 22, gap: 8 },
  appIcon: { width: 64, height: 64, borderRadius: 19, marginBottom: 2 },
  appName: { fontSize: TYPOGRAPHY.sectionHeading, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_400Regular" },
  versionRow: {
    width: "100%",
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "space-between",
  },
  versionLabel: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_500Medium" },
  versionValue: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_600SemiBold", fontVariant: ["tabular-nums"] },
  section: { gap: 10 },
  sectionTitle: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_600SemiBold", lineHeight: 22 },
  body: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_400Regular", lineHeight: 22 },
  privacyCard: { borderWidth: 1, borderRadius: 18, padding: 17, gap: 10 },
  privacyHeading: { alignItems: "center", gap: 10, marginBottom: 2 },
  privacyIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  privacyTitle: { flex: 1 },
  linksCard: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 },
  linkRow: { minHeight: 58, alignItems: "center", gap: 12 },
  linkIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  linkLabel: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_500Medium" },
  linkSpacer: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth },
});
