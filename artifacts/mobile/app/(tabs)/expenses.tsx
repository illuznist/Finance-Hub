import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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
import Swipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type Expense, useFinance } from "@/context/FinanceContext";
import { ExpensePaymentModal } from "@/components/ExpensePaymentModal";
import { useToast } from "@/context/ToastContext";
import { SkeletonExpenseCard } from "@/components/Skeleton";
import { HeaderAction, ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { TYPOGRAPHY } from "@/constants/typography";

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
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 8, alignItems: "center" }}
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
            style={({ pressed }) => [
              styles.catChip,
              { opacity: pressed ? 0.7 : 1 },
              {
                backgroundColor: active ? colors.foreground : "transparent",
                borderColor: active ? colors.foreground : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.catChipText,
                { color: active ? colors.background : colors.mutedForeground },
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
  const toast = useToast();
  const router = useRouter();
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
    toast.show("Expense added");
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
            style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: "transparent" }]}
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
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: "transparent" }]}
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
                style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground, borderColor: "transparent" }]}
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

          <Pressable
            testID="add-expense-recurring-link"
            accessibilityRole="link"
            onPress={() => { onClose(); router.push("/recurring?new=1"); }}
            style={[styles.recurringHint, { backgroundColor: colors.secondary }]}
          >
            <Feather name="repeat" size={16} color={colors.primary} />
            <Text style={[styles.recurringHintText, { color: colors.foreground }]}>
              Repeats every month or week? Set it up as a recurring expense instead.
            </Text>
            <Feather name="chevron-right" size={16} color={colors.primary} />
          </Pressable>

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
  const toast = useToast();
  const router = useRouter();
  const [selectedCat, setSelectedCat] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [payingExpense, setPayingExpense] = useState<Expense | null>(null);
  const [search, setSearch] = useState("");
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

  const filtered = finance.expenses
    .filter(e => (e.currency ?? finance.currency) === finance.currency)
    .filter((e) => selectedCat === "All" || e.category === selectedCat)
    .filter((e) => !search.trim() || e.name.toLowerCase().includes(search.trim().toLowerCase()));

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Expenses"
        topInset={topPad}
        colors={colors}
        trailing={
          <View style={{ flexDirection: "row", gap: 8 }}>
          <HeaderAction icon="calendar" label="Open upcoming payments" variant="neutral" testID="expense-upcoming-button"
            onPress={() => router.push("/upcoming")} />
          <HeaderAction icon="repeat" label="Open recurring expenses" variant="neutral" testID="expense-recurring-button"
            onPress={() => router.push("/recurring")} />
          <HeaderAction
            label="Add expense"
            testID="expense-add-button"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowAdd(true);
            }}
          />
          </View>
        }
      />

      {/* Search bar */}
      <View style={[styles.searchWrap, { backgroundColor: colors.muted }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search"
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      <CategoryFilter selected={selectedCat} onSelect={setSelectedCat} />

      {/* Filtered total */}
      <View style={styles.summaryBlock} accessible accessibilityLabel={`${search.trim() ? "Matching expenses" : selectedCat === "All" ? "Total expenses" : selectedCat + " total"} ${fmt(totalFiltered, finance.currency)}`}>
        <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
          {search.trim() ? "Matching expenses" : selectedCat === "All" ? "Total expenses" : `${selectedCat} total`}
        </Text>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={[styles.summaryTotal, { color: colors.foreground }]}
        >
          {fmt(totalFiltered, finance.currency)}
        </Text>
      </View>

      {showSkeleton ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: TAB_BAR_HEIGHT, gap: 8 }} showsVerticalScrollIndicator={false}>
          {[...Array(5)].map((_, i) => <SkeletonExpenseCard key={i} />)}
        </ScrollView>
      ) : (
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: TAB_BAR_HEIGHT + (Platform.OS === "web" ? 34 : 0),
          gap: 8,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      >
        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="inbox" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {search.trim() ? "No matching expenses" : "Nothing here yet"}
            </Text>
          </View>
        )}
        {filtered.map((exp) => (
          <ExpenseCard
            key={exp.id}
            expense={exp}
            currency={finance.currency}
            onToggle={() => {
              if (!exp.isPaid) setPayingExpense(exp);
              else Alert.alert("Mark unpaid?", "This removes the current payment and restores its account balance.", [
                { text: "Cancel", style: "cancel" },
                { text: "Mark unpaid", style: "destructive", onPress: () => finance.setExpensePaid(exp.id, false) },
              ]);
            }}
            onDelete={() => {
              Alert.alert("Delete", `Remove ${exp.name}?`, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => { finance.deleteExpense(exp.id); toast.show("Expense removed"); },
                },
              ]);
            }}
          />
        ))}
      </ScrollView>
      )}

      <AddExpenseModal visible={showAdd} onClose={() => setShowAdd(false)} />
      {payingExpense && <ExpensePaymentModal expense={payingExpense} onClose={() => setPayingExpense(null)} />}
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
  const swipeRef = useRef<SwipeableMethods | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 120, friction: 14, useNativeDriver: true }),
    ]).start();
  }, []);

  function renderRightActions() {
    return (
      <Pressable
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          swipeRef.current?.close();
          onDelete();
        }}
        style={styles.swipeDelete}
      >
        <Feather name="trash-2" size={20} color="#fff" />
        <Text style={styles.swipeDeleteLabel}>Delete</Text>
      </Pressable>
    );
  }

  const suffix =
    expense.dueDate === 1
      ? "st"
      : expense.dueDate === 2
      ? "nd"
      : expense.dueDate === 3
      ? "rd"
      : "th";

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} friction={2} overshootRight={false} rightThreshold={60}>
    <View style={[styles.expCard, { backgroundColor: colors.card }]}>
      <View style={[styles.expIconWrap, { backgroundColor: expense.color + "20" }]}>
        <Feather name={expense.iconName as any} size={20} color={expense.color} />
      </View>
      <View style={styles.expInfo}>
        <Text style={[styles.expName, { color: colors.foreground }]} numberOfLines={1}>
          {expense.name}
        </Text>
        <Text style={[styles.expMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {expense.category} · Due {expense.dueDate}{suffix}
        </Text>
        {expense.recurrence && expense.recurrence !== "none" ? (
          <Text style={[styles.expMeta, { color: colors.mutedForeground }]} numberOfLines={2} testID={`legacy-recurrence-${expense.id}`}>
            Older {expense.recurrence} flag kept as is. No schedule is inferred; add it in Recurring to track due dates.
          </Text>
        ) : null}
      </View>
      <View style={styles.expRight}>
        <Text style={[styles.expAmount, { color: expense.isPaid ? colors.mutedForeground : colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
          {fmt(expense.amount, currency)}
        </Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onToggle();
          }}
          accessibilityRole="button"
          accessibilityLabel={expense.isPaid ? `Mark ${expense.name} as due` : `Mark ${expense.name} as paid`}
          hitSlop={8}
          style={[
            styles.statusBtn,
            { backgroundColor: expense.isPaid ? colors.successLight : colors.muted },
          ]}
        >
          <Text
            style={[
              styles.statusBtnText,
              { color: expense.isPaid ? colors.success : colors.foreground },
            ]}
          >
            {expense.isPaid ? "Paid" : "Mark paid"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
    </Swipeable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  catChipText: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_500Medium" },
  summaryBlock: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
  summaryLabel: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_500Medium" },
  summaryTotal: { fontSize: TYPOGRAPHY.heroValue, lineHeight: 40, fontFamily: "Inter_700Bold", fontVariant: ["tabular-nums"], letterSpacing: -0.6, marginTop: 4 },
  expCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  expIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  expInfo: { flex: 1, minWidth: 0 },
  expName: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_600SemiBold" },
  expMeta: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", marginTop: 3 },
  expRight: { alignItems: "flex-end", gap: 6, maxWidth: "45%" },
  expAmount: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_600SemiBold", fontVariant: ["tabular-nums"] },
  statusBtn: {
    minHeight: 28,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBtnText: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 2,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 56,
    gap: 14,
  },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_400Regular" },
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
  modalTitle: { fontSize: TYPOGRAPHY.dialogTitle, fontFamily: "Inter_700Bold", marginBottom: 20 },
  fieldLabel: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_500Medium", marginBottom: 8 },
  input: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "transparent",
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
  btnText: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_600SemiBold" },
  recurringHint: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, marginBottom: 18 },
  recurringHintText: { flex: 1, fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_500Medium" },
  swipeDelete: {
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    borderRadius: 16,
    marginLeft: 8,
    gap: 4,
  },
  swipeDeleteLabel: {
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
    fontSize: TYPOGRAPHY.supporting,
  },
});
