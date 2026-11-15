import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HeaderAction, ScreenHeader } from "@/components/ScreenHeader";
import { TYPOGRAPHY } from "@/constants/typography";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";

export function ProFeatureGate({ feature }: { feature: "Advanced analytics" | "Cash-flow forecasting" }) {
  const colors = useColors();
  const { t, isRTL } = usePreferences();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={t(feature)}
        topInset={topInset}
        colors={colors}
        leading={<HeaderAction
          icon={isRTL ? "arrow-right" : "arrow-left"}
          label={t("Back")}
          variant="neutral"
          testID="pro-feature-back"
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
        />}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 24 + (Platform.OS === "web" ? 34 : insets.bottom) }]}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
            <Feather name="lock" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>{t("This is a Pro feature")}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {t("{feature} is included with Pro.", { feature: t(feature) })}
          </Text>
          <Pressable
            testID="pro-feature-view-plan"
            accessibilityRole="button"
            onPress={() => router.push("/pro")}
            style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed ? 0.78 : 1 }]}
          >
            <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{t("View Pro plan")}</Text>
            <Feather name={isRTL ? "arrow-left" : "arrow-right"} size={16} color={colors.primaryForeground} />
          </Pressable>
          <Text style={[styles.footnote, { color: colors.mutedForeground }]}>{t("Your finance records remain on this device.")}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 24 },
  card: { borderWidth: 1, borderRadius: 22, padding: 22, gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  title: { fontSize: TYPOGRAPHY.dialogTitle, lineHeight: 27, fontFamily: "Inter_700Bold" },
  body: { fontSize: TYPOGRAPHY.body, lineHeight: 21, fontFamily: "Inter_400Regular" },
  button: { minHeight: 48, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 6 },
  buttonText: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_600SemiBold" },
  footnote: { fontSize: TYPOGRAPHY.supporting, lineHeight: 18, fontFamily: "Inter_400Regular" },
});
