import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
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

function fmt(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function generateMonthlyData(baseIncome: number, baseExpense: number) {
  return MONTHS.slice(0, 6).map((month, i) => ({
    month,
    income: Math.round(baseIncome * (0.9 + Math.random() * 0.2)),
    expense: Math.round(baseExpense * (0.75 + Math.random() * 0.35)),
  }));
}

function BarChartSection({
  data,
  currency,
}: {
  data: { month: string; income: number; expense: number }[];
  currency: string;
}) {
  const colors = useColors();
  const maxVal = Math.max(...data.flatMap((d) => [d.income, d.expense]));
  const BAR_MAX_H = 80;

  return (
    <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.chartTitle, { color: colors.foreground }]}>Income vs Expenses</Text>
      <View style={{ flexDirection: "row", gap: 16, marginBottom: 12 }}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.destructive }]} />
          <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Expenses</Text>
        </View>
      </View>
      <View style={styles.barsRow}>
        {data.map((item) => {
          const incH = Math.max(4, (item.income / maxVal) * BAR_MAX_H);
          const expH = Math.max(4, (item.expense / maxVal) * BAR_MAX_H);
          return (
            <View key={item.month} style={styles.barGroup}>
              <View style={[styles.barsWrap, { height: BAR_MAX_H }]}>
                <View style={{ height: BAR_MAX_H, justifyContent: "flex-end", flex: 1 }}>
                  <View
                    style={[
                      styles.bar,
                      { height: incH, backgroundColor: colors.success, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
                    ]}
                  />
                </View>
                <View style={{ height: BAR_MAX_H, justifyContent: "flex-end", flex: 1 }}>
                  <View
                    style={[
                      styles.bar,
                      { height: expH, backgroundColor: colors.destructive, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
                    ]}
                  />
                </View>
              </View>
              <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>{item.month}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function CategoryBreakdown() {
  const colors = useColors();
  const finance = useFinance();

  const byCategory: Record<string, number> = {};
  for (const exp of finance.expenses) {
    byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
  }
  const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(byCategory).sort(([, a], [, b]) => b - a);

  return (
    <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.chartTitle, { color: colors.foreground }]}>Category Breakdown</Text>
      <View style={{ gap: 12 }}>
        {sorted.map(([cat, amount], i) => {
          const pct = total > 0 ? (amount / total) * 100 : 0;
          const color = colors.chartColors[i % colors.chartColors.length];
          return (
            <View key={cat}>
              <View style={styles.catRow}>
                <View style={[styles.catDot, { backgroundColor: color }]} />
                <Text style={[styles.catLabel, { color: colors.foreground }]}>{cat}</Text>
                <View style={{ flex: 1 }} />
                <Text style={[styles.catPct, { color: colors.mutedForeground }]}>
                  {pct.toFixed(1)}%
                </Text>
                <Text style={[styles.catAmount, { color: colors.foreground }]}>
                  {fmt(amount, finance.currency)}
                </Text>
              </View>
              <View style={[styles.catTrack, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.catFill,
                    { width: `${pct}%`, backgroundColor: color },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const finance = useFinance();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const monthlyData = React.useMemo(
    () => generateMonthlyData(finance.totalMonthlyIncome, finance.totalMonthlyExpenses + finance.totalEMIMonthly),
    [finance.totalMonthlyIncome, finance.totalMonthlyExpenses, finance.totalEMIMonthly]
  );

  const savingsRate = finance.totalMonthlyIncome > 0
    ? Math.max(
        0,
        ((finance.totalMonthlyIncome - finance.totalMonthlyExpenses - finance.totalEMIMonthly) /
          finance.totalMonthlyIncome) *
          100
      )
    : 0;

  const TABS = ["Overview", "Trends"] as const;
  const [activeTab, setActiveTab] = useState<"Overview" | "Trends">("Overview");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Analytics</Text>
      </View>

      {/* Tab switcher */}
      <View style={[styles.tabSwitcher, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tabBtn,
              activeTab === tab && [styles.tabBtnActive, { borderBottomColor: colors.primary }],
            ]}
          >
            <Text
              style={[
                styles.tabBtnText,
                { color: activeTab === tab ? colors.primary : colors.mutedForeground },
              ]}
            >
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: TAB_BAR_HEIGHT + (Platform.OS === "web" ? 34 : 0),
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "Overview" && (
          <>
            {/* KPI row */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                style={[styles.kpiCard, { flex: 1 }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Feather name="trending-up" size={18} color="rgba(255,255,255,0.8)" />
                <Text style={styles.kpiLabel}>Savings Rate</Text>
                <Text style={styles.kpiValue}>{savingsRate.toFixed(1)}%</Text>
              </LinearGradient>
              <View style={[styles.kpiCard, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
                <Feather name="activity" size={18} color={colors.success} />
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Monthly Save</Text>
                <Text style={[styles.kpiValue, { color: colors.foreground }]}>
                  {fmt(Math.max(0, finance.remainingBudget), finance.currency)}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={[styles.kpiCard, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
                <Feather name="credit-card" size={18} color={colors.warning} />
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Subscriptions</Text>
                <Text style={[styles.kpiValue, { color: colors.foreground }]}>
                  {fmt(
                    finance.expenses
                      .filter((e) => e.category === "Entertainment")
                      .reduce((s, e) => s + e.amount, 0),
                    finance.currency
                  )}
                </Text>
              </View>
              <View style={[styles.kpiCard, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
                <Feather name="refresh-cw" size={18} color={colors.primary} />
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Active EMIs</Text>
                <Text style={[styles.kpiValue, { color: colors.foreground }]}>
                  {finance.emis.filter((e) => e.paidInstallments < e.totalInstallments).length}
                </Text>
              </View>
            </View>

            <CategoryBreakdown />
          </>
        )}

        {activeTab === "Trends" && (
          <>
            <BarChartSection data={monthlyData} currency={finance.currency} />

            <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.chartTitle, { color: colors.foreground }]}>6-Month Summary</Text>
              {monthlyData.map((item, i) => {
                const saved = item.income - item.expense;
                return (
                  <View key={i} style={styles.monthRow}>
                    <Text style={[styles.monthLabel, { color: colors.mutedForeground }]}>{item.month}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={styles.monthBars}>
                        <View style={[styles.monthBar, { width: `${Math.min(100, (item.income / (item.income + item.expense)) * 100)}%`, backgroundColor: colors.success }]} />
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.monthSaved,
                        { color: saved >= 0 ? colors.success : colors.destructive },
                      ]}
                    >
                      {saved >= 0 ? "+" : ""}
                      {fmt(saved, finance.currency)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  tabSwitcher: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingHorizontal: 20,
  },
  tabBtn: {
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: {},
  tabBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  kpiCard: {
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  kpiLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  kpiValue: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  chartCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    gap: 8,
  },
  chartTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  barsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  barGroup: { alignItems: "center", gap: 4 },
  barsWrap: { flexDirection: "row", gap: 2, alignItems: "flex-end" },
  bar: { width: 10 },
  barLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  catPct: { fontSize: 12, fontFamily: "Inter_400Regular", marginRight: 8 },
  catAmount: { fontSize: 13, fontFamily: "Inter_600SemiBold", minWidth: 80, textAlign: "right" },
  catTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  catFill: { height: 6, borderRadius: 3 },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  monthLabel: { fontSize: 13, fontFamily: "Inter_500Medium", width: 28 },
  monthBars: { height: 8, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.05)", overflow: "hidden" },
  monthBar: { height: 8, borderRadius: 4 },
  monthSaved: { fontSize: 12, fontFamily: "Inter_600SemiBold", minWidth: 80, textAlign: "right" },
});
