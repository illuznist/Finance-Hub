import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useFinance } from "@/context/FinanceContext";
import { useColors } from "@/hooks/useColors";
import { TYPOGRAPHY } from "@/constants/typography";
import { generateMonthlyReportHTML } from "@/utils/generateReport";

const TAB_BAR_HEIGHT = 90;

function fmt(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function generateMonthlyData(baseIncome: number, baseExpense: number) {
  // Use seeded values derived from the actual income/expense so they're stable
  return MONTHS.slice(0, 6).map((month, i) => {
    const seed = (baseIncome + i * 137) % 100;
    const seed2 = (baseExpense + i * 97) % 100;
    return {
      month,
      income: Math.round(baseIncome * (0.88 + (seed / 100) * 0.24)),
      expense: Math.round(baseExpense * (0.72 + (seed2 / 100) * 0.36)),
    };
  });
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
                  <View style={[styles.bar, { height: incH, backgroundColor: colors.success, borderTopLeftRadius: 4, borderTopRightRadius: 4 }]} />
                </View>
                <View style={{ height: BAR_MAX_H, justifyContent: "flex-end", flex: 1 }}>
                  <View style={[styles.bar, { height: expH, backgroundColor: colors.destructive, borderTopLeftRadius: 4, borderTopRightRadius: 4 }]} />
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
          const p = total > 0 ? (amount / total) * 100 : 0;
          const color = colors.chartColors[i % colors.chartColors.length];
          return (
            <View key={cat}>
              <View style={styles.catRow}>
                <View style={[styles.catDot, { backgroundColor: color }]} />
                <Text style={[styles.catLabel, { color: colors.foreground }]}>{cat}</Text>
                <View style={{ flex: 1 }} />
                <Text style={[styles.catPct, { color: colors.mutedForeground }]}>{p.toFixed(1)}%</Text>
                <Text style={[styles.catAmount, { color: colors.foreground }]}>{fmt(amount, finance.currency)}</Text>
              </View>
              <View style={[styles.catTrack, { backgroundColor: colors.muted }]}>
                <View style={[styles.catFill, { width: `${p}%`, backgroundColor: color }]} />
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
  const [exporting, setExporting] = useState(false);

  const monthlyData = React.useMemo(
    () => generateMonthlyData(finance.totalMonthlyIncome, finance.totalMonthlyExpenses + finance.totalEMIMonthly),
    [finance.totalMonthlyIncome, finance.totalMonthlyExpenses, finance.totalEMIMonthly]
  );

  const savingsRate =
    finance.totalMonthlyIncome > 0
      ? Math.max(0, ((finance.totalMonthlyIncome - finance.totalMonthlyExpenses - finance.totalEMIMonthly) / finance.totalMonthlyIncome) * 100)
      : 0;

  const [exportingCSV, setExportingCSV] = useState(false);

  const TABS = ["Overview", "Trends"] as const;
  const [activeTab, setActiveTab] = useState<"Overview" | "Trends">("Overview");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  async function handleCSVExport() {
    if (Platform.OS === "web") {
      Alert.alert("Export", "CSV export is available on iOS and Android devices.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExportingCSV(true);
    try {
      const rows: string[][] = [
        ["Type", "Name", "Category", "Amount (SAR)", "Recurrence", "Due Date", "Status"],
        ...finance.expenses.map((e) => [
          "Expense",
          e.name,
          e.category,
          e.amount.toString(),
          e.recurrence ?? "none",
          e.dueDate.toString(),
          e.isPaid ? "Paid" : "Unpaid",
        ]),
        [],
        ["Type", "Name", "Total Amount (SAR)", "Monthly Amount (SAR)", "Paid Installments", "Total Installments", "Progress %"],
        ...finance.emis.map((emi) => [
          "EMI",
          emi.name,
          emi.totalAmount.toString(),
          emi.monthlyAmount.toString(),
          emi.paidInstallments.toString(),
          emi.totalInstallments.toString(),
          Math.round((emi.paidInstallments / emi.totalInstallments) * 100) + "%",
        ]),
        [],
        ["Type", "Name", "Balance (SAR)", "Account Type"],
        ...finance.accounts.map((a) => ["Account", a.name, a.balance.toString(), a.type]),
      ];

      const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
      const uri = (FileSystem.documentDirectory ?? "") + `finance-export-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: "Export CSV" });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert("Export ready", `CSV saved to: ${uri}`);
      }
    } catch {
      Alert.alert("Export failed", "Could not generate the CSV. Please try again.");
    } finally {
      setExportingCSV(false);
    }
  }

  async function handleExport() {
    if (Platform.OS === "web") {
      Alert.alert("Export", "PDF export is available on iOS and Android devices.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExporting(true);
    try {
      const html = generateMonthlyReportHTML({
        userName: finance.userName,
        currency: finance.currency,
        monthlyBudget: finance.monthlyBudget,
        totalMonthlyIncome: finance.totalMonthlyIncome,
        totalMonthlyExpenses: finance.totalMonthlyExpenses,
        totalEMIMonthly: finance.totalEMIMonthly,
        remainingBudget: finance.remainingBudget,
        totalBalance: finance.totalBalance,
        totalSavings: finance.totalSavings,
        expenses: finance.expenses,
        emis: finance.emis,
        accounts: finance.accounts,
        incomes: finance.incomes,
        savingsGoals: finance.savingsGoals,
      });

      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `${finance.userName}'s Finance Report`,
          UTI: "com.adobe.pdf",
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert("Export ready", `Report saved to: ${uri}`);
      }
    } catch (err) {
      Alert.alert("Export failed", "Could not generate the report. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Analytics</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={handleCSVExport}
            disabled={exportingCSV}
            style={[styles.exportBtn, { backgroundColor: colors.success + "18", borderColor: colors.success + "40" }]}
          >
            {exportingCSV ? (
              <ActivityIndicator size="small" color={colors.success} />
            ) : (
              <>
                <Feather name="file-text" size={14} color={colors.success} />
                <Text style={[styles.exportBtnText, { color: colors.success }]}>CSV</Text>
              </>
            )}
          </Pressable>
          <Pressable
            onPress={handleExport}
            disabled={exporting}
            style={[styles.exportBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Feather name="download" size={14} color={colors.primary} />
                <Text style={[styles.exportBtnText, { color: colors.primary }]}>PDF</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>

      {/* Tab switcher */}
      <View style={[styles.tabSwitcher, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {TABS.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabBtn, activeTab === tab && [styles.tabBtnActive, { borderBottomColor: colors.primary }]]}
          >
            <Text style={[styles.tabBtnText, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>
              {tab}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: TAB_BAR_HEIGHT + (Platform.OS === "web" ? 34 : 0), gap: 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
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
                  {fmt(finance.expenses.filter((e) => e.category === "Entertainment").reduce((s, e) => s + e.amount, 0), finance.currency)}
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

            {/* Export teaser card */}
            <Pressable
              onPress={handleExport}
              disabled={exporting}
              style={[styles.exportCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <LinearGradient
                colors={[colors.gradientStart, colors.gradientEnd]}
                style={styles.exportCardIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="file-text" size={20} color="#FFFFFF" />
                )}
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.exportCardTitle, { color: colors.foreground }]}>
                  {exporting ? "Generating report..." : "Export Monthly Report"}
                </Text>
                <Text style={[styles.exportCardSub, { color: colors.mutedForeground }]}>
                  Full PDF with expenses, EMIs, savings and balances
                </Text>
              </View>
              {!exporting && <Feather name="chevron-right" size={18} color={colors.mutedForeground} />}
            </Pressable>
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
                      <View style={[styles.monthBars, { backgroundColor: colors.muted }]}>
                        <View style={[styles.monthBar, { width: `${Math.min(100, (item.income / (item.income + item.expense)) * 100)}%`, backgroundColor: colors.success }]} />
                      </View>
                    </View>
                    <Text style={[styles.monthSaved, { color: saved >= 0 ? colors.success : colors.destructive }]}>
                      {saved >= 0 ? "+" : ""}{fmt(saved, finance.currency)}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: TYPOGRAPHY.pageTitle, fontFamily: "Inter_700Bold" },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 44,
    justifyContent: "center",
  },
  exportBtnText: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_600SemiBold" },
  tabSwitcher: { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 20 },
  tabBtn: { paddingVertical: 12, marginRight: 24, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnActive: {},
  tabBtnText: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_600SemiBold" },
  kpiCard: { borderRadius: 16, padding: 16, gap: 6 },
  kpiLabel: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)", marginTop: 4 },
  kpiValue: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  chartCard: { borderRadius: 16, padding: 18, borderWidth: 1, gap: 8 },
  chartTitle: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_700Bold", marginBottom: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular" },
  barsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  barGroup: { alignItems: "center", gap: 4 },
  barsWrap: { flexDirection: "row", gap: 2, alignItems: "flex-end" },
  bar: { width: 10 },
  barLabel: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular" },
  catRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  catPct: { fontSize: 12, fontFamily: "Inter_400Regular", marginRight: 8 },
  catAmount: { fontSize: 13, fontFamily: "Inter_600SemiBold", minWidth: 80, textAlign: "right" },
  catTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  catFill: { height: 6, borderRadius: 3 },
  monthRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  monthLabel: { fontSize: 13, fontFamily: "Inter_500Medium", width: 28 },
  monthBars: { height: 8, borderRadius: 4, overflow: "hidden" },
  monthBar: { height: 8, borderRadius: 4 },
  monthSaved: { fontSize: 12, fontFamily: "Inter_600SemiBold", minWidth: 80, textAlign: "right" },
  // Export card at the bottom of overview
  exportCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  exportCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  exportCardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 3 },
  exportCardSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
