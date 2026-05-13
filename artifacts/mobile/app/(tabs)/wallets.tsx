import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type Account, type Income, useFinance } from "@/context/FinanceContext";
import { useColors } from "@/hooks/useColors";

const TAB_BAR_HEIGHT = 90;

function fmt(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

const ACCOUNT_TYPES = ["bank", "cash", "savings"] as const;
const ACCOUNT_ICONS: Record<string, string> = {
  bank: "credit-card",
  cash: "dollar-sign",
  savings: "trending-up",
};
const ACCOUNT_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#8B5CF6", "#3B82F6", "#EF4444"];

function AccountCard({
  account,
  currency,
  onDelete,
}: {
  account: Account;
  currency: string;
  onDelete: () => void;
}) {
  const colors = useColors();
  const icon = ACCOUNT_ICONS[account.type] || "credit-card";

  return (
    <LinearGradient
      colors={[account.color, account.color + "CC"]}
      style={styles.accountCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.accountCardTop}>
        <View style={styles.accountIconWrap}>
          <Feather name={icon as any} size={20} color="#FFFFFF" />
        </View>
        <TouchableOpacity
          onPress={onDelete}
          style={styles.accountDeleteBtn}
        >
          <Feather name="x" size={14} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>
      <Text style={styles.accountName}>{account.name}</Text>
      <Text style={styles.accountType}>{account.type.charAt(0).toUpperCase() + account.type.slice(1)} Account</Text>
      <Text style={styles.accountBalance}>{fmt(account.balance, currency)}</Text>
    </LinearGradient>
  );
}

function IncomeRow({
  income,
  currency,
  onDelete,
}: {
  income: Income;
  currency: string;
  onDelete: () => void;
}) {
  const colors = useColors();
  const icon = income.type === "salary" ? "briefcase" : income.type === "freelance" ? "code" : "plus-circle";

  return (
    <View style={[styles.incomeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.incomeIcon, { backgroundColor: income.color + "20" }]}>
        <Feather name={icon as any} size={18} color={income.color} />
      </View>
      <View style={styles.incomeInfo}>
        <Text style={[styles.incomeName, { color: colors.foreground }]}>{income.name}</Text>
        <Text style={[styles.incomeType, { color: colors.mutedForeground }]}>
          {income.type.charAt(0).toUpperCase() + income.type.slice(1)} · Monthly
        </Text>
      </View>
      <Text style={[styles.incomeAmount, { color: colors.success }]}>
        +{fmt(income.amount, currency)}
      </Text>
      <TouchableOpacity
        onPress={onDelete}
        style={[styles.incomeDeleteBtn, { backgroundColor: colors.errorLight }]}
      >
        <Feather name="trash-2" size={12} color={colors.destructive} />
      </TouchableOpacity>
    </View>
  );
}

function AddAccountModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const finance = useFinance();
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [type, setType] = useState<"bank" | "cash" | "savings">("bank");
  const [colorIdx, setColorIdx] = useState(0);

  function submit() {
    if (!name.trim() || !balance.trim()) return;
    finance.addAccount({
      name: name.trim(),
      balance: parseFloat(balance) || 0,
      type,
      color: ACCOUNT_COLORS[colorIdx],
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setName(""); setBalance(""); setType("bank"); setColorIdx(0);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Account</Text>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Account Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="e.g. Al Rajhi Bank"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Type</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            {ACCOUNT_TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: type === t ? colors.primary : colors.muted,
                    borderColor: type === t ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.typeChipText, { color: type === t ? colors.primaryForeground : colors.mutedForeground }]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            Balance ({finance.currency})
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            value={balance}
            onChangeText={setBalance}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Color</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
            {ACCOUNT_COLORS.map((col, i) => (
              <Pressable
                key={col}
                onPress={() => setColorIdx(i)}
                style={[
                  styles.colorDot,
                  { backgroundColor: col, borderWidth: colorIdx === i ? 3 : 0, borderColor: "#FFFFFF" },
                ]}
              />
            ))}
          </View>

          <View style={{ flexDirection: "row", gap: 12 }}>
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

function AddIncomeModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const finance = useFinance();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"salary" | "freelance" | "other">("salary");

  const INCOME_TYPES = ["salary", "freelance", "other"] as const;

  function submit() {
    if (!name.trim() || !amount.trim()) return;
    finance.addIncome({
      name: name.trim(),
      amount: parseFloat(amount) || 0,
      type,
      color: type === "salary" ? "#4F46E5" : type === "freelance" ? "#10B981" : "#F59E0B",
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setName(""); setAmount(""); setType("salary");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Income</Text>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="e.g. Monthly Salary"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Type</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            {INCOME_TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: type === t ? colors.primary : colors.muted,
                    borderColor: type === t ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.typeChipText, { color: type === t ? colors.primaryForeground : colors.mutedForeground }]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
            Amount ({finance.currency})
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
          />

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

export default function WalletsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const finance = useFinance();
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Wallets</Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: TAB_BAR_HEIGHT + (Platform.OS === "web" ? 34 : 0),
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Total balance */}
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={styles.totalCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.totalLabel}>Total Balance</Text>
          <Text style={styles.totalAmount}>{fmt(finance.totalBalance, finance.currency)}</Text>
          <View style={styles.totalRow}>
            <View style={styles.totalItem}>
              <Text style={styles.totalItemLabel}>{finance.accounts.length} accounts</Text>
            </View>
            <View style={styles.totalSep} />
            <View style={styles.totalItem}>
              <Text style={styles.totalItemLabel}>
                +{fmt(finance.totalMonthlyIncome, finance.currency)}/mo
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Accounts */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Accounts</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowAddAccount(true);
            }}
            style={[styles.addSmallBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={16} color={colors.primaryForeground} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12, paddingRight: 4 }}
        >
          {finance.accounts.map((acc) => (
            <AccountCard
              key={acc.id}
              account={acc}
              currency={finance.currency}
              onDelete={() =>
                Alert.alert("Remove account?", `Remove ${acc.name}?`, [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => finance.deleteAccount(acc.id),
                  },
                ])
              }
            />
          ))}
          {finance.accounts.length === 0 && (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No accounts added
            </Text>
          )}
        </ScrollView>

        {/* Income sources */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Income Sources</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowAddIncome(true);
            }}
            style={[styles.addSmallBtn, { backgroundColor: colors.success }]}
          >
            <Feather name="plus" size={16} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={{ gap: 8 }}>
          {finance.incomes.map((inc) => (
            <IncomeRow
              key={inc.id}
              income={inc}
              currency={finance.currency}
              onDelete={() =>
                Alert.alert("Remove income?", `Remove ${inc.name}?`, [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Remove",
                    style: "destructive",
                    onPress: () => finance.deleteIncome(inc.id),
                  },
                ])
              }
            />
          ))}
          {finance.incomes.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="dollar-sign" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No income sources added
              </Text>
            </View>
          )}
        </View>

        {/* Monthly overview */}
        <View style={[styles.overviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 16 }]}>
            Monthly Overview
          </Text>
          <View style={styles.overviewRow}>
            <Feather name="arrow-down-circle" size={18} color={colors.success} />
            <Text style={[styles.overviewLabel, { color: colors.mutedForeground }]}>Total Income</Text>
            <Text style={[styles.overviewValue, { color: colors.success }]}>
              +{fmt(finance.totalMonthlyIncome, finance.currency)}
            </Text>
          </View>
          <View style={[styles.overviewDivider, { backgroundColor: colors.border }]} />
          <View style={styles.overviewRow}>
            <Feather name="arrow-up-circle" size={18} color={colors.destructive} />
            <Text style={[styles.overviewLabel, { color: colors.mutedForeground }]}>Expenses</Text>
            <Text style={[styles.overviewValue, { color: colors.destructive }]}>
              -{fmt(finance.totalMonthlyExpenses, finance.currency)}
            </Text>
          </View>
          <View style={[styles.overviewDivider, { backgroundColor: colors.border }]} />
          <View style={styles.overviewRow}>
            <Feather name="refresh-cw" size={18} color={colors.warning} />
            <Text style={[styles.overviewLabel, { color: colors.mutedForeground }]}>EMIs</Text>
            <Text style={[styles.overviewValue, { color: colors.warning }]}>
              -{fmt(finance.totalEMIMonthly, finance.currency)}
            </Text>
          </View>
          <View style={[styles.overviewDivider, { backgroundColor: colors.border }]} />
          <View style={styles.overviewRow}>
            <Feather name="trending-up" size={18} color={colors.primary} />
            <Text style={[styles.overviewLabel, { color: colors.foreground }]}>Net Savings</Text>
            <Text style={[styles.overviewValue, { color: colors.primary }]}>
              {fmt(Math.max(0, finance.remainingBudget), finance.currency)}
            </Text>
          </View>
        </View>
      </ScrollView>

      <AddAccountModal visible={showAddAccount} onClose={() => setShowAddAccount(false)} />
      <AddIncomeModal visible={showAddIncome} onClose={() => setShowAddIncome(false)} />
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
  totalCard: {
    borderRadius: 20,
    padding: 24,
  },
  totalLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  totalAmount: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    marginTop: 4,
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
    paddingTop: 14,
    gap: 16,
  },
  totalItem: { flex: 1 },
  totalItemLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.8)",
  },
  totalSep: { width: 1, backgroundColor: "rgba(255,255,255,0.2)" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  addSmallBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  accountCard: {
    width: 180,
    borderRadius: 20,
    padding: 18,
    gap: 4,
  },
  accountCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  accountIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  accountDeleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  accountType: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginBottom: 8 },
  accountBalance: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  incomeRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  incomeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  incomeInfo: { flex: 1 },
  incomeName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  incomeType: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  incomeAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  incomeDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  overviewCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    gap: 12,
  },
  overviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  overviewLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  overviewValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  overviewDivider: { height: 1 },
  emptyState: { alignItems: "center", paddingVertical: 24, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, letterSpacing: 0.5 },
  input: { borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 16, borderWidth: 1 },
  typeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  typeChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  btn: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
