import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G } from "react-native-svg";

import { type EMI, useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { SkeletonEMICard } from "@/components/Skeleton";
import { useColors } from "@/hooks/useColors";

const TAB_BAR_HEIGHT = 90;

function fmt(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

const DONUT_SIZE = 130;
const STROKE_WIDTH = 14;
const RADIUS = (DONUT_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = DONUT_SIZE / 2;

function DonutChart({
  progress,
  color,
  bgColor,
}: {
  progress: number;
  color: string;
  bgColor: string;
}) {
  const offset = CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
      <G>
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke={bgColor}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${CENTER}, ${CENTER}`}
        />
      </G>
    </Svg>
  );
}

function EMICard({
  emi,
  currency,
  onMarkPaid,
  onDelete,
}: {
  emi: EMI;
  currency: string;
  onMarkPaid: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 100, friction: 14, useNativeDriver: true }),
    ]).start();
  }, []);

  const progress = emi.paidInstallments / emi.totalInstallments;
  const remaining = emi.totalInstallments - emi.paidInstallments;
  const isComplete = remaining === 0;
  const totalPaid = emi.paidInstallments * emi.monthlyAmount;
  const totalRemaining = remaining * emi.monthlyAmount;

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
    <View style={[styles.emiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.emiCardTop}>
        <View style={styles.emiCardLeft}>
          <View style={[styles.emiIcon, { backgroundColor: emi.color + "20" }]}>
            <Feather name={emi.iconName as any} size={22} color={emi.color} />
          </View>
          <View>
            <Text style={[styles.emiName, { color: colors.foreground }]}>{emi.name}</Text>
            <Text style={[styles.emiDue, { color: colors.mutedForeground }]}>
              Due {emi.dueDayOfMonth}
              {emi.dueDayOfMonth === 1 ? "st" : emi.dueDayOfMonth === 2 ? "nd" : emi.dueDayOfMonth === 3 ? "rd" : "th"} of month
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onDelete} style={[styles.deleteIcon, { backgroundColor: colors.errorLight }]}>
          <Feather name="trash-2" size={14} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      <View style={styles.emiChartRow}>
        <View style={styles.donutWrap}>
          <DonutChart
            progress={progress}
            color={isComplete ? colors.success : emi.color}
            bgColor={colors.muted}
          />
          <View style={styles.donutCenter}>
            <Text style={[styles.donutAmount, { color: colors.foreground }]}>
              {fmt(emi.monthlyAmount, currency)}
            </Text>
            <Text style={[styles.donutLabel, { color: colors.mutedForeground }]}>per month</Text>
          </View>
        </View>

        <View style={styles.emiStats}>
          <View style={styles.emiStatRow}>
            <Text style={[styles.emiStatLabel, { color: colors.mutedForeground }]}>Total</Text>
            <Text style={[styles.emiStatValue, { color: colors.foreground }]}>
              {fmt(emi.totalAmount, currency)}
            </Text>
          </View>
          <View style={[styles.emiStatDivider, { backgroundColor: colors.border }]} />
          <View style={styles.emiStatRow}>
            <Text style={[styles.emiStatLabel, { color: colors.mutedForeground }]}>Paid</Text>
            <Text style={[styles.emiStatValue, { color: colors.success }]}>
              {fmt(totalPaid, currency)}
            </Text>
          </View>
          <View style={[styles.emiStatDivider, { backgroundColor: colors.border }]} />
          <View style={styles.emiStatRow}>
            <Text style={[styles.emiStatLabel, { color: colors.mutedForeground }]}>Left</Text>
            <Text style={[styles.emiStatValue, { color: colors.destructive }]}>
              {fmt(totalRemaining, currency)}
            </Text>
          </View>
          <View style={[styles.emiStatDivider, { backgroundColor: colors.border }]} />
          <View style={styles.emiStatRow}>
            <Text style={[styles.emiStatLabel, { color: colors.mutedForeground }]}>Progress</Text>
            <Text style={[styles.emiStatValue, { color: colors.foreground }]}>
              {emi.paidInstallments}/{emi.totalInstallments}
            </Text>
          </View>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.min(100, progress * 100)}%`,
              backgroundColor: isComplete ? colors.success : emi.color,
            },
          ]}
        />
      </View>
      <Text style={[styles.progressCaption, { color: colors.mutedForeground }]}>
        {isComplete
          ? "Fully paid"
          : `${remaining} installment${remaining !== 1 ? "s" : ""} remaining`}
      </Text>

      {!isComplete && (
        <TouchableOpacity
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onMarkPaid();
          }}
          style={[styles.markPaidBtn, { backgroundColor: colors.success + "20", borderColor: colors.success + "40" }]}
        >
          <Feather name="check-circle" size={16} color={colors.success} />
          <Text style={[styles.markPaidText, { color: colors.success }]}>
            Mark this month as paid
          </Text>
        </TouchableOpacity>
      )}
    </View>
    </Animated.View>
  );
}

function AddEMIModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const finance = useFinance();
  const toast = useToast();
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [monthly, setMonthly] = useState("");
  const [totalInst, setTotalInst] = useState("");
  const [paidInst, setPaidInst] = useState("0");
  const [dueDay, setDueDay] = useState("7");

  function submit() {
    if (!name.trim() || !total.trim() || !monthly.trim() || !totalInst.trim()) return;
    finance.addEMI({
      name: name.trim(),
      totalAmount: parseFloat(total) || 0,
      monthlyAmount: parseFloat(monthly) || 0,
      totalInstallments: parseInt(totalInst) || 1,
      paidInstallments: parseInt(paidInst) || 0,
      startMonth: new Date().toISOString().slice(0, 7),
      dueDayOfMonth: Math.max(1, Math.min(31, parseInt(dueDay) || 7)),
      color: "#6366F1",
      iconName: "smartphone",
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast.show("Installment added");
    setName(""); setTotal(""); setMonthly("");
    setTotalInst(""); setPaidInst("0"); setDueDay("7");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Installment</Text>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Name (e.g. iPhone 15 Pro)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="Item name"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
          />

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Total ({finance.currency})</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholder="4000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={total}
                onChangeText={setTotal}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Monthly</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholder="500"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={monthly}
                onChangeText={setMonthly}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Total Inst.</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholder="8"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={totalInst}
                onChangeText={setTotalInst}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Paid so far</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={paidInst}
                onChangeText={setPaidInst}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Due Day</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholder="7"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={dueDay}
                onChangeText={setDueDay}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: colors.muted, flex: 1 }]}>
              <Text style={[styles.btnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]}>
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Add</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function EMIsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const finance = useFinance();
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    const t = setTimeout(() => setShowSkeleton(false), 400);
    return () => clearTimeout(t);
  }, []);

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const activeEMIs = finance.emis.filter((e) => e.paidInstallments < e.totalInstallments);
  const completedEMIs = finance.emis.filter((e) => e.paidInstallments >= e.totalInstallments);
  const totalMonthlyEMI = activeEMIs.reduce((s, e) => s + e.monthlyAmount, 0);
  const totalOwed = activeEMIs.reduce(
    (s, e) => s + (e.totalInstallments - e.paidInstallments) * e.monthlyAmount,
    0
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Installments</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowAdd(true);
          }}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>

      {showSkeleton ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: TAB_BAR_HEIGHT, gap: 16 }} showsVerticalScrollIndicator={false}>
          <SkeletonEMICard />
          <SkeletonEMICard />
          <SkeletonEMICard />
        </ScrollView>
      ) : (
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: TAB_BAR_HEIGHT + (Platform.OS === "web" ? 34 : 0),
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {/* Summary cards */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <LinearGradient
            colors={[colors.gradientStart, colors.gradientEnd]}
            style={[styles.summaryCard, { flex: 1 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Feather name="refresh-cw" size={18} color="rgba(255,255,255,0.8)" />
            <Text style={styles.summaryCardLabel}>Monthly EMIs</Text>
            <Text style={styles.summaryCardValue}>
              {fmt(totalMonthlyEMI, finance.currency)}
            </Text>
          </LinearGradient>
          <View style={[styles.summaryCard, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
            <Feather name="clock" size={18} color={colors.destructive} />
            <Text style={[styles.summaryCardLabel, { color: colors.mutedForeground }]}>Total Owed</Text>
            <Text style={[styles.summaryCardValue, { color: colors.foreground }]}>
              {fmt(totalOwed, finance.currency)}
            </Text>
          </View>
        </View>

        {/* Active EMIs */}
        {activeEMIs.length === 0 && completedEMIs.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No installments yet
            </Text>
          </View>
        )}

        {activeEMIs.map((emi) => (
          <EMICard
            key={emi.id}
            emi={emi}
            currency={finance.currency}
            onMarkPaid={() => {
              finance.markEMIPaid(emi.id);
              toast.show("Payment recorded");
            }}
            onDelete={() =>
              Alert.alert("Delete", `Remove ${emi.name}?`, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => { finance.deleteEMI(emi.id); toast.show("Installment removed"); },
                },
              ])
            }
          />
        ))}

        {completedEMIs.length > 0 && (
          <>
            <Text style={[styles.completedLabel, { color: colors.mutedForeground }]}>Completed</Text>
            {completedEMIs.map((emi) => (
              <EMICard
                key={emi.id}
                emi={emi}
                currency={finance.currency}
                onMarkPaid={() => {}}
                onDelete={() =>
                  Alert.alert("Delete", `Remove ${emi.name}?`, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => { finance.deleteEMI(emi.id); toast.show("Installment removed"); },
                    },
                  ])
                }
              />
            ))}
          </>
        )}
      </ScrollView>
      )}

      <AddEMIModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  summaryCardLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  summaryCardValue: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  emiCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  emiCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  emiCardLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  emiIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emiName: { fontSize: 16, fontFamily: "Inter_700Bold" },
  emiDue: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  deleteIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emiChartRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  donutWrap: {
    width: DONUT_SIZE,
    height: DONUT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  donutCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  donutAmount: { fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  donutLabel: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  emiStats: { flex: 1, gap: 6 },
  emiStatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emiStatLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emiStatValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emiStatDivider: { height: 1 },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  progressCaption: { fontSize: 12, fontFamily: "Inter_400Regular" },
  markPaidBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  markPaidText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  completedLabel: { fontSize: 13, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 1 },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, letterSpacing: 0.5 },
  input: { borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 16, borderWidth: 1 },
  btn: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
