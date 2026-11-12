import { Feather } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { financialAlert as Alert } from "@/utils/financialAlert";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { HeaderAction, ScreenHeader } from "@/components/ScreenHeader";
import { TYPOGRAPHY } from "@/constants/typography";
import { useFinance } from "@/context/FinanceContext";
import { selectAnalyticsTransactions } from "@/finance/analytics";
import type { AnalyticsDrill } from "@/finance/analyticsTypes";
import { analyticsCurrencies } from "@/finance/netWorth";
import {
  cashFlow,
  getTransactionsByDateRange,
  localDate,
  monthRange,
  newId,
  validLocalDate,
  type Transaction,
} from "@/finance/ledger";
import { useColors } from "@/hooks/useColors";
import { formatAppCurrency, formatAppDate, formatAppNumber, normalizeLocalizedNumberInput } from "@/i18n/localization";
import { usePreferences } from "@/context/PreferencesContext";

type Colors = ReturnType<typeof useColors>;
type TypeFilter = "all" | "income" | "expenses" | "transfers" | "repayments";
type RangeFilter = "this" | "previous" | "last3" | "custom";
type FormKind = "expense" | "income" | "transfer";

const EXPENSE_CATEGORIES = ["Housing", "Bills", "Entertainment", "Health", "Transport", "Food", "Other"];
const INCOME_CATEGORIES = ["Salary", "Freelance", "Other"];
const REPAYMENT_TYPES = ["emi_payment", "balloon_payment", "loan_repayment", "loan_received"];
const UNASSIGNED = "";

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "income", label: "Income" },
  { key: "expenses", label: "Expenses" },
  { key: "transfers", label: "Transfers" },
  { key: "repayments", label: "Repayments" },
];
const RANGE_FILTERS: { key: RangeFilter; label: string }[] = [
  { key: "this", label: "This month" },
  { key: "previous", label: "Previous month" },
  { key: "last3", label: "Last 3 months" },
  { key: "custom", label: "Custom" },
];

const TYPE_LABELS: Record<string, string> = {
  income: "Income", expense: "Expense", emi_payment: "EMI payment", balloon_payment: "Balloon payment",
  loan_repayment: "Loan repayment", loan_received: "Loan received", transfer: "Transfer",
  savings_contribution: "Savings contribution", refund: "Refund", adjustment: "Reconciliation",
};

function money(value: number, currency: string): string {
  return formatAppCurrency(value, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value: string): string {
  if (!validLocalDate(value)) return value;
  return formatAppDate(value, { day: "numeric", month: "short", year: "numeric" });
}

function parseAmount(text: string): number | null {
  const t = normalizeLocalizedNumberInput(text.trim());
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && Number.isFinite(n) ? n : null;
}

function parseSigned(text: string): number | null {
  const t = normalizeLocalizedNumberInput(text.trim());
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function matchesType(t: Transaction, f: TypeFilter): boolean {
  switch (f) {
    case "income": return t.type === "income" || t.type === "refund";
    case "expenses": return t.type === "expense" || t.type === "savings_contribution";
    case "transfers": return t.type === "transfer";
    case "repayments": return REPAYMENT_TYPES.includes(t.type);
    default: return true;
  }
}

export default function TransactionsScreen() {
  const colors = useColors();
  const { t, isRTL } = usePreferences();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const finance = useFinance();
  const { transactions, accounts } = finance;
  const params = useLocalSearchParams<{ currency?: string; from?: string; to?: string; analytics?: string; categoryKey?: string; sourceKey?: string; includeDebt?: string; includeSavings?: string }>();
  const [currency, setReportCurrency] = useState(params.currency ?? finance.currency);
  const [reportDrill, setReportDrill] = useState<AnalyticsDrill | null>(
    params.analytics === "income" || params.analytics === "expenses" || params.analytics === "movements"
      ? { type: params.analytics, categoryKey: params.categoryKey, sourceKey: params.sourceKey } : null);
  const isWeb = Platform.OS === "web";
  const topInset = isWeb ? 67 : insets.top;
  const bottomInset = isWeb ? 34 : insets.bottom;

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [range, setRange] = useState<RangeFilter>(params.from || params.to ? "custom" : "this");
  const [customFrom, setCustomFrom] = useState(params.from ?? monthRange(0).from);
  const [customTo, setCustomTo] = useState(params.to ?? localDate());
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<{ mode: "add" } | { mode: "edit"; id: string } | null>(null);
  const [reconcileOpen, setReconcileOpen] = useState(false);

  const currencyTx = useMemo(() => transactions.filter(t => t.currency === currency), [transactions, currency]);
  const accountName = (id?: string) => (id ? accounts.find(a => a.id === id)?.name ?? t("Removed account") : t("Unassigned"));


  const rangeResult = useMemo((): { from: string; to: string } | { error: string } => {
    if (range === "this") return monthRange(0);
    if (range === "previous") return monthRange(-1);
    if (range === "last3") return { from: monthRange(-2).from, to: monthRange(0).to };
     if (!validLocalDate(customFrom) || !validLocalDate(customTo)) return { error: "Enter dates as YYYY-MM-DD." };
     if (customFrom > customTo) return { error: "Start date must be on or before end date." };
    return { from: customFrom, to: customTo };
  }, [range, customFrom, customTo]);

  const visible = useMemo(() => {
    if ("error" in rangeResult) return [];
    const q = query.trim().toLowerCase();
    const source = reportDrill ? selectAnalyticsTransactions(finance, { ...rangeResult, currency,
      includeDebt: params.includeDebt !== "0", includeSavings: params.includeSavings === "1" }, reportDrill)
      : getTransactionsByDateRange(currencyTx, rangeResult.from, rangeResult.to);
    return source
      .filter(t => matchesType(t, typeFilter))
      .filter(t => !q || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
      .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
  }, [currencyTx, rangeResult, query, typeFilter, reportDrill, finance, currency, params.includeDebt, params.includeSavings]);
  const summary = useMemo(() => cashFlow(visible, currency), [visible, currency]);

  const selected = selectedId ? transactions.find(t => t.id === selectedId) ?? null : null;

  const header = (
    <View>
      {reportDrill && <View style={[styles.notice, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
        <Text style={[styles.small, { color: colors.foreground }]}>{t("Analytics details")} · {currency} · {t(reportDrill.type)}{reportDrill.categoryKey ? ` · ${t("Selected category")}` : ""}{reportDrill.sourceKey ? ` · ${t("Selected source")}` : ""}</Text>
        <Pressable accessibilityRole="button" onPress={() => setReportDrill(null)}><Text style={[styles.small, { color: colors.primary }]}>{t("Show all transaction types")}</Text></Pressable>
      </View>}
      {analyticsCurrencies(finance).length > 1 && <Chips items={analyticsCurrencies(finance).map(c => ({ key: c, label: c }))} value={currency} onChange={setReportCurrency} colors={colors} prefix="transactions-currency" />}
      {finance.reconciliationRequired ? (
        <View style={[styles.notice, { backgroundColor: colors.warningLight, borderColor: colors.warning }]} testID="reconcile-notice">
          <Feather name="alert-circle" size={18} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.noticeTitle, { color: colors.foreground }]}>{t("Account balances need review")}</Text>
            <Text style={[styles.small, { color: colors.mutedForeground }]}>
              {t("Some earlier records could not be matched to dated payments. Confirm each account's actual balance.")}
            </Text>
          </View>
          <Pressable testID="open-reconcile" onPress={() => setReconcileOpen(true)} style={[styles.smallBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.smallBtnText, { color: colors.primaryForeground }]}>{t("Reconcile")}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]} testID="month-summary">
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{t("error" in rangeResult ? "Selected period" : `${rangeResult.from} – ${rangeResult.to}`)} · {currency}</Text>
        <View style={styles.summaryRow}>
          <SummaryItem label="Money in" value={money(summary.moneyIn, currency)} color={colors.success} colors={colors} />
          <SummaryItem label="Money out" value={money(summary.moneyOut, currency)} color={colors.destructive} colors={colors} />
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.between}>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>{t("Net cash flow")}</Text>
          <Text style={[styles.netValue, { color: summary.net < 0 ? colors.destructive : colors.foreground }]}>
            {summary.net < 0 ? "-" : ""}{money(Math.abs(summary.net), currency)}
          </Text>
        </View>
      </View>
      {!finance.reconciliationRequired && accounts.length > 0 && <Pressable testID="review-balances" onPress={() => setReconcileOpen(true)} style={{ paddingVertical: 10 }}>
        <Text style={[styles.small, { color: colors.primary }]}>{t("Review account balances")}</Text>
      </Pressable>}

      <View style={[styles.search, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          testID="search-input"
          value={query}
          onChangeText={setQuery}
          placeholder={t("Search description or category")}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel={t("Clear search")}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      <Chips items={TYPE_FILTERS} value={typeFilter} onChange={setTypeFilter} colors={colors} prefix="type" />
      <Chips items={RANGE_FILTERS} value={range} onChange={setRange} colors={colors} prefix="range" />

      {range === "custom" ? (
        <View style={styles.customRow}>
          <DateField label="From" value={customFrom} onChange={setCustomFrom} colors={colors} testID="custom-from" />
          <DateField label="To" value={customTo} onChange={setCustomTo} colors={colors} testID="custom-to" />
        </View>
      ) : null}
      {"error" in rangeResult ? (
        <Text style={[styles.small, { color: colors.destructive, marginTop: 8 }]}>{t(rangeResult.error)}</Text>
      ) : null}
        <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 18, marginBottom: 8 }]}>
        {t("{count} transactions", { count: formatAppNumber(visible.length) })}
      </Text>
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={t("Transactions")}
        subtitle={t("Actual money movements in {currency}", { currency })}
        topInset={topInset}
        colors={colors}
        leading={<HeaderAction icon={isRTL ? "arrow-right" : "arrow-left"} label={t("Go back")} variant="neutral" testID="back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
        trailing={<HeaderAction icon="plus" label={t("Add transaction")} testID="add-transaction" onPress={() => setForm({ mode: "add" })} />}
      />
      <FlatList
        data={visible}
        keyExtractor={t => t.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 32 }}
        ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 0 }]} />}
        ListEmptyComponent={
          <View style={[styles.empty, { borderColor: colors.border }]} testID="empty-state">
            <Feather name="list" size={22} color={colors.mutedForeground} />
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>
              {t(transactions.length === 0 ? "No transactions yet" : "Nothing matches these filters")}
            </Text>
            <Text style={[styles.small, { color: colors.mutedForeground, textAlign: "center" }]}>
              {transactions.length === 0
                ? t("Paid expenses, received income, EMI and loan payments, and transfers will appear here.")
                : t("Try another period, type or search term.")}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Row t={item} accountName={accountName(item.accountId)} colors={colors} onPress={() => setSelectedId(item.id)} />
        )}
      />

      {selected ? (
        <DetailSheet
          t={selected}
          pairAccount={selected.transferGroupId ? accountName(transactions.find(x => x.transferGroupId === selected.transferGroupId && x.id !== selected.id)?.accountId) : undefined}
          accountName={accountName(selected.accountId)}
          colors={colors}
          bottomInset={bottomInset}
          onClose={() => setSelectedId(null)}
          onEdit={() => { setSelectedId(null); setForm({ mode: "edit", id: selected.id }); }}
          onDelete={() => {
            const balanceImpact = selected.accountId
              ? "This removes the FinanceApp record and recalculates the tracked account balance; it does not change your actual bank account."
              : "This removes an unassigned FinanceApp record and does not change any account balance.";
            const linked = selected.transferGroupId
              ? "Both sides of this transfer will be removed."
              : selected.referenceType
                ? "Its linked payment history will also be updated."
                : "The original transaction record will be removed.";
            const run = () => { if (finance.deleteTransaction(selected.id)) setSelectedId(null); };
            if (Platform.OS === "web") {
              if (typeof window !== "undefined" && window.confirm(`${t("Reverse this recorded transaction?")}\n\n${t(balanceImpact)} ${t(linked)}`)) run();
            } else {
              Alert.alert(t("Reverse recorded transaction?"), `${t(balanceImpact)} ${t(linked)}`, [
                { text: t("Cancel"), style: "cancel" },
                { text: t("Reverse transaction"), style: "destructive", onPress: run },
              ]);
            }
          }}
        />
      ) : null}

      {form ? (
        <TransactionForm
          key={form.mode === "edit" ? form.id : "add"}
          editing={form.mode === "edit" ? transactions.find(t => t.id === form.id) ?? null : null}
          initialCurrency={currency}
          colors={colors}
          topInset={topInset}
          bottomInset={bottomInset}
          onClose={() => setForm(null)}
        />
      ) : null}

      {reconcileOpen ? (
        <ReconcileForm colors={colors} topInset={topInset} bottomInset={bottomInset} onClose={() => setReconcileOpen(false)} />
      ) : null}
    </View>
  );
}

function SummaryItem({ label, value, color, colors }: { label: string; value: string; color: string; colors: Colors }) {
  const { t } = usePreferences();
  return (
    <View style={styles.flex}>
      <View style={styles.inline}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.small, { color: colors.mutedForeground }]}>{t(label)}</Text>
      </View>
      <Text style={[styles.summaryValue, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function Chips<T extends string>({ items, value, onChange, colors, prefix }: {
  items: { key: T; label: string }[]; value: T; onChange: (v: T) => void; colors: Colors; prefix: string;
}) {
  const { t } = usePreferences();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {items.map(i => {
        const active = i.key === value;
        return (
          <Pressable
            key={i.key}
            testID={`${prefix}-filter-${i.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(i.key)}
            style={[styles.chip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
          >
            <Text style={[styles.chipText, { color: active ? colors.primaryForeground : colors.foreground }]}>{t(i.label)}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Row({ t, accountName, colors, onPress }: { t: Transaction; accountName: string; colors: Colors; onPress: () => void }) {
  const { t: translate } = usePreferences();
  const incoming = t.direction === "in";
  const tone = t.type === "transfer" || t.type === "adjustment" ? colors.mutedForeground : incoming ? colors.success : colors.destructive;
  const icon = t.type === "transfer" ? "repeat" : incoming ? "arrow-down-left" : "arrow-up-right";
  return (
    <Pressable testID={`transaction-${t.id}`} onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.rowIcon, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={16} color={tone} />
      </View>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.foreground }]}>{t.description}</Text>
        <Text numberOfLines={1} style={[styles.small, { color: colors.mutedForeground }]}>
          {formatDate(t.date)} · {translate(t.category)} · {accountName}
        </Text>
      </View>
      <Text style={[styles.rowAmount, { color: tone }]}>
        {incoming ? "+" : "-"}{money(t.amount, t.currency)}
      </Text>
    </Pressable>
  );
}

function Sheet({ children, onClose, colors, bottomInset, title, testID }: {
  children: React.ReactNode; onClose: () => void; colors: Colors; bottomInset: number; title: string; testID: string;
}) {
  const { t } = usePreferences();
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
         <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t("Close")} />
        <View testID={testID} style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: bottomInset + 16 }]}>
          <View style={styles.between}>
            <Text style={[styles.dialogTitle, { color: colors.foreground }]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t("Close")} testID={`${testID}-close`}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

function DetailSheet({ t, accountName, pairAccount, colors, bottomInset, onClose, onEdit, onDelete }: {
  t: Transaction; accountName: string; pairAccount?: string; colors: Colors; bottomInset: number;
  onClose: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const { t: translate } = usePreferences();
  const isTransfer = t.type === "transfer";
  const rows: [string, string][] = [
     ["Type", translate(TYPE_LABELS[t.type] ?? t.type)],
     ["Direction", translate(t.direction === "in" ? "Money in" : "Money out")],
    ["Date", formatDate(t.date)],
    ["Category", t.category],
     [isTransfer ? (t.direction === "out" ? "From account" : "To account") : "Account", accountName],
  ];
  if (isTransfer && pairAccount) rows.push([t.direction === "out" ? "To account" : "From account", pairAccount]);
  if (t.notes) rows.push(["Notes", t.notes]);
  return (
    <Sheet onClose={onClose} colors={colors} bottomInset={bottomInset} title={translate("Transaction")} testID="transaction-detail">
      <Text style={[styles.cardTitle, { color: colors.foreground, marginTop: 12 }]}>{t.description}</Text>
      <Text style={[styles.detailAmount, { color: t.direction === "in" ? colors.success : colors.foreground }]}>
        {t.direction === "in" ? "+" : "-"}{money(t.amount, t.currency)}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: 0 }]}>
        {rows.map(([k, v]) => (
          <View key={k} style={[styles.between, { paddingVertical: 6 }]}>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>{translate(k)}</Text>
            <Text style={[styles.body, { color: colors.foreground, flexShrink: 1, textAlign: "auto", marginStart: 12 }]}>{v}</Text>
          </View>
        ))}
      </View>
      {!t.accountId ? (
        <Text style={[styles.small, { color: colors.mutedForeground, marginTop: 10 }]}>{translate("Unassigned: this does not change any account balance.")}</Text>
      ) : null}
      {isTransfer ? (
        <Text style={[styles.small, { color: colors.mutedForeground, marginTop: 10 }]}>{translate("Part of a paired transfer. Edits to amount, date and notes apply to both sides; deleting removes both.")}</Text>
      ) : t.referenceType ? (
        <Text style={[styles.small, { color: colors.mutedForeground, marginTop: 10 }]}>{translate("Linked to a {type} record, which is kept in sync.", { type: translate(t.referenceType.replace("_", " ")) })}</Text>
      ) : null}
      <View style={[styles.customRow, { marginTop: 18 }]}>
        <Pressable testID="delete-transaction" onPress={onDelete} style={[styles.btn, styles.flex, { backgroundColor: colors.errorLight }]}>
          <Text style={[styles.btnText, { color: colors.destructive }]}>{translate("Delete")}</Text>
        </Pressable>
        {t.type !== "adjustment" ? (
          <Pressable testID="edit-transaction" onPress={onEdit} style={[styles.btn, styles.flex, { backgroundColor: colors.primary }]}>
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>{translate("Edit")}</Text>
          </Pressable>
        ) : null}
      </View>
    </Sheet>
  );
}

function Field({ label, children, colors, hint }: { label: string; children: React.ReactNode; colors: Colors; hint?: string }) {
  const { t } = usePreferences();
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[styles.label, { color: colors.mutedForeground, marginBottom: 6 }]}>{t(label)}</Text>
      {children}
      {hint ? <Text style={[styles.small, { color: colors.mutedForeground, marginTop: 6 }]}>{t(hint)}</Text> : null}
    </View>
  );
}

function Input(props: React.ComponentProps<typeof TextInput> & { colors: Colors }) {
  const { t } = usePreferences();
  const { colors, style, ...rest } = props;
  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      {...rest}
      placeholder={rest.placeholder ? t(rest.placeholder) : undefined}
      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }, style]}
    />
  );
}

function DateField({ label, value, onChange, colors, testID }: { label: string; value: string; onChange: (v: string) => void; colors: Colors; testID: string }) {
  const { t } = usePreferences();
  return (
    <View style={styles.flex}>
      <Text style={[styles.label, { color: colors.mutedForeground, marginBottom: 6 }]}>{t(label)}</Text>
      <Input colors={colors} testID={testID} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" autoCapitalize="none" maxLength={10} />
    </View>
  );
}

function OptionList({ options, value, onChange, colors, testPrefix }: {
  options: { key: string; label: string }[]; value: string; onChange: (v: string) => void; colors: Colors; testPrefix: string;
}) {
  const { t } = usePreferences();
  return (
    <View style={styles.wrap}>
      {options.map(o => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key || "none"}
            testID={`${testPrefix}-${o.key || "unassigned"}`}
            onPress={() => onChange(o.key)}
            style={[styles.chip, { backgroundColor: active ? colors.secondary : colors.card, borderColor: active ? colors.primary : colors.border }]}
          >
            <Text style={[styles.chipText, { color: active ? colors.secondaryForeground : colors.foreground }]}>{t(o.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FormShell({ title, colors, topInset, bottomInset, onClose, onSave, saveLabel, testID, children }: {
  title: string; colors: Colors; topInset: number; bottomInset: number; onClose: () => void; onSave: () => void;
  saveLabel: string; testID: string; children: React.ReactNode;
}) {
  const { t } = usePreferences();
  return (
    <Modal visible animationType="none" onRequestClose={onClose}>
      <View style={[styles.flex, { backgroundColor: colors.background }]} testID={testID}>
        <ScreenHeader
          title={t(title)}
          topInset={topInset}
          colors={colors}
          leading={<HeaderAction icon="x" label={t("Cancel")} variant="neutral" testID={`${testID}-cancel`} onPress={onClose} />}
        />
        <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 32 }} bottomOffset={24}>
          {children}
          <Pressable testID={`${testID}-save`} onPress={onSave} style={[styles.btn, { backgroundColor: colors.primary, marginTop: 24 }]}>
            <Text style={[styles.btnText, { color: colors.primaryForeground }]}>{t(saveLabel)}</Text>
          </Pressable>
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
  );
}

function TransactionForm({ editing, initialCurrency, colors, topInset, bottomInset, onClose }: {
  editing: Transaction | null; initialCurrency: string; colors: Colors; topInset: number; bottomInset: number; onClose: () => void;
}) {
  const { t } = usePreferences();
  const finance = useFinance();
  const { accounts, transactions } = finance;
  const currency = editing?.currency ?? initialCurrency;
  const operationId = useRef(newId()).current;
  const saving = useRef(false);
  const isTransferEdit = editing?.type === "transfer";

  const [kind, setKind] = useState<FormKind>(editing ? (editing.type === "income" ? "income" : editing.type === "transfer" ? "transfer" : "expense") : "expense");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [accountId, setAccountId] = useState(editing?.accountId ?? UNASSIGNED);
  const [destinationId, setDestinationId] = useState("");
  const [date, setDate] = useState(editing?.date ?? localDate());
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const eligible = accounts.filter(a => (a.currency ?? currency) === (editing?.currency ?? currency));
  const pairAccountId = isTransferEdit ? transactions.find(x => x.transferGroupId === editing?.transferGroupId && x.id !== editing?.id)?.accountId : undefined;
  const accountOptions = [
    ...(kind === "transfer" ? [] : [{ key: UNASSIGNED, label: "Unassigned" }]),
    ...eligible.filter(a => !isTransferEdit || a.id !== pairAccountId).map(a => ({ key: a.id, label: a.name })),
  ];
  const categoryBase = kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const categories = category && !categoryBase.includes(category) ? [category, ...categoryBase] : categoryBase;
  const categoryFixed = !!editing && (editing.type === "transfer" || !!editing.referenceType && editing.referenceType !== "expense");

  const save = () => {
    if (saving.current) return;
    setError(null);
    const value = parseAmount(amount);
     if (value === null) return setError("Enter a positive amount with at most two decimals.");
     if (!validLocalDate(date)) return setError("Enter a valid date as YYYY-MM-DD.");
     if (kind !== "transfer" && !description.trim()) return setError("Add a description.");
     if (kind !== "transfer" && !category && !categoryFixed) return setError("Choose a category.");
    const cleanNotes = notes.trim() || undefined;
    saving.current = true;
    let ok = false;
    if (editing) {
       if (isTransferEdit && !accountId) { saving.current = false; return setError("Choose an account for this side of the transfer."); }
      ok = finance.updateTransaction(editing.id, {
        amount: value, date, description: description.trim() || editing.description,
        category: categoryFixed ? editing.category : category, accountId: accountId || undefined, notes: cleanNotes,
      });
    } else if (kind === "transfer") {
       if (!accountId || !destinationId) { saving.current = false; return setError("Choose a source and destination account."); }
       if (accountId === destinationId) { saving.current = false; return setError("Choose two different accounts."); }
      ok = finance.recordTransfer({ id: operationId, sourceId: accountId, destinationId, amount: value, date, description: description.trim() || undefined, notes: cleanNotes });
    } else {
      ok = finance.addTransaction({
        id: operationId, type: kind, amount: value, date, description: description.trim(), category,
        accountId: accountId || undefined, notes: cleanNotes, currency,
      });
    }
    if (ok) onClose();
     else { saving.current = false; setError(finance.storageError ?? "This change could not be saved. Check the details and try again."); }
  };

  return (
    <FormShell
      title={t(editing ? "Edit transaction" : "Add transaction")}
      colors={colors} topInset={topInset} bottomInset={bottomInset} onClose={onClose} onSave={save}
      saveLabel={t(editing ? "Save changes" : "Add transaction")} testID="transaction-form"
    >
      {!editing ? (
        <Field label="Type" colors={colors} hint="EMI and loan payments are recorded from their own screens.">
          <OptionList
            options={[{ key: "expense", label: "Expense" }, { key: "income", label: "Income" }, { key: "transfer", label: "Transfer" }]}
            value={kind}
            onChange={v => { setKind(v as FormKind); setCategory(""); if (v === "transfer" && !accountId) setAccountId(UNASSIGNED); }}
            colors={colors} testPrefix="form-type"
          />
        </Field>
      ) : (
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{t(TYPE_LABELS[editing.type] ?? editing.type)}</Text>
      )}
      <Field label={`Amount (${editing?.currency ?? currency})`} colors={colors}>
        <Input colors={colors} testID="form-amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
      </Field>
      <Field label={kind === "transfer" ? "Description (optional)" : "Description"} colors={colors}>
        <Input colors={colors} testID="form-description" value={description} onChangeText={setDescription} placeholder={kind === "transfer" ? "Account transfer" : "What was this for?"} />
      </Field>
      {kind !== "transfer" && !categoryFixed ? (
        <Field label="Category" colors={colors}>
          <OptionList options={categories.map(c => ({ key: c, label: c }))} value={category} onChange={setCategory} colors={colors} testPrefix="form-category" />
        </Field>
      ) : null}
      {eligible.length === 0 && kind === "transfer" ? (
        <Text style={[styles.small, { color: colors.destructive, marginTop: 14 }]}>{t("Add at least two {currency} accounts to record a transfer.", { currency })}</Text>
      ) : (
        <Field
          label={kind === "transfer" ? (editing ? (editing.direction === "out" ? "From account" : "To account") : "From account") : "Account"}
          colors={colors}
          hint={kind !== "transfer" && !accountId ? "Unassigned transactions count toward cash flow but do not change any account balance." : undefined}
        >
          <OptionList options={accountOptions} value={accountId} onChange={setAccountId} colors={colors} testPrefix="form-account" />
        </Field>
      )}
      {kind === "transfer" && !editing && eligible.length > 0 ? (
        <Field label="To account" colors={colors}>
          <OptionList options={eligible.filter(a => a.id !== accountId).map(a => ({ key: a.id, label: a.name }))} value={destinationId} onChange={setDestinationId} colors={colors} testPrefix="form-destination" />
        </Field>
      ) : null}
      <Field label="Date" colors={colors}>
        <Input colors={colors} testID="form-date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" maxLength={10} />
      </Field>
      <Field label="Notes (optional)" colors={colors}>
        <Input colors={colors} testID="form-notes" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 72, textAlignVertical: "top" }} />
      </Field>
       {error ? <Text testID="form-error" style={[styles.body, { color: colors.destructive, marginTop: 14 }]}>{t(error)}</Text> : null}
    </FormShell>
  );
}

function ReconcileForm({ colors, topInset, bottomInset, onClose }: { colors: Colors; topInset: number; bottomInset: number; onClose: () => void }) {
  const { t } = usePreferences();
  const finance = useFinance();
  const operationId = useRef(newId()).current;
  const saving = useRef(false);
  const [accountId, setAccountId] = useState(finance.accounts[0]?.id ?? "");
  const [actual, setActual] = useState("");
  const [date, setDate] = useState(localDate());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const account = finance.accounts.find(a => a.id === accountId);

  const save = () => {
    if (saving.current) return;
    setError(null);
    if (!account) return setError("Choose an account.");
    const value = parseSigned(actual);
    if (value === null) return setError("Enter the actual balance with at most two decimals.");
    if (!validLocalDate(date)) return setError("Enter a valid date as YYYY-MM-DD.");
    saving.current = true;
    const ok = finance.reconcileAccountBalance({ id: operationId, accountId, actualBalance: value, date, notes: notes.trim() || undefined });
    if (ok) onClose();
    else { saving.current = false; setError(finance.storageError ?? "The balance could not be reconciled."); }
  };

  return (
    <FormShell title={t("Reconcile balance")} colors={colors} topInset={topInset} bottomInset={bottomInset} onClose={onClose} onSave={save} saveLabel={t("Confirm balance")} testID="reconcile-form">
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        {t("Enter the balance shown by your bank or wallet. A reconciliation entry records the difference; opening balances and history stay unchanged.")}
      </Text>
      {finance.accounts.length === 0 ? (
        <Text style={[styles.body, { color: colors.foreground, marginTop: 14 }]}>{t("No accounts to reconcile.")}</Text>
      ) : (
        <Field label="Account" colors={colors}>
          <OptionList options={finance.accounts.map(a => ({ key: a.id, label: a.name }))} value={accountId} onChange={setAccountId} colors={colors} testPrefix="reconcile-account" />
        </Field>
      )}
      {account ? (
        <Text style={[styles.small, { color: colors.mutedForeground, marginTop: 8 }]}>
          {t("Recorded balance")}: {money(account.balance, account.currency ?? finance.currency)}
        </Text>
      ) : null}
      <Field label={`Actual balance (${account?.currency ?? finance.currency})`} colors={colors}>
        <Input colors={colors} testID="reconcile-amount" value={actual} onChangeText={setActual} keyboardType="numbers-and-punctuation" placeholder="0.00" />
      </Field>
      <Field label="As of date" colors={colors}>
        <Input colors={colors} testID="reconcile-date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" maxLength={10} />
      </Field>
      <Field label="Notes (optional)" colors={colors}>
        <Input colors={colors} testID="reconcile-notes" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 72, textAlignVertical: "top" }} />
      </Field>
      {error ? <Text testID="reconcile-error" style={[styles.body, { color: colors.destructive, marginTop: 14 }]}>{t(error)}</Text> : null}
    </FormShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 16 },
  notice: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 16 },
  noticeTitle: { fontFamily: "Inter_600SemiBold", fontSize: TYPOGRAPHY.body },
  label: { fontFamily: "Inter_500Medium", fontSize: TYPOGRAPHY.supporting, textTransform: "uppercase", letterSpacing: 0.4 },
  body: { fontFamily: "Inter_400Regular", fontSize: TYPOGRAPHY.body, lineHeight: 20 },
  small: { fontFamily: "Inter_400Regular", fontSize: TYPOGRAPHY.supporting, lineHeight: 17 },
  cardTitle: { fontFamily: "Inter_600SemiBold", fontSize: TYPOGRAPHY.cardTitle },
  dialogTitle: { fontFamily: "Inter_700Bold", fontSize: TYPOGRAPHY.dialogTitle },
  summaryRow: { flexDirection: "row", gap: 16, marginTop: 10 },
  summaryValue: { fontFamily: "Inter_600SemiBold", fontSize: TYPOGRAPHY.sectionHeading, marginTop: 4 },
  netValue: { fontFamily: "Inter_700Bold", fontSize: TYPOGRAPHY.sectionHeading },
  dot: { width: 8, height: 8, borderRadius: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: TYPOGRAPHY.body, height: 44 },
  chips: { gap: 8, paddingTop: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontFamily: "Inter_500Medium", fontSize: TYPOGRAPHY.bodySmall },
  customRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: "Inter_500Medium", fontSize: TYPOGRAPHY.body, marginBottom: 2 },
  rowAmount: { fontFamily: "Inter_600SemiBold", fontSize: TYPOGRAPHY.body },
  empty: { alignItems: "center", gap: 8, padding: 24, borderWidth: 1, borderStyle: "dashed", borderRadius: 16 },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(7,10,18,0.45)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  detailAmount: { fontFamily: "Inter_700Bold", fontSize: TYPOGRAPHY.heroValue, marginVertical: 12 },
  btn: { height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnText: { fontFamily: "Inter_600SemiBold", fontSize: TYPOGRAPHY.body },
  smallBtn: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  smallBtnText: { fontFamily: "Inter_600SemiBold", fontSize: TYPOGRAPHY.supporting },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontFamily: "Inter_400Regular", fontSize: TYPOGRAPHY.body },
});
