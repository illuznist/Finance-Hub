import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { TYPOGRAPHY } from "@/constants/typography";
import { useTheme } from "@/context/ThemeContext";
import { usePreferences } from "@/context/PreferencesContext";

function NativeTabLayout() {
  const colors = useColors();
  const { t } = usePreferences();
  return (
    <NativeTabs tintColor={colors.primary} backgroundColor={colors.card}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} />
        <NativeTabs.Trigger.Label>{t("Home")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="expenses">
        <NativeTabs.Trigger.Icon sf={{ default: "list.bullet", selected: "list.bullet" }} />
        <NativeTabs.Trigger.Label>{t("Expenses")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="emis">
        <NativeTabs.Trigger.Icon sf={{ default: "calendar.badge.clock", selected: "calendar.badge.clock" }} />
        <NativeTabs.Trigger.Label>{t("EMIs")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="loans">
        <NativeTabs.Trigger.Icon sf={{ default: "dollarsign.circle", selected: "dollarsign.circle.fill" }} />
        <NativeTabs.Trigger.Label>{t("Loans")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="wallets">
        <NativeTabs.Trigger.Icon sf={{ default: "wallet.pass", selected: "wallet.pass.fill" }} />
        <NativeTabs.Trigger.Label>{t("Wallets")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const { t } = usePreferences();
  const { resolvedScheme } = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const isDark = resolvedScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          paddingBottom: isWeb ? 10 : safeAreaInsets.bottom,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]}
            />
          ) : null,
        tabBarLabelStyle: {
          fontSize: TYPOGRAPHY.supporting,
          fontFamily: "Inter_500Medium",
          marginTop: -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("Home"),
          tabBarIcon: ({ focused }) => {
            const color = focused ? colors.primary : colors.mutedForeground;
            return isIOS ? (
              <SymbolView name="house" tintColor={color} size={22} />
            ) : (
              <Feather name="home" size={22} color={color} />
            );
          },
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: t("Expenses"),
          tabBarIcon: ({ focused }) => {
            const color = focused ? colors.primary : colors.mutedForeground;
            return isIOS ? (
              <SymbolView name="list.bullet" tintColor={color} size={22} />
            ) : (
              <Feather name="list" size={22} color={color} />
            );
          },
        }}
      />
      <Tabs.Screen
        name="emis"
        options={{
          title: t("EMIs"),
          tabBarIcon: ({ focused }) => {
            const color = focused ? colors.primary : colors.mutedForeground;
            return isIOS ? (
              <SymbolView name="calendar.badge.clock" tintColor={color} size={22} />
            ) : (
              <Feather name="refresh-cw" size={20} color={color} />
            );
          },
        }}
      />
      <Tabs.Screen
        name="loans"
        options={{
          title: t("Loans"),
          tabBarIcon: ({ focused }) => {
            const color = focused ? colors.primary : colors.mutedForeground;
            return isIOS ? (
              <SymbolView name="dollarsign.circle" tintColor={color} size={22} />
            ) : (
              <Feather name="dollar-sign" size={22} color={color} />
            );
          },
        }}
      />
      <Tabs.Screen
        name="wallets"
        options={{
          title: t("Wallets"),
          tabBarIcon: ({ focused }) => {
            const color = focused ? colors.primary : colors.mutedForeground;
            return isIOS ? (
              <SymbolView name="wallet.pass" tintColor={color} size={22} />
            ) : (
              <Feather name="credit-card" size={22} color={color} />
            );
          },
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
