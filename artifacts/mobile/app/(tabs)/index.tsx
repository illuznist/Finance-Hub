import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { useColors } from "@/hooks/useColors";
import { TYPOGRAPHY } from "@/constants/typography";
import { HeaderAction } from "@/components/ScreenHeader";

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


function ExpenseRow({
  name,
  amount,
  currency,
  dueDate,
  isPaid,
  iconName,
  color,
  onToggle,
  isLast,
}: {
  name: string;
  amount: number;
  currency: string;
  dueDate: number;
  isPaid: boolean;
  iconName: string;
  color: string;
  onToggle: () => void;
  isLast: boolean;
}) {
  const colors = useColors();
  const suffix =
    dueDate === 1 ? "st" : dueDate === 2 ? "nd" : dueDate === 3 ? "rd" : "th";
  return (
    <View
      style={[
        styles.expenseRow,
        { borderBottomColor: colors.border },
        !isLast && styles.expenseRowSeparator,
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

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

type AlertLevel = "warning" | "danger" | "exceeded";

function BudgetAlertBanner({
  spentPerc,
  remaining,
  overspend,
  currency,
}: {
  spentPerc: number;
  remaining: number;
  overspend: number;
  currency: string;
}) {
  const colors = useColors();
  const [dismissedDay, setDismissedDay] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const level: AlertLevel =
    spentPerc >= 1 ? "exceeded" : spentPerc >= 0.95 ? "danger" : "warning";

  const isVisible = spentPerc >= 0.8 && dismissedDay !== todayKey();

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false, tension: 65, friction: 10 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: false }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -80, duration: 200, useNativeDriver: false }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const config = {
    warning: {
      bg: colors.warningLight,
      border: colors.warning,
      icon: "alert-triangle" as const,
      color: colors.warning,
      title: "Heads up",
      body: `You've used ${Math.round(spentPerc * 100)}% of your monthly budget`,
    },
    danger: {
      bg: colors.errorLight,
      border: colors.destructive,
      icon: "alert-circle" as const,
      color: colors.destructive,
      title: "Low budget",
      body: `Only ${currency} ${remaining.toLocaleString()} left this month`,
    },
    exceeded: {
      bg: colors.errorLight,
      border: colors.destructive,
      icon: "x-circle" as const,
      color: colors.destructive,
      title: "Budget exceeded",
      body: `Over by ${currency} ${overspend.toLocaleString()} — review your spending`,
    },
  }[level];

  function dismiss() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDismissedDay(todayKey());
  }

  return (
    <Animated.View
      style={[
        styles.alertBanner,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={[styles.alertIconWrap, { backgroundColor: config.border + "30" }]}>
        <Feather name={config.icon} size={18} color={config.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.alertTitle, { color: config.color }]}>{config.title}</Text>
        <Text style={[styles.alertBody, { color: colors.mutedForeground }]}>{config.body}</Text>
      </View>
      <Pressable onPress={dismiss} style={styles.alertDismiss} hitSlop={10} accessibilityLabel="Dismiss budget alert">
        <Feather name="x" size={16} color={colors.mutedForeground} />
      </Pressable>
    </Animated.View>
  );
}

function ResetBanner() {
  const finance = useFinance();
  const colors = useColors();
  const info = finance.monthResetInfo;
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (info) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
      ]).start();
    }
  }, [info]);

  if (!info) return null;

  function dismiss() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -60, duration: 250, useNativeDriver: false }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 250, useNativeDriver: false }),
    ]).start(() => finance.dismissResetInfo());
  }

  return (
    <Animated.View
      style={[
        styles.alertBanner,
        {
          backgroundColor: colors.secondary,
          borderColor: colors.border,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <View style={[styles.alertIconWrap, { backgroundColor: colors.primary + "20" }]}>
        <Feather name="refresh-cw" size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.alertTitle, { color: colors.primary }]}>
          {info.month} is here
        </Text>
        <Text style={[styles.alertBody, { color: colors.mutedForeground }]}>
          {info.count} recurring {info.count === 1 ? "expense" : "expenses"} reset and ready to track
        </Text>
      </View>
      <Pressable onPress={dismiss} style={styles.alertDismiss} hitSlop={10}>
        <Feather name="x" size={16} color={colors.mutedForeground} />
      </Pressable>
    </Animated.View>
  );
}


export default function DashboardScreen() {
  const router = useRouter();
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const finance = useFinance();
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      {/* ── Brand, greeting, and balance hero ── */}
      <View
        style={[
          styles.heroGradient,
          { paddingTop: topPad + 8, backgroundColor: colors.background },
        ]}
      >
        <View style={styles.brandRow}>
          <View style={styles.brandIdentity}>
            <Image
              source={require("../../assets/images/icon.png")}
              accessibilityLabel="FinanceApp logo"
              resizeMode="cover"
              style={styles.brandIcon}
            />
            <Text
              style={[
                styles.brandName,
                { color: colors.foreground, opacity: 0.94 },
              ]}
            >
              FinanceApp
            </Text>
          </View>
          <View style={styles.brandActions}>
            <HeaderAction
              icon="bar-chart-2"
              label="Open analytics"
              variant="neutral"
              testID="home-analytics-button"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/analytics");
              }}
            />
            <HeaderAction
              icon="settings"
              label="Open settings"
              variant="neutral"
              testID="home-settings-button"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/settings");
              }}
            />
          </View>
        </View>
        {/* Greeting row */}
        <View style={[styles.headerRow, styles.headerRowStacked]}>
          <View style={styles.greetingBlock}>
            <View style={styles.dateRow}>
              <Feather name="calendar" size={13} color={colors.mutedForeground} />
              <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            </View>
            <Text style={[styles.greetingText, { color: colors.foreground }]}>
              {greeting(finance.userName)}
            </Text>
          </View>
        </View>

        {/* Total Balance card with subtle circular detailing */}
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.balanceCard}
        >
          <View style={styles.balanceRings} pointerEvents="none">
            <View style={[styles.balanceRing, styles.balanceRingOuter]} />
            <View style={[styles.balanceRing, styles.balanceRingMiddle]} />
            <View style={[styles.balanceRing, styles.balanceRingInner]} />
          </View>
          <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
          <Text style={styles.balanceAmount}>
            {fmt(finance.totalBalance, finance.currency)}
          </Text>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <View style={styles.balanceItemLabelRow}>
                <Feather name="arrow-down-left" size={13} color="rgba(255,255,255,0.72)" />
                <Text style={styles.balanceItemLabel}>Monthly income</Text>
              </View>
              <Text style={styles.balanceItemValue}>
                {fmt(finance.totalMonthlyIncome, finance.currency)}
              </Text>
            </View>
            <View style={styles.balanceSep} />
            <View style={styles.balanceItem}>
              <View style={styles.balanceItemLabelRow}>
                <Feather name="arrow-up-right" size={13} color="rgba(255,255,255,0.72)" />
                <Text style={styles.balanceItemLabel}>Monthly outflow</Text>
              </View>
              <Text style={styles.balanceItemValue}>
                {fmt(totalSpent, finance.currency)}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.content}>
        {/* ── Remaining Balance card (prominent, below hero) ── */}
        <View
          style={[
            styles.remainingCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
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

        {/* ── Contextual alerts, below the budget snapshot ── */}
        <ResetBanner />
        <BudgetAlertBanner
          spentPerc={totalSpentPerc}
          remaining={remaining}
          overspend={Math.max(0, totalSpent - finance.monthlyBudget)}
          currency={finance.currency}
        />

        {/* ── Upcoming payments ── */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Coming up
          </Text>
          <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>
            {finance.expenses.filter((e) => !e.isPaid).length} pending
          </Text>
        </View>
        <View
          style={[
            styles.expenseList,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {finance.expenses.map((exp, index) => (
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
              isLast={index === finance.expenses.length - 1}
            />
          ))}
        </View>

        {/* ── Savings card with bar ── */}
        <View
          style={[
            styles.savingsCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.savingsHeader,
              screenWidth <= 360 && styles.savingsHeaderCompact,
            ]}
          >
            <View style={styles.savingsHeaderLeft}>
              <View
                style={[
                  styles.savingsIcon,
                  { backgroundColor: colors.success + "20" },
                ]}
              >
                <Feather name="trending-up" size={18} color={colors.success} />
              </View>
              <View style={styles.savingsCopy}>
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

        {/* ── Active EMIs ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.foreground, marginBottom: 12, marginTop: 4 },
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
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 15,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    overflow: "hidden",
  },
  alertIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  alertTitle: {
    fontSize: TYPOGRAPHY.cardTitle,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  alertBody: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
  alertDismiss: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  heroGradient: { paddingHorizontal: 20, paddingBottom: 18 },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  brandIdentity: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandIcon: { width: 34, height: 34, borderRadius: 10 },
  brandName: {
    fontSize: TYPOGRAPHY.cardTitle,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.15,
  },
  brandActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  headerRowStacked: { marginBottom: 18 },
  greetingBlock: { flex: 1, minWidth: 0 },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
  },
  dateText: {
    fontSize: TYPOGRAPHY.supporting,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0,
  },
  greetingText: {
    fontSize: TYPOGRAPHY.pageTitle,
    fontFamily: "Inter_700Bold",
    lineHeight: 30,
  },
  // Hero balance card
  balanceCard: {
    position: "relative",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    overflow: "hidden",
  },
  balanceRings: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  balanceRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  },
  balanceRingOuter: {
    width: 300,
    height: 300,
    top: -208,
    right: -126,
  },
  balanceRingMiddle: {
    width: 244,
    height: 244,
    top: -180,
    right: -96,
  },
  balanceRingInner: {
    width: 190,
    height: 190,
    top: -152,
    right: -70,
  },
  balanceLabel: {
    fontSize: TYPOGRAPHY.supporting,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.65)",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  balanceAmount: {
    fontSize: TYPOGRAPHY.displayValue,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    marginTop: 4,
    marginBottom: 14,
    fontVariant: ["tabular-nums"],
  },
  balanceDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 13,
  },
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  balanceItem: { flex: 1, minWidth: 0 },
  balanceItemLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  balanceItemLabel: {
    fontSize: TYPOGRAPHY.supporting,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.74)",
  },
  balanceItemValue: {
    fontSize: TYPOGRAPHY.body,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
    marginTop: 6,
    fontVariant: ["tabular-nums"],
  },
  balanceSep: {
    width: 1,
    height: 42,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  content: { padding: 20, gap: 16 },

  // Remaining Balance card
  remainingCard: {
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  remainingTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  remainingLabel: {
    fontSize: TYPOGRAPHY.supporting,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  remainingAmount: {
    fontSize: TYPOGRAPHY.heroValue,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 34,
    fontVariant: ["tabular-nums"],
  },
  remainingSubtitle: {
    fontSize: TYPOGRAPHY.bodySmall,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  remainingBadge: {
    flexDirection: "row",
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: "center",
    gap: 6,
  },
  remainingBadgeText: {
    fontSize: TYPOGRAPHY.bodySmall,
    fontFamily: "Inter_700Bold",
  },
  remainingTrack: {
    height: 8,
    borderRadius: 8,
    overflow: "hidden",
  },
  remainingFill: {
    height: 8,
    borderRadius: 8,
  },
  remainingCapRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  remainingCap: {
    fontSize: TYPOGRAPHY.supporting,
    fontFamily: "Inter_400Regular",
  },

  // Savings card
  savingsCard: {
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  savingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  savingsHeaderCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: 8,
  },
  savingsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  savingsCopy: { flex: 1, minWidth: 0 },
  savingsIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  savingsTitle: {
    fontSize: TYPOGRAPHY.cardTitle,
    fontFamily: "Inter_600SemiBold",
  },
  savingsSubtitle: {
    fontSize: TYPOGRAPHY.bodySmall,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  savingsTotal: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 0,
    fontVariant: ["tabular-nums"],
  },
  savingsGoalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  savingsGoalLabel: {
    fontSize: TYPOGRAPHY.supporting,
    fontFamily: "Inter_500Medium",
  },
  savingsGoalPct: {
    fontSize: TYPOGRAPHY.supporting,
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
    fontSize: TYPOGRAPHY.supporting,
    fontFamily: "Inter_400Regular",
  },
  savingsBreakdownValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold", fontVariant: ["tabular-nums"]
  },

  // Shared
  progressBg: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: TYPOGRAPHY.sectionHeading, fontFamily: "Inter_700Bold" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: -4,
  },
  sectionCount: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_400Regular" },
  expenseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  expenseRowSeparator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  expenseList: {
    borderRadius: 16,
    overflow: "hidden",
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  expenseInfo: { flex: 1 },
  expenseName: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_600SemiBold" },
  expenseDue: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", marginTop: 2 },
  expenseAmount: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_600SemiBold", fontVariant: ["tabular-nums"] },
  paidBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  paidBadgeText: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold" },
  emiMini: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  emiMiniHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emiMiniCaption: {
    fontSize: TYPOGRAPHY.supporting,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
});
