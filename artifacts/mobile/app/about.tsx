import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
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
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
        <View style={[styles.appCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.logo, { backgroundColor: colors.secondary }]}>
            <Feather name="briefcase" size={23} color={colors.primary} />
          </View>
          <Text style={[styles.appName, { color: colors.foreground }]}>FinanceApp</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{t("Personal finance, organized.")}</Text>
        </View>
        <View style={[styles.versionRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.versionLabel, { color: colors.foreground }]}>{t("Version")}</Text>
          <Text testID="about-app-version" style={[styles.versionValue, { color: colors.mutedForeground }]}>{getApplicationVersion()}</Text>
        </View>
        <BrandAttribution />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 12 },
  appCard: { borderWidth: 1, borderRadius: 20, alignItems: "center", padding: 24, gap: 7 },
  logo: { width: 54, height: 54, borderRadius: 17, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  appName: { fontSize: TYPOGRAPHY.sectionHeading, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_400Regular" },
  versionRow: { minHeight: 58, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  versionLabel: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_500Medium" },
  versionValue: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_500Medium", fontVariant: ["tabular-nums"] },
});
