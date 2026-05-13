import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useFinance } from "@/context/FinanceContext";
import { useColors } from "@/hooks/useColors";

const TAB_BAR_HEIGHT = 90;

function greeting(name: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Good Morning, ${name}`;
  if (hour < 17) return `Good Afternoon, ${name}`;
  return `Good Evening, ${name}`;
}

function fmt(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

function AnimatedCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      {children}
    </Animated.View>
  );
}

function ExpenseRow({
  name,
  amount,
  currency,
  dueDate,
  isPaid,
  iconName,
  color,
  onToggle,
}: {
  name: string;
  amount: number;
  currency: string;
  dueDate: number;
  isPaid: boolean;
  iconName: string;
  color: string;
  onToggle: () => void;
}) {
  const colors = useColors();
  const suffix =
    dueDate === 1 ? "st" : dueDate === 2 ? "nd" : dueDate === 3 ? "rd" : "th";
  return (
    <View
      style={[
        styles.expenseRow,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.expenseIcon, { backgroundColor: color + "20" }]}>
        <Feather name={iconName as any} size={18} color={color} />
      </View>
      <View style={styles.expenseInfo}>
        <Text style={[styles.expenseName, { color: colors.foreground }]}>
          {name}
        </Text>
        <Text style={[styles.expenseDue, { color: colors.mutedForeground }]}>
          Due {dueDate}
          {suffix}
        </Text>
      </View>
      <Text style={[styles.expenseAmount, { color: colors.foreground }]}>
        {fmt(amount, currency)}
      </Text>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle();
        }}
        style={[
          styles.paidBadge,
          {
            backgroundColor: isPaid ? colors.successLight : colors.errorLight,
          },
        ]}
      >
        <Text
          style={[
            styles.paidBadgeText,
            { color: isPaid ? colors.success : colors.destructive },
          ]}
        >
          {isPaid ? "Paid" : "Due"}
        </Text>
      </Pressable>
    </View>
  );
}

const INSIGHTS = [
  { icon: "trending-up", text: "18% more spent\nthis month", color: "#F59E0B" },
  { icon: "bell", text: "3 payments due\nnext week", color: "#EF4444" },
  { icon: "layers", text: "SAR 117 on\nsubscriptions", color: "#8B5CF6" },
  {
    icon: "trending-down",
    text: "Can save SAR 900\non food delivery",
    color: "#10B981",
  },
];

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const finance = useFinance();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const totalSpent = finance.totalMonthlyExpenses + finance.totalEMIMonthly;
  const totalSpentPerc = Math.min(1, totalSpent / finance.monthlyBudget);
  const remaining = Math.max(0, finance.remainingBudget);
  const remainingPerc = Math.min(1, remaining / finance.monthlyBudget);

  // Savings: sum of savings-type accounts
  const totalSavings = finance.accounts
    .filter((a) => a.type === "savings")
    .reduce((s, a) => s + a.balance, 0);
  // Savings goal: e.g. 3x monthly income as target
  const savingsGoal = finance.totalMonthlyIncome * 3;
  const savingsPerc = savingsGoal > 0 ? Math.min(1, totalSavings / savingsGoal) : 0;
  // Monthly savings contribution
  const monthlySavings = Math.max(
    0,
    finance.totalMonthlyIncome - totalSpent
  );
  const monthlySavingsRate =
    finance.totalMonthlyIncome > 0
      ? Math.round((monthlySavings / finance.totalMonthlyIncome) * 100)
      : 0;

  const remainingColor =
    totalSpentPerc > 0.85
      ? colors.destructive
      : totalSpentPerc > 0.65
      ? colors.warning
      : colors.success;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingBottom: TAB_BAR_HEIGHT + (Platform.OS === "web" ? 34 : 0),
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero gradient header ── */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroGradient, { paddingTop: topPad + 16 }]}
      >
        {/* Greeting row */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greetingText}>
              {greeting(finance.userName)}
            </Text>
            <Text style={styles.greetingSubtitle}>
              Here's your financial summary
            </Text>
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {finance.userName.charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Total Balance card (hero number) */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
          <Text style={styles.balanceAmount}>
            {fmt(finance.totalBalance, finance.currency)}
          </Text>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <View style={styles.balanceItemIcon}>
                <Feather name="arrow-down-circle" size={14} color="#34D399" />
              </View>
              <Text style={styles.balanceItemLabel}>Monthly Income</Text>
              <Text style={styles.balanceItemValue}>
                {fmt(finance.totalMonthlyIncome, finance.currency)}
              </Text>
            </View>
            <View style={styles.balanceSep} />
            <View style={styles.balanceItem}>
              <View style={styles.balanceItemIcon}>
                <Feather name="arrow-up-circle" size={14} color="#F87171" />
              </View>
              <Text style={styles.balanceItemLabel}>Monthly Spent</Text>
              <Text style={styles.balanceItemValue}>
                {fmt(totalSpent, finance.currency)}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* ── Remaining Balance card (prominent, below hero) ── */}
        <View
          style={[
            styles.remainingCard,
            {
              backgroundColor: colors.card,
              borderColor: remainingColor + "50",
              borderWidth: 1.5,
            },
          ]}
        >
          <View style={styles.remainingTop}>
            <View>
              <Text
                style={[styles.remainingLabel, { color: colors.mutedForeground }]}
              >
                Remaining this month
              </Text>
              <Text
                style={[styles.remainingAmount, { color: remainingColor }]}
              >
                {fmt(remaining, finance.currency)}
              </Text>
              <Text
                style={[
                  styles.remainingSubtitle,
                  { color: colors.mutedForeground },
                ]}
              >
                of {fmt(finance.monthlyBudget, finance.currency)} budget
              </Text>
            </View>
            <View
              style={[
                styles.remainingBadge,
                { backgroundColor: remainingColor + "20" },
              ]}
            >
              <Feather
                name={
                  totalSpentPerc > 0.85
                    ? "alert-triangle"
                    : totalSpentPerc > 0.65
                    ? "clock"
                    : "check-circle"
                }
                size={20}
                color={remainingColor}
              />
              <Text
                style={[styles.remainingBadgeText, { color: remainingColor }]}
              >
                {Math.round(remainingPerc * 100)}%
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View
            style={[
              styles.remainingTrack,
              { backgroundColor: colors.muted },
            ]}
          >
            <View
              style={[
                styles.remainingFill,
                {
                  width: `${Math.min(100, remainingPerc * 100)}%`,
                  backgroundColor: remainingColor,
                },
              ]}
            />
          </View>
          <View style={styles.remainingCapRow}>
            <Text style={[styles.remainingCap, { color: colors.mutedForeground }]}>
              Spent {fmt(totalSpent, finance.currency)}
            </Text>
            <Text style={[styles.remainingCap, { color: colors.mutedForeground }]}>
              Budget {fmt(finance.monthlyBudget, finance.currency)}
            </Text>
          </View>
        </View>

        {/* ── Savings card with bar ── */}
        <View
          style={[
            styles.savingsCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.savingsHeader}>
            <View style={styles.savingsHeaderLeft}>
              <View
                style={[
                  styles.savingsIcon,
                  { backgroundColor: colors.success + "20" },
                ]}
              >
                <Feather name="trending-up" size={18} color={colors.success} />
              </View>
              <View>
                <Text
                  style={[styles.savingsTitle, { color: colors.foreground }]}
                >
                  Savings
                </Text>
                <Text
                  style={[
                    styles.savingsSubtitle,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {monthlySavingsRate}% rate this month
                </Text>
              </View>
            </View>
            <Text
              style={[styles.savingsTotal, { color: colors.success }]}
            >
              {fmt(totalSavings, finance.currency)}
            </Text>
          </View>

          {/* Savings goal progress */}
          <View style={styles.savingsGoalRow}>
            <Text
              style={[styles.savingsGoalLabel, { color: colors.mutedForeground }]}
            >
              Goal progress
            </Text>
            <Text
              style={[styles.savingsGoalPct, { color: colors.foreground }]}
            >
              {Math.round(savingsPerc * 100)}% of {fmt(savingsGoal, finance.currency)}
            </Text>
          </View>
          <View
            style={[
              styles.savingsTrack,
              { backgroundColor: colors.muted },
            ]}
          >
            {/* Glow effect layer */}
            <View
              style={[
                styles.savingsFill,
                {
                  width: `${Math.min(100, savingsPerc * 100)}%`,
                  backgroundColor: colors.success,
                },
              ]}
            />
          </View>

          {/* Monthly savings breakdown row */}
          <View
            style={[
              styles.savingsBreakdownRow,
              { borderTopColor: colors.border },
            ]}
          >
            <View style={styles.savingsBreakdownItem}>
              <Text
                style={[
                  styles.savingsBreakdownLabel,
                  { color: colors.mutedForeground },
                ]}
              >
                Saved this month
              </Text>
              <Text
                style={[
                  styles.savingsBreakdownValue,
                  { color: colors.success },
                ]}
              >
                +{fmt(monthlySavings, finance.currency)}
              </Text>
            </View>
            <View
              style={[
                styles.savingsBreakdownDivider,
                { backgroundColor: colors.border },
              ]}
            />
            <View style={styles.savingsBreakdownItem}>
              <Text
                style={[
                  styles.savingsBreakdownLabel,
                  { color: colors.mutedForeground },
                ]}
              >
                In savings accounts
              </Text>
              <Text
                style={[
                  styles.savingsBreakdownValue,
                  { color: colors.foreground },
                ]}
              >
                {fmt(totalSavings, finance.currency)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Smart Insights ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.foreground, marginBottom: 12 },
          ]}
        >
          Smart Insights
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingRight: 4 }}
          style={{ marginBottom: 24 }}
        >
          {INSIGHTS.map((ins, i) => (
            <AnimatedCard key={i}>
              <View
                style={[
                  styles.insightChip,
                  {
                    backgroundColor: colors.card,
                    borderColor: ins.color + "40",
                    borderWidth: 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.insightIconWrap,
                    { backgroundColor: ins.color + "20" },
                  ]}
                >
                  <Feather name={ins.icon as any} size={16} color={ins.color} />
                </View>
                <Text
                  style={[styles.insightText, { color: colors.foreground }]}
                >
                  {ins.text}
                </Text>
              </View>
            </AnimatedCard>
          ))}
        </ScrollView>

        {/* ── This Month's Payments ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            This Month
          </Text>
          <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
            {finance.expenses.filter((e) => !e.isPaid).length} pending
          </Text>
        </View>
        <View style={{ gap: 8, marginBottom: 24 }}>
          {finance.expenses.map((exp) => (
            <ExpenseRow
              key={exp.id}
              name={exp.name}
              amount={exp.amount}
              currency={finance.currency}
              dueDate={exp.dueDate}
              isPaid={exp.isPaid}
              iconName={exp.iconName}
              color={exp.color}
              onToggle={() => finance.toggleExpensePaid(exp.id)}
            />
          ))}
        </View>

        {/* ── Active EMIs ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.foreground, marginBottom: 12 },
          ]}
        >
          Active EMIs
        </Text>
        <View style={{ gap: 8 }}>
          {finance.emis
            .filter((e) => e.paidInstallments < e.totalInstallments)
            .slice(0, 3)
            .map((emi) => {
              const progress = emi.paidInstallments / emi.totalInstallments;
              const rem = emi.totalInstallments - emi.paidInstallments;
              return (
                <View
                  key={emi.id}
                  style={[
                    styles.emiMini,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.expenseIcon,
                      { backgroundColor: emi.color + "20" },
                    ]}
                  >
                    <Feather
                      name={emi.iconName as any}
                      size={18}
                      color={emi.color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.emiMiniHeader}>
                      <Text
                        style={[
                          styles.expenseName,
                          { color: colors.foreground },
                        ]}
                      >
                        {emi.name}
                      </Text>
                      <Text
                        style={[
                          styles.expenseAmount,
                          { color: colors.foreground },
                        ]}
                      >
                        {fmt(emi.monthlyAmount, finance.currency)}/mo
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.progressBg,
                        {
                          backgroundColor: colors.muted,
                          marginTop: 6,
                          height: 4,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(100, progress * 100)}%`,
                            backgroundColor: emi.color,
                            height: 4,
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.emiMiniCaption,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {emi.paidInstallments}/{emi.totalInstallments} paid ·{" "}
                      {rem} left
                    </Text>
                  </View>
                </View>
              );
            })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroGradient: { paddingHorizontal: 20, paddingBottom: 32 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  greetingText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  greetingSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  // Hero balance card
  balanceCard: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  balanceLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  balanceAmount: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginTop: 4,
    marginBottom: 16,
  },
  balanceDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 16,
  },
  balanceRow: { flexDirection: "row", alignItems: "center" },
  balanceItem: { flex: 1, alignItems: "center" },
  balanceItemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  balanceItemLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
  },
  balanceItemValue: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    marginTop: 2,
  },
  balanceSep: {
    width: 1,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  content: { padding: 20, gap: 16 },

  // Remaining Balance card
  remainingCard: {
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  remainingTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  remainingLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  remainingAmount: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    lineHeight: 34,
  },
  remainingSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  remainingBadge: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    gap: 4,
  },
  remainingBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  remainingTrack: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  remainingFill: {
    height: 10,
    borderRadius: 5,
  },
  remainingCapRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  remainingCap: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },

  // Savings card
  savingsCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    gap: 12,
  },
  savingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  savingsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  savingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  savingsTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  savingsSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  savingsTotal: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  savingsGoalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  savingsGoalLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  savingsGoalPct: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  savingsTrack: {
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
  },
  savingsFill: {
    height: 12,
    borderRadius: 6,
  },
  savingsBreakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 12,
  },
  savingsBreakdownItem: { flex: 1, gap: 2 },
  savingsBreakdownDivider: { width: 1, height: 32 },
  savingsBreakdownLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  savingsBreakdownValue: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },

  // Shared
  progressBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionCount: { fontSize: 13, fontFamily: "Inter_400Regular" },
  insightChip: {
    borderRadius: 14,
    padding: 14,
    width: 140,
    gap: 10,
  },
  insightIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  insightText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  expenseInfo: { flex: 1 },
  expenseName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  expenseDue: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  expenseAmount: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  paidBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  paidBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  emiMini: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  emiMiniHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emiMiniCaption: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
});
