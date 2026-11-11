import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { router } from "expo-router";
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
import { HeaderAction, ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { TYPOGRAPHY } from "@/constants/typography";
import { generateMonthlyReportHTML } from "@/utils/generateReport";
import { cashFlow, getTransactionsByDateRange, monthRange } from "@/finance/ledger";
import type { Transaction } from "@/finance/ledger";

function fmt(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function generateMonthlyData(transactions: Transaction[], currency: string) {
  return Array.from({ length: 6 }, (_, i) => {
    const range = monthRange(i - 5);
    const flow = cashFlow(getTransactionsByDateRange(transactions, range.from, range.to), currency);
    const [year, month] = range.from.split("-").map(Number);
    return {
      month: `${MONTHS[month - 1]} ${String(year).slice(-2)}`,
      income: flow.moneyIn,
      expense: flow.moneyOut,
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
  const maxVal = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
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
          const incH = (item.income / maxVal) * BAR_MAX_H;
          const expH = (item.expense / maxVal) * BAR_MAX_H;
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
  const range = monthRange();
  for (const t of finance.getTransactionsByDateRange(range.from, range.to)) {
    if (t.currency === finance.currency && t.direction === "out" && t.type !== "transfer" && t.type !== "adjustment") {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    }
  }
  const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(byCategory).sort(([, a], [, b]) => b - a);

  return (
    <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.chartTitle, { color: colors.foreground }]}>Recorded spending this month</Text>
      {sorted.length === 0 && <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>No recorded spending yet.</Text>}
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
    () => generateMonthlyData(finance.transactions, finance.currency),
    [finance.transactions, finance.currency]
  );

  const savingsRate =
    finance.actualMonthlyIncome > 0
      ? (finance.actualMonthlyNet / finance.actualMonthlyIncome) * 100
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
        ["Type", "Name", "Category", `Amount (${finance.currency})`, "Recurrence", "Due Date", "Status"],
        ...finance.expenses.filter(e => (e.currency ?? finance.currency) === finance.currency).map((e) => [
          "Expense",
          e.name,
          e.category,
          e.amount.toString(),
          e.recurrence ?? "none",
          e.dueDate.toString(),
          e.isPaid ? "Paid" : "Unpaid",
        ]),
        [],
        ["Type", "Name", `Total Amount (${finance.currency})`, `Monthly Amount (${finance.currency})`, "Paid Installments", "Total Installments", "Progress %"],
        ...finance.emis.filter(e => (e.currency ?? finance.currency) === finance.currency).map((emi) => [
          "EMI",
          emi.name,
          emi.totalAmount.toString(),
          emi.monthlyAmount.toString(),
          emi.paidInstallments.toString(),
          emi.totalInstallments.toString(),
          Math.round((emi.paidInstallments / emi.totalInstallments) * 100) + "%",
        ]),
        [],
        ["Type", "Name", `Balance (${finance.currency})`, "Account Type"],
        ...finance.accounts.filter(a => a.currency === finance.currency).map((a) => ["Account", a.name, a.balance.toString(), a.type]),
        [],
        ["Transaction ID", "Type", "Date", "Description", "Category", "Currency", "Amount", "Direction", "Account ID", "Reference ID", "Transfer Group", "Notes"],
        ...finance.transactions.filter(t => t.currency === finance.currency).map(t => [
          t.id, t.type, t.date, t.description, t.category, t.currency, String(t.amount), t.direction, t.accountId ?? "", t.referenceId ?? "", t.transferGroupId ?? "", t.notes ?? "",
        ]),
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
        expenses: finance.expenses.filter(e => (e.currency ?? finance.currency) === finance.currency),
        emis: finance.emis.filter(e => (e.currency ?? finance.currency) === finance.currency),
        accounts: finance.accounts.filter(a => a.currency === finance.currency),
        incomes: finance.incomes.filter(i => (i.currency ?? finance.currency) === finance.currency),
        savingsGoals: finance.savingsGoals.filter(g => (g.currency ?? finance.currency) === finance.currency),
        transactions: finance.transactions,
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
      <ScreenHeader
        title="Analytics"
        topInset={topPad}
        colors={colors}
        leading={
          <HeaderAction
            icon="arrow-left"
            label="Back to Home"
            variant="neutral"
            testID="analytics-back"
            onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}
          />
        }
        trailing={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              accessibilityLabel="Export CSV"
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
              accessibilityLabel="Export PDF"
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
        }
      />

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
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 + Math.max(insets.bottom, Platform.OS === "web" ? 34 : 0), gap: 16 }}
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
                <Text style={styles.kpiLabel}>Net cash-flow rate</Text>
                <Text style={styles.kpiValue}>{savingsRate.toFixed(1)}%</Text>
              </LinearGradient>
              <View style={[styles.kpiCard, { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
                <Feather name="activity" size={18} color={colors.success} />
                <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>Recorded net flow</Text>
                <Text style={[styles.kpiValue, { color: colors.foreground }]}>
                  {fmt(finance.actualMonthlyNet, finance.currency)}
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
                        <View style={[styles.monthBar, { width: `${item.income + item.expense > 0 ? Math.min(100, (item.income / (item.income + item.expense)) * 100) : 0}%`, backgroundColor: colors.success }]} />
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
  kpiValue: { fontSize: 20, fontFamily: "Inter_600SemiBold", color: "#FFFFFF", fontVariant: ["tabular-nums"] },
  chartCard: { borderRadius: 16, padding: 18, gap: 8 },
  chartTitle: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
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
  catAmount: { fontSize: 13, fontFamily: "Inter_600SemiBold", minWidth: 80, textAlign: "right", fontVariant: ["tabular-nums"] },
  catTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  catFill: { height: 6, borderRadius: 3 },
  monthRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  monthLabel: { fontSize: 13, fontFamily: "Inter_500Medium", width: 28 },
  monthBars: { height: 8, borderRadius: 4, overflow: "hidden" },
  monthBar: { height: 8, borderRadius: 4 },
  monthSaved: { fontSize: 12, fontFamily: "Inter_600SemiBold", minWidth: 80, textAlign: "right", fontVariant: ["tabular-nums"] },
  // Export card at the bottom of overview
  exportCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 16,
    padding: 16,
      },
  exportCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  exportCardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  exportCardSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
