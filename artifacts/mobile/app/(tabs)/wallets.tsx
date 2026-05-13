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

import {
  type Account,
  type Income,
  type SavingsGoal,
  useFinance,
} from "@/context/FinanceContext";
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
const PALETTE = ["#0D9488", "#0891B2", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#3B82F6", "#F97316"];

// ─── Account Card ────────────────────────────────────────────────────────────

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
      colors={[account.color, account.color + "BB"]}
      style={styles.accountCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.accountCardTop}>
        <View style={styles.accountIconWrap}>
          <Feather name={icon as any} size={20} color="#FFFFFF" />
        </View>
        <TouchableOpacity onPress={onDelete} style={styles.accountDeleteBtn}>
          <Feather name="x" size={14} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>
      <Text style={styles.accountName}>{account.name}</Text>
      <Text style={styles.accountType}>
        {account.type.charAt(0).toUpperCase() + account.type.slice(1)} Account
      </Text>
      <Text style={styles.accountBalance}>{fmt(account.balance, currency)}</Text>
    </LinearGradient>
  );
}

// ─── Income Row ───────────────────────────────────────────────────────────────

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
  const icon =
    income.type === "salary"
      ? "briefcase"
      : income.type === "freelance"
      ? "code"
      : "plus-circle";

  return (
    <View
      style={[
        styles.incomeRow,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: income.color + "20" }]}>
        <Feather name={icon as any} size={18} color={income.color} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, { color: colors.foreground }]}>
          {income.name}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.mutedForeground }]}>
          {income.type.charAt(0).toUpperCase() + income.type.slice(1)} · Monthly
        </Text>
      </View>
      <Text style={[styles.incomeAmount, { color: colors.success }]}>
        +{fmt(income.amount, currency)}
      </Text>
      <TouchableOpacity
        onPress={onDelete}
        style={[styles.deleteSmall, { backgroundColor: colors.errorLight }]}
      >
        <Feather name="trash-2" size={12} color={colors.destructive} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Savings Goal Card ────────────────────────────────────────────────────────

function SavingsGoalCard({
  goal,
  currency,
  onAddFunds,
  onDelete,
}: {
  goal: SavingsGoal;
  currency: string;
  onAddFunds: (amount: number) => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const [showAdd, setShowAdd] = useState(false);
  const [addAmt, setAddAmt] = useState("");
  const progress = goal.targetAmount > 0 ? Math.min(1, goal.savedAmount / goal.targetAmount) : 0;
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const isComplete = goal.savedAmount >= goal.targetAmount;

  function submitAdd() {
    const n = parseFloat(addAmt);
    if (n > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onAddFunds(n);
    }
    setAddAmt("");
    setShowAdd(false);
  }

  return (
    <View
      style={[
        styles.goalCard,
        { backgroundColor: colors.card, borderColor: isComplete ? goal.color + "60" : colors.border, borderWidth: isComplete ? 1.5 : 1 },
      ]}
    >
      <View style={styles.goalTop}>
        <View style={[styles.goalIcon, { backgroundColor: goal.color + "20" }]}>
          <Feather name={goal.iconName as any} size={20} color={goal.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.goalName, { color: colors.foreground }]}>
            {goal.name}
          </Text>
          {goal.deadline && (
            <Text style={[styles.goalDeadline, { color: colors.mutedForeground }]}>
              Target: {goal.deadline}
            </Text>
          )}
        </View>
        {isComplete ? (
          <View style={[styles.completeBadge, { backgroundColor: goal.color + "20" }]}>
            <Feather name="check-circle" size={14} color={goal.color} />
            <Text style={[styles.completeBadgeText, { color: goal.color }]}>Done</Text>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setShowAdd(!showAdd)}
            style={[styles.addFundsBtn, { backgroundColor: goal.color + "20", borderColor: goal.color + "40" }]}
          >
            <Feather name="plus" size={14} color={goal.color} />
            <Text style={[styles.addFundsBtnText, { color: goal.color }]}>Add</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onDelete}
          style={[styles.deleteSmall, { backgroundColor: colors.errorLight, marginLeft: 6 }]}
        >
          <Feather name="trash-2" size={12} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      {/* Add funds input */}
      {showAdd && (
        <View style={[styles.addFundsRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <TextInput
            style={[styles.addFundsInput, { color: colors.foreground }]}
            placeholder={`Amount (${currency})`}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
            value={addAmt}
            onChangeText={setAddAmt}
            autoFocus
          />
          <TouchableOpacity
            onPress={submitAdd}
            style={[styles.addFundsConfirm, { backgroundColor: goal.color }]}
          >
            <Feather name="check" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Amounts */}
      <View style={styles.goalAmounts}>
        <View>
          <Text style={[styles.goalAmountLabel, { color: colors.mutedForeground }]}>
            Saved
          </Text>
          <Text style={[styles.goalAmountValue, { color: goal.color }]}>
            {fmt(goal.savedAmount, currency)}
          </Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.goalAmountLabel, { color: colors.mutedForeground }]}>
            Progress
          </Text>
          <Text style={[styles.goalPct, { color: colors.foreground }]}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.goalAmountLabel, { color: colors.mutedForeground }]}>
            Target
          </Text>
          <Text style={[styles.goalAmountValue, { color: colors.foreground }]}>
            {fmt(goal.targetAmount, currency)}
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.goalTrack, { backgroundColor: colors.muted }]}>
        <View
          style={[
            styles.goalFill,
            { width: `${Math.min(100, progress * 100)}%`, backgroundColor: goal.color },
          ]}
        />
      </View>
      {!isComplete && (
        <Text style={[styles.goalRemaining, { color: colors.mutedForeground }]}>
          {fmt(remaining, currency)} still needed
        </Text>
      )}
    </View>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function AddAccountModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const finance = useFinance();
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [type, setType] = useState<"bank" | "cash" | "savings">("bank");
  const [colorIdx, setColorIdx] = useState(0);

  function submit() {
    if (!name.trim() || !balance.trim()) return;
    finance.addAccount({ name: name.trim(), balance: parseFloat(balance) || 0, type, color: PALETTE[colorIdx] });
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
          <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]} placeholder="e.g. Al Rajhi Bank" placeholderTextColor={colors.mutedForeground} value={name} onChangeText={setName} />
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Type</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            {ACCOUNT_TYPES.map((t) => (
              <Pressable key={t} onPress={() => setType(t)} style={[styles.chip, { backgroundColor: type === t ? colors.primary : colors.muted, borderColor: type === t ? colors.primary : colors.border }]}>
                <Text style={[styles.chipText, { color: type === t ? colors.primaryForeground : colors.mutedForeground }]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Balance ({finance.currency})</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]} placeholder="0" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" value={balance} onChangeText={setBalance} />
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Color</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 20 }}>
            {PALETTE.map((col, i) => (
              <Pressable key={col} onPress={() => setColorIdx(i)} style={[styles.colorDot, { backgroundColor: col, borderWidth: colorIdx === i ? 3 : 0, borderColor: "#FFFFFF" }]} />
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: colors.muted, flex: 1 }]}><Text style={[styles.btnText, { color: colors.mutedForeground }]}>Cancel</Text></Pressable>
            <Pressable onPress={submit} style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]}><Text style={[styles.btnText, { color: colors.primaryForeground }]}>Add</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AddIncomeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const finance = useFinance();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"salary" | "freelance" | "other">("salary");
  const INCOME_TYPES = ["salary", "freelance", "other"] as const;

  function submit() {
    if (!name.trim() || !amount.trim()) return;
    finance.addIncome({ name: name.trim(), amount: parseFloat(amount) || 0, type, color: type === "salary" ? "#0D9488" : type === "freelance" ? "#10B981" : "#F59E0B" });
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
          <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]} placeholder="e.g. Monthly Salary" placeholderTextColor={colors.mutedForeground} value={name} onChangeText={setName} />
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Type</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            {INCOME_TYPES.map((t) => (
              <Pressable key={t} onPress={() => setType(t)} style={[styles.chip, { backgroundColor: type === t ? colors.primary : colors.muted, borderColor: type === t ? colors.primary : colors.border }]}>
                <Text style={[styles.chipText, { color: type === t ? colors.primaryForeground : colors.mutedForeground }]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Amount ({finance.currency})</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]} placeholder="0" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" value={amount} onChangeText={setAmount} />
          <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: colors.muted, flex: 1 }]}><Text style={[styles.btnText, { color: colors.mutedForeground }]}>Cancel</Text></Pressable>
            <Pressable onPress={submit} style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]}><Text style={[styles.btnText, { color: colors.primaryForeground }]}>Add</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AddGoalModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const finance = useFinance();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("0");
  const [deadline, setDeadline] = useState("");
  const [colorIdx, setColorIdx] = useState(0);

  const GOAL_ICONS = ["shield", "map", "truck", "home", "heart", "star", "gift", "sun"];
  const [iconIdx, setIconIdx] = useState(0);

  function submit() {
    if (!name.trim() || !target.trim()) return;
    finance.addSavingsGoal({
      name: name.trim(),
      targetAmount: parseFloat(target) || 0,
      savedAmount: parseFloat(saved) || 0,
      color: PALETTE[colorIdx],
      iconName: GOAL_ICONS[iconIdx],
      deadline: deadline.trim() || undefined,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setName(""); setTarget(""); setSaved("0"); setDeadline(""); setColorIdx(0); setIconIdx(0);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>New Savings Goal</Text>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Goal Name</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]} placeholder="e.g. Emergency Fund" placeholderTextColor={colors.mutedForeground} value={name} onChangeText={setName} />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Target ({finance.currency})</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]} placeholder="45000" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" value={target} onChangeText={setTarget} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Already saved</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]} placeholder="0" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" value={saved} onChangeText={setSaved} />
            </View>
          </View>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Deadline (YYYY-MM, optional)</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]} placeholder="2026-06" placeholderTextColor={colors.mutedForeground} value={deadline} onChangeText={setDeadline} />
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Color</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
            {PALETTE.map((col, i) => (
              <Pressable key={col} onPress={() => setColorIdx(i)} style={[styles.colorDot, { backgroundColor: col, borderWidth: colorIdx === i ? 3 : 0, borderColor: "#FFFFFF" }]} />
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: colors.muted, flex: 1 }]}><Text style={[styles.btnText, { color: colors.mutedForeground }]}>Cancel</Text></Pressable>
            <Pressable onPress={submit} style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]}><Text style={[styles.btnText, { color: colors.primaryForeground }]}>Create Goal</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WalletsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const finance = useFinance();
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const totalGoalTarget = finance.savingsGoals.reduce((s, g) => s + g.targetAmount, 0);
  const totalGoalSaved = finance.savingsGoals.reduce((s, g) => s + g.savedAmount, 0);
  const overallGoalProgress = totalGoalTarget > 0 ? totalGoalSaved / totalGoalTarget : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Wallets</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: TAB_BAR_HEIGHT + (Platform.OS === "web" ? 34 : 0), gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Total balance hero */}
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
              <Text style={styles.totalItemLabel}>+{fmt(finance.totalMonthlyIncome, finance.currency)}/mo</Text>
            </View>
            <View style={styles.totalSep} />
            <View style={styles.totalItem}>
              <Text style={styles.totalItemLabel}>{fmt(finance.totalSavings, finance.currency)} saved</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Accounts */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Accounts</Text>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowAddAccount(true); }} style={[styles.addSmallBtn, { backgroundColor: colors.primary }]}>
            <Feather name="plus" size={16} color={colors.primaryForeground} />
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
          {finance.accounts.map((acc) => (
            <AccountCard key={acc.id} account={acc} currency={finance.currency}
              onDelete={() => Alert.alert("Remove account?", `Remove ${acc.name}?`, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => finance.deleteAccount(acc.id) }])}
            />
          ))}
          {finance.accounts.length === 0 && <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No accounts added</Text>}
        </ScrollView>

        {/* Savings Goals */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Savings Goals</Text>
            {totalGoalTarget > 0 && (
              <Text style={[styles.goalsSubtitle, { color: colors.mutedForeground }]}>
                {fmt(totalGoalSaved, finance.currency)} of {fmt(totalGoalTarget, finance.currency)} · {Math.round(overallGoalProgress * 100)}% overall
              </Text>
            )}
          </View>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowAddGoal(true); }} style={[styles.addSmallBtn, { backgroundColor: colors.accent }]}>
            <Feather name="plus" size={16} color="#FFFFFF" />
          </Pressable>
        </View>

        {finance.savingsGoals.length > 0 && (
          <View style={[styles.overallGoalBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.goalTrack, { backgroundColor: colors.muted }]}>
              <View style={[styles.goalFill, { width: `${Math.min(100, overallGoalProgress * 100)}%`, backgroundColor: colors.primary }]} />
            </View>
          </View>
        )}

        {finance.savingsGoals.map((goal) => (
          <SavingsGoalCard
            key={goal.id}
            goal={goal}
            currency={finance.currency}
            onAddFunds={(amount) => finance.updateSavingsGoal(goal.id, { savedAmount: goal.savedAmount + amount })}
            onDelete={() =>
              Alert.alert("Delete goal?", `Remove "${goal.name}"?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => finance.deleteSavingsGoal(goal.id) },
              ])
            }
          />
        ))}
        {finance.savingsGoals.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="target" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No savings goals yet</Text>
          </View>
        )}

        {/* Income sources */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Income Sources</Text>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowAddIncome(true); }} style={[styles.addSmallBtn, { backgroundColor: colors.success }]}>
            <Feather name="plus" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
        <View style={{ gap: 8 }}>
          {finance.incomes.map((inc) => (
            <IncomeRow key={inc.id} income={inc} currency={finance.currency}
              onDelete={() => Alert.alert("Remove income?", `Remove ${inc.name}?`, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => finance.deleteIncome(inc.id) }])}
            />
          ))}
          {finance.incomes.length === 0 && (
            <View style={styles.emptyState}>
              <Feather name="dollar-sign" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No income sources added</Text>
            </View>
          )}
        </View>

        {/* Monthly overview */}
        <View style={[styles.overviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 16 }]}>Monthly Overview</Text>
          {[
            { icon: "arrow-down-circle", label: "Total Income", value: `+${fmt(finance.totalMonthlyIncome, finance.currency)}`, color: colors.success },
            { icon: "arrow-up-circle", label: "Expenses", value: `-${fmt(finance.totalMonthlyExpenses, finance.currency)}`, color: colors.destructive },
            { icon: "refresh-cw", label: "EMIs", value: `-${fmt(finance.totalEMIMonthly, finance.currency)}`, color: colors.warning },
            { icon: "trending-up", label: "Net Savings", value: fmt(Math.max(0, finance.remainingBudget), finance.currency), color: colors.primary },
          ].map((row, i, arr) => (
            <React.Fragment key={row.label}>
              <View style={styles.overviewRow}>
                <Feather name={row.icon as any} size={18} color={row.color} />
                <Text style={[styles.overviewLabel, { color: i === arr.length - 1 ? colors.foreground : colors.mutedForeground }]}>{row.label}</Text>
                <Text style={[styles.overviewValue, { color: row.color }]}>{row.value}</Text>
              </View>
              {i < arr.length - 1 && <View style={[styles.overviewDivider, { backgroundColor: colors.border }]} />}
            </React.Fragment>
          ))}
        </View>
      </ScrollView>

      <AddAccountModal visible={showAddAccount} onClose={() => setShowAddAccount(false)} />
      <AddIncomeModal visible={showAddIncome} onClose={() => setShowAddIncome(false)} />
      <AddGoalModal visible={showAddGoal} onClose={() => setShowAddGoal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  totalCard: { borderRadius: 20, padding: 24 },
  totalLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)", letterSpacing: 1, textTransform: "uppercase" },
  totalAmount: { fontSize: 34, fontFamily: "Inter_700Bold", color: "#FFFFFF", marginTop: 4, marginBottom: 16 },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.2)", paddingTop: 14, gap: 8 },
  totalItem: { flex: 1 },
  totalItemLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)" },
  totalSep: { width: 1, backgroundColor: "rgba(255,255,255,0.2)" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  goalsSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  addSmallBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  accountCard: { width: 180, borderRadius: 20, padding: 18, gap: 4 },
  accountCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  accountIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  accountDeleteBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.2)", alignItems: "center", justifyContent: "center" },
  accountName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  accountType: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)", marginBottom: 8 },
  accountBalance: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  incomeRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 14, borderWidth: 1, gap: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  rowMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  incomeAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  deleteSmall: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  // Savings goal card
  goalCard: { borderRadius: 18, padding: 16, gap: 12 },
  goalTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  goalIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  goalName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  goalDeadline: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  completeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  completeBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  addFundsBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  addFundsBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  addFundsRow: { flexDirection: "row", borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  addFundsInput: { flex: 1, padding: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  addFundsConfirm: { width: 44, alignItems: "center", justifyContent: "center" },
  goalAmounts: { flexDirection: "row", justifyContent: "space-between" },
  goalAmountLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 2 },
  goalAmountValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  goalPct: { fontSize: 16, fontFamily: "Inter_700Bold" },
  goalTrack: { height: 10, borderRadius: 5, overflow: "hidden" },
  goalFill: { height: 10, borderRadius: 5 },
  goalRemaining: { fontSize: 11, fontFamily: "Inter_400Regular" },
  overallGoalBar: { borderRadius: 12, padding: 12, borderWidth: 1 },
  overviewCard: { borderRadius: 16, padding: 18, borderWidth: 1, gap: 12 },
  overviewRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  overviewLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  overviewValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  overviewDivider: { height: 1 },
  emptyState: { alignItems: "center", paddingVertical: 24, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 20 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, letterSpacing: 0.5 },
  input: { borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 16, borderWidth: 1 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  btn: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
