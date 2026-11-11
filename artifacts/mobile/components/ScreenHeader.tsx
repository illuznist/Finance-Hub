import { Feather } from "@expo/vector-icons";
import React, { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { TYPOGRAPHY } from "@/constants/typography";
import { useColors } from "@/hooks/useColors";

type HeaderActionProps = {
  icon?: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  testID?: string;
  variant?: "primary" | "neutral";
};

export function HeaderAction({
  icon = "plus",
  label,
  onPress,
  testID,
  variant = "primary",
}: HeaderActionProps) {
  const colors = useColors();
  const primary = variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: primary ? colors.primary : colors.card,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Feather
        name={icon}
        size={20}
        color={primary ? colors.primaryForeground : colors.primary}
      />
    </Pressable>
  );
}

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  topInset: number;
  colors: ReturnType<typeof useColors>;
  leading?: ReactNode;
  trailing?: ReactNode;
  centered?: boolean;
};

export function ScreenHeader({
  title,
  subtitle,
  topInset,
  colors,
  leading,
  trailing,
  centered = false,
}: ScreenHeaderProps) {
  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: topInset + 12,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.row}>
        {leading || centered ? (
          <View style={styles.sideSlot}>{leading}</View>
        ) : null}
        <View style={[styles.titleGroup, centered && styles.centeredTitleGroup]}>
          <Text
            accessibilityRole="header"
            numberOfLines={centered ? 2 : 1}
            style={[
              styles.title,
              { color: colors.foreground },
              centered && styles.centeredTitle,
            ]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={[styles.subtitle, { color: colors.mutedForeground }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing || centered ? (
          <View style={centered ? styles.sideSlot : styles.trailingSlot}>
            {trailing}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  sideSlot: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  trailingSlot: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  titleGroup: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  centeredTitleGroup: {
    alignItems: "center",
  },
  title: {
    fontSize: TYPOGRAPHY.pageTitle,
    lineHeight: 30,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  centeredTitle: {
    textAlign: "center",
  },
  subtitle: {
    marginTop: 2,
    fontSize: TYPOGRAPHY.bodySmall,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
});
