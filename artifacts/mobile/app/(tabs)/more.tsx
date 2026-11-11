import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { TYPOGRAPHY } from "@/constants/typography";

const MORE_ITEMS = [
  { title: "Wallets", description: "Accounts, income, and savings goals", icon: "credit-card" as const, route: "/(tabs)/wallets" as const },
  { title: "Analytics", description: "Spending trends and monthly reports", icon: "bar-chart-2" as const, route: "/(tabs)/analytics" as const },
];

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader title="More" topInset={topPad} colors={colors} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.intro, { color: colors.mutedForeground }]}>Your other finance tools</Text>
        {MORE_ITEMS.map((item) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            testID={`more-${item.title.toLowerCase()}`}
            onPress={() => router.push(item.route)}
            style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.secondary }]}>
              <Feather name={item.icon} size={19} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemTitle, { color: colors.foreground }]}>{item.title}</Text>
              <Text style={[styles.itemDescription, { color: colors.mutedForeground }]}>{item.description}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 110, gap: 12 },
  intro: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_400Regular", marginBottom: 3 },
  item: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 16, borderWidth: 1 },
  iconWrap: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13 },
  itemTitle: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_700Bold" },
  itemDescription: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", marginTop: 3 },
});
