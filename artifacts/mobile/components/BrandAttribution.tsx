import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { TYPOGRAPHY } from "@/constants/typography";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";

export function BrandAttribution() {
  const colors = useColors();
  const { t, isRTL } = usePreferences();

  return (
    <View testID="brand-attribution" style={styles.container}>
      <Text style={[styles.text, { color: colors.mutedForeground, textAlign: isRTL ? "right" : "left" }]}>
        {t("A product by Ctrl Studios")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 18,
  },
  text: {
    fontSize: TYPOGRAPHY.supporting,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.15,
  },
});
