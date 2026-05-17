import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

import { useColors } from "@/hooks/useColors";

function useShimmer() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.65] });
}

export function SkeletonBox({
  width,
  height,
  borderRadius,
  style,
}: {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: object;
}) {
  const colors = useColors();
  const opacity = useShimmer();
  return (
    <Animated.View
      style={[
        {
          width: width ?? "100%",
          height,
          borderRadius: borderRadius ?? 10,
          backgroundColor: colors.muted,
        },
        { opacity },
        style,
      ]}
    />
  );
}

export function SkeletonExpenseCard() {
  const colors = useColors();
  return (
    <View
      style={[
        styles.expCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <SkeletonBox width={44} height={44} borderRadius={13} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBox height={13} width="55%" borderRadius={6} />
        <SkeletonBox height={11} width="38%" borderRadius={6} />
      </View>
      <View style={{ alignItems: "flex-end", gap: 8 }}>
        <SkeletonBox width={72} height={13} borderRadius={6} />
        <SkeletonBox width={56} height={26} borderRadius={9} />
      </View>
    </View>
  );
}

export function SkeletonEMICard() {
  const colors = useColors();
  return (
    <View
      style={[
        styles.emiCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <SkeletonBox width={40} height={40} borderRadius={12} />
        <View style={{ flex: 1, gap: 8 }}>
          <SkeletonBox height={14} width="48%" borderRadius={6} />
          <SkeletonBox height={11} width="34%" borderRadius={6} />
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 16, alignItems: "center", marginTop: 4 }}>
        <SkeletonBox width={130} height={130} borderRadius={65} />
        <View style={{ flex: 1, gap: 12 }}>
          <SkeletonBox height={11} borderRadius={6} />
          <SkeletonBox height={11} borderRadius={6} />
          <SkeletonBox height={11} width="75%" borderRadius={6} />
          <SkeletonBox height={36} borderRadius={10} style={{ marginTop: 4 }} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonDashboardCard() {
  const colors = useColors();
  return (
    <View
      style={[
        styles.dashCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <SkeletonBox height={13} width="42%" borderRadius={6} />
        <SkeletonBox width={36} height={36} borderRadius={11} />
      </View>
      <SkeletonBox height={28} width="58%" borderRadius={8} style={{ marginTop: 8 }} />
      <SkeletonBox height={6} borderRadius={3} style={{ marginTop: 10 }} />
    </View>
  );
}

export function SkeletonRow() {
  const colors = useColors();
  return (
    <View
      style={[
        styles.simpleRow,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <SkeletonBox width={36} height={36} borderRadius={10} />
      <View style={{ flex: 1, gap: 8 }}>
        <SkeletonBox height={13} width="52%" borderRadius={6} />
        <SkeletonBox height={11} width="30%" borderRadius={6} />
      </View>
      <SkeletonBox width={60} height={13} borderRadius={6} />
    </View>
  );
}

const styles = StyleSheet.create({
  expCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  emiCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  dashCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  simpleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
});
