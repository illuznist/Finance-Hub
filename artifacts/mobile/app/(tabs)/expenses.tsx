import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

import { type Expense, useFinance } from "@/context/FinanceContext";
import { useColors } from "@/hooks/useColors";

const TAB_BAR_HEIGHT = 90;

const CATEGORIES = ["All", "Housing", "Bills", "Entertainment", "Health", "Transport", "Food", "Other"];
const CATEGORY_COLORS: Record<string, string> = {
  Housing: "#4F46E5",
  Bills: "#F59E0B",
  Entertainment: "#EF4444",
  Health: "#10B981",
  Transport: "#3B82F6",
  Food: "#F97316",
  Other: "#8B5CF6",
};

const ICON_OPTIONS = [
  "home", "wifi", "zap", "tv", "music", "activity", "shield",
  "package", "coffee", "shopping-bag", "truck", "heart", "book",
];

function fmt(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

function CategoryFilter({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (c: string) => void;
}) {
  const colors = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 8 }}
    >
      {CATEGORIES.map((cat) => {
        const active = selected === cat;
        return (
          <Pressable
            key={cat}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(cat);
            }}
            style={[
              styles.catChip,
              {
                backgroundColor: active ? colors.primary : colors.card,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.catChipText,
                { color: active ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function AddExpenseModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useColors();
  const finance = useFinance();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Bills");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("1");
  const [icon, setIcon] = useState("zap");

  function submit() {
    if (!name.trim() || !amount.trim()) return;
    const cat = category as string;
    finance.addExpense({
      name: name.trim(),
      category: cat,
      amount: parseFloat(amount) || 0,
      dueDate: Math.max(1, Math.min(31, parseInt(dueDate) || 1)),
      isPaid: false,
      iconName: icon,
      color: CATEGORY_COLORS[cat] || "#8B5CF6",
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setName("");
    setAmount("");
    setDueDate("1");
    setCategory("Bills");
    setIcon("zap");
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Add Expense</Text>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            placeholder="Expense name"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
          />

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
            {CATEGORIES.filter((c) => c !== "All").map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.catChip,
                  { backgroundColor: category === cat ? colors.primary : colors.muted, borderColor: category === cat ? colors.primary : colors.border },
                ]}
              >
                <Text style={[styles.catChipText, { color: category === cat ? colors.primaryForeground : colors.mutedForeground }]}>
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
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
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Due Day</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                placeholder="1-31"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                value={dueDate}
                onChangeText={setDueDate}
              />
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Icon</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginBottom: 20 }}>
            {ICON_OPTIONS.map((ic) => (
              <Pressable
                key={ic}
                onPress={() => setIcon(ic)}
                style={[
                  styles.iconOption,
                  {
                    backgroundColor: icon === ic ? colors.primary + "30" : colors.muted,
                    borderColor: icon === ic ? colors.primary : colors.border,
                  },
                ]}
              >
                <Feather name={ic as any} size={18} color={icon === ic ? colors.primary : colors.mutedForeground} />
              </Pressable>
            ))}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              onPress={onClose}
              style={[styles.btn, { backgroundColor: colors.muted, flex: 1 }]}
            >
              <Text style={[styles.btnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              style={[styles.btn, { backgroundColor: colors.primary, flex: 1 }]}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Add</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function ExpensesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const finance = useFinance();
  const [selectedCat, setSelectedCat] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const filtered = selectedCat === "All"
    ? finance.expenses
    : finance.expenses.filter((e) => e.category === selectedCat);

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);
  const paidCount = filtered.filter((e) => e.isPaid).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Expenses</Text>
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

      <CategoryFilter selected={selectedCat} onSelect={setSelectedCat} />

      {/* Summary row */}
      <View style={[styles.summaryRow, { paddingHorizontal: 20, marginBottom: 8 }]}>
        <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>
          {filtered.length} expenses · {paidCount} paid
        </Text>
        <Text style={[styles.summaryTotal, { color: colors.foreground }]}>
          {fmt(totalFiltered, finance.currency)}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: TAB_BAR_HEIGHT + (Platform.OS === "web" ? 34 : 0),
          gap: 8,
        }}
        showsVerticalScrollIndicator={false}
      >
        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Feather name="inbox" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              No expenses in this category
            </Text>
          </View>
        )}
        {filtered.map((exp) => (
          <ExpenseCard
            key={exp.id}
            expense={exp}
            currency={finance.currency}
            onToggle={() => finance.toggleExpensePaid(exp.id)}
            onDelete={() => {
              Alert.alert("Delete", `Remove ${exp.name}?`, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => finance.deleteExpense(exp.id),
                },
              ]);
            }}
          />
        ))}
      </ScrollView>

      <AddExpenseModal visible={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

function ExpenseCard({
  expense,
  currency,
  onToggle,
  onDelete,
}: {
  expense: Expense;
  currency: string;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  const suffix =
    expense.dueDate === 1
      ? "st"
      : expense.dueDate === 2
      ? "nd"
      : expense.dueDate === 3
      ? "rd"
      : "th";

  return (
    <View style={[styles.expCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.expIconWrap, { backgroundColor: expense.color + "20" }]}>
        <Feather name={expense.iconName as any} size={20} color={expense.color} />
      </View>
      <View style={styles.expInfo}>
        <Text style={[styles.expName, { color: colors.foreground }]}>{expense.name}</Text>
        <Text style={[styles.expMeta, { color: colors.mutedForeground }]}>
          {expense.category} · Due {expense.dueDate}{suffix}
        </Text>
      </View>
      <View style={styles.expRight}>
        <Text style={[styles.expAmount, { color: colors.foreground }]}>
          {fmt(expense.amount, currency)}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onToggle();
            }}
            style={[
              styles.statusBtn,
              {
                backgroundColor: expense.isPaid ? colors.successLight : colors.errorLight,
              },
            ]}
          >
            <Text
              style={[
                styles.statusBtnText,
                { color: expense.isPaid ? colors.success : colors.destructive },
              ]}
            >
              {expense.isPaid ? "Paid" : "Due"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            style={[styles.deleteBtn, { backgroundColor: colors.errorLight }]}
          >
            <Feather name="trash-2" size={12} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>
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
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  catChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  summaryTotal: { fontSize: 15, fontFamily: "Inter_700Bold" },
  expCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  expIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  expInfo: { flex: 1 },
  expName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  expMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3 },
  expRight: { alignItems: "flex-end" },
  expAmount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statusBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  deleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 20 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, letterSpacing: 0.5 },
  input: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
    borderWidth: 1,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  btn: {
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
