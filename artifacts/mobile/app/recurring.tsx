import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaymentAccountPicker } from "@/components/PaymentAccountPicker";
import { HeaderAction, ScreenHeader } from "@/components/ScreenHeader";
import {
  Button, Chips, EmptyBlock, Field, FormModal, Input, ToggleRow,
  money, parseMoney, shortDate, ui, usePlanning,
} from "@/components/PlanningUI";
import { defaultCategories } from "@/finance/budgets";
import { localDate, newId, validLocalDate } from "@/finance/ledger";
import type { RecurringExpense, RecurringFrequency } from "@/finance/planningTypes";
import { useColors } from "@/hooks/useColors";

const FREQS: { key: RecurringFrequency; label: string }[] = [
  { key: "daily", label: "Daily" }, { key: "weekly", label: "Weekly" }, { key: "monthly", label: "Monthly" },
  { key: "bimonthly", label: "Every 2 months" }, { key: "quarterly", label: "Quarterly" },
  { key: "semiannual", label: "Every 6 months" }, { key: "annual", label: "Annually" }, { key: "custom", label: "Custom" },
];
const UNITS: { key: "day" | "week" | "month"; label: string }[] = [{ key: "day", label: "Days" }, { key: "week", label: "Weeks" }, { key: "month", label: "Months" }];

function freqLabel(r: RecurringExpense): string {
  if (r.frequency === "custom") return `Every ${r.interval ?? 1} ${r.intervalUnit ?? "month"}${(r.interval ?? 1) === 1 ? "" : "s"}`;
  return FREQS.find(f => f.key === r.frequency)?.label ?? r.frequency;
}

function confirm(title: string, msg: string, action: string, run: () => void, destructive = false) {
  if (Platform.OS === "web") { if (typeof window !== "undefined" && window.confirm(`${title}\n${msg}`)) run(); return; }
  Alert.alert(title, msg, [{ text: "Cancel", style: "cancel" }, { text: action, style: destructive ? "destructive" : "default", onPress: run }]);
}

export default function RecurringScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const finance = usePlanning();
  const params = useLocalSearchParams<{ new?: string; id?: string; detailId?: string }>();
  const isWeb = Platform.OS === "web";
  const topInset = isWeb ? 67 : insets.top;
  const bottomInset = isWeb ? 34 : insets.bottom;
  const [form, setForm] = useState<{ id?: string } | null>(params.new ? {} : params.id ? { id: params.id } : null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const all = useMemo(() => (finance.planning?.recurring ?? []).filter(r => !r.deleted), [finance.planning]);
  useEffect(() => {
    if (!params.detailId || !finance.isReady) return;
    if (all.some(r => r.id === params.detailId)) setDetailId(params.detailId);
    router.setParams({ detailId: undefined });
  }, [params.detailId, all, finance.isReady, router]);
  const nextDue = (r: RecurringExpense) => (finance.planning?.occurrences ?? [])
    .filter(o => o.recurringId === r.id && o.status === "pending")
    .reduce((earliest, o) => o.dueDate < earliest ? o.dueDate : earliest, r.nextDueDate);
  const active = all.filter(r => r.active).sort((a, b) => nextDue(a).localeCompare(nextDue(b)));
  const paused = all.filter(r => !r.active);
  const detail = detailId ? all.find(r => r.id === detailId) ?? null : null;
  const acctName = (id?: string) => (id ? finance.accounts.find(a => a.id === id)?.name ?? "Removed account" : "Unassigned");

  const row = (r: RecurringExpense, i: number) => (
    <View key={r.id}>
      {i > 0 ? <View style={[ui.sep, { backgroundColor: colors.border }]} /> : null}
      <Pressable testID={`recurring-${r.id}`} onPress={() => setDetailId(r.id)} style={({ pressed }) => [ui.row, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={[ui.icon, { backgroundColor: r.color + "1F" }]}><Feather name={r.iconName as never} size={16} color={r.color} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[ui.bodyStrong, { color: colors.foreground }]} numberOfLines={1}>{r.name}</Text>
          <Text style={[ui.small, { color: colors.mutedForeground }]} numberOfLines={1}>
            {freqLabel(r)} · {r.active ? `Next ${shortDate(nextDue(r))}` : "Paused"} · {acctName(r.accountId)}
          </Text>
        </View>
        <Text style={[ui.bodyStrong, ui.num, { color: colors.foreground }]}>{money(r.amount, r.currency)}</Text>
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Recurring" subtitle="Schedules. Nothing is paid until you confirm." topInset={topInset} colors={colors}
        leading={<HeaderAction icon="arrow-left" label="Go back" variant="neutral" testID="back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
        trailing={<HeaderAction icon="plus" label="Add recurring expense" testID="add-recurring" onPress={() => setForm({})} />} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 32 }}>
        <Pressable testID="open-upcoming" onPress={() => router.push("/upcoming")} style={[ui.between, { paddingVertical: 4 }]}>
          <Text style={[ui.small, { color: colors.mutedForeground }]}>Pay or skip due items from Upcoming.</Text>
          <Text style={[ui.link, { color: colors.primary }]}>Upcoming</Text>
        </Pressable>
        {error ? <Text style={[ui.small, { color: colors.destructive, marginTop: 8 }]}>{error}</Text> : null}
        {all.length === 0 ? (
          <EmptyBlock icon="repeat" title="No recurring expenses" body="Add rent, bills and subscriptions once. They appear in Upcoming when due and only affect balances when you confirm payment.">
            <Button label="Add recurring expense" onPress={() => setForm({})} testID="empty-add-recurring" />
          </EmptyBlock>
        ) : (
          <>
            <Text style={[ui.section, { color: colors.foreground }]}>Active · {active.length}</Text>
            {active.length ? active.map(row) : <Text style={[ui.small, { color: colors.mutedForeground }]}>No active schedules.</Text>}
            {paused.length ? <>
              <Text style={[ui.section, { color: colors.foreground }]}>Paused · {paused.length}</Text>
              {paused.map(row)}
            </> : null}
          </>
        )}
      </ScrollView>

      {detail ? (
        <FormModal title={detail.name} topInset={topInset} bottomInset={bottomInset} onClose={() => setDetailId(null)} testID="recurring-detail">
          <Text style={[ui.hero, { color: colors.foreground }]}>{money(detail.amount, detail.currency)}</Text>
          <Text style={[ui.small, { color: colors.mutedForeground, marginTop: 4 }]}>{freqLabel(detail)} · {detail.category} · {acctName(detail.accountId)}</Text>
          <View style={[ui.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
            {([["Status", detail.active ? "Active" : "Paused"], ["Next due", detail.active ? shortDate(nextDue(detail)) : "—"],
              ["Started", shortDate(detail.startDate)], ["Ends", detail.endDate ? shortDate(detail.endDate) : "No end date"],
              ["Reminder", detail.reminder ? "On" : "Off"], ["Auto-create pending", detail.autoGenerate ? "On" : "Off"],
              ...(detail.notes ? [["Notes", detail.notes]] : [])] as [string, string][]).map(([k, v]) => (
              <View key={k} style={[ui.between, { paddingVertical: 5 }]}>
                <Text style={[ui.body, { color: colors.mutedForeground }]}>{k}</Text>
                <Text style={[ui.body, { color: colors.foreground, flexShrink: 1, textAlign: "right" }]}>{v}</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
            <Button label="Edit" style={{ flex: 1 }} testID="recurring-edit" onPress={() => { setDetailId(null); setForm({ id: detail.id }); }} />
            <Button label={detail.active ? "Pause" : "Resume"} tone="neutral" style={{ flex: 1 }} testID="recurring-toggle-active"
              onPress={() => { if (!finance.setRecurringActive(detail.id, !detail.active)) setError("Status could not be changed."); }} />
          </View>
          <Button label="Archive" tone="danger" style={{ marginTop: 10 }} testID="recurring-archive"
            onPress={() => confirm("Archive schedule?", "No new occurrences will be created. Paid history and transactions are kept.", "Archive", () => {
              if (finance.deleteRecurring(detail.id)) setDetailId(null); else setError("This schedule could not be archived.");
            }, true)} />
          <Text style={[ui.section, { color: colors.foreground }]}>History</Text>
          <History id={detail.id} />
        </FormModal>
      ) : null}

      {form ? (
        <RecurringForm key={form.id ?? "new"} editing={form.id ? all.find(r => r.id === form.id) ?? null : null}
          topInset={topInset} bottomInset={bottomInset} onClose={() => setForm(null)} />
      ) : null}
    </View>
  );
}

function History({ id }: { id: string }) {
  const colors = useColors();
  const router = useRouter();
  const finance = usePlanning();
  const items = (finance.planning?.occurrences ?? []).filter(o => o.recurringId === id).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  if (!items.length) return <Text style={[ui.small, { color: colors.mutedForeground }]}>No occurrences yet.</Text>;
  return (
    <View>
      {items.map((o, i) => {
        const tone = o.status === "paid" ? colors.success : o.status === "skipped" ? colors.mutedForeground : colors.warning;
        return (
          <View key={o.id}>
            {i > 0 ? <View style={[ui.sep, { backgroundColor: colors.border }]} /> : null}
            <View style={[ui.between, { paddingVertical: 10 }]} testID={`occurrence-${o.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={[ui.body, { color: colors.foreground }]}>{shortDate(o.dueDate)}</Text>
                <Text style={[ui.small, { color: tone }]}>{o.status === "paid" ? "Paid" : o.status === "skipped" ? `Skipped${o.skipReason ? ` · ${o.skipReason}` : ""}` : "Pending"}</Text>
              </View>
              <Text style={[ui.body, ui.num, { color: colors.foreground }]}>{money(o.amount, o.currency)}</Text>
              {o.status === "paid" && o.expenseId ? (
                <Pressable hitSlop={8} accessibilityLabel="Open in Transactions" testID={`occurrence-tx-${o.id}`} onPress={() => router.push("/transactions")}>
                  <Feather name="external-link" size={15} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function RecurringForm({ editing, topInset, bottomInset, onClose }: {
  editing: RecurringExpense | null; topInset: number; bottomInset: number; onClose: () => void;
}) {
  const colors = useColors();
  const finance = usePlanning();
  const formId = useRef(editing?.id ?? newId()).current;
  const saving = useRef(false);
  const presets = useMemo(() => {
    const merged = new Map(defaultCategories().map(c => [c.id, c]));
    const plan = finance.planning?.plans.find(p => p.currency === (editing?.currency ?? finance.currency));
    plan?.categories.forEach(c => merged.set(c.id, c));
    return [...merged.values()];
  }, [finance.planning, finance.currency, editing?.currency]);
  const today = localDate();
  const [name, setName] = useState(editing?.name ?? "");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [category, setCategory] = useState(editing?.category ?? "Utilities");
  const [accountId, setAccountId] = useState<string | undefined>(editing?.accountId);
  const [frequency, setFrequency] = useState<RecurringFrequency>(editing?.frequency ?? "monthly");
  const [interval, setIntervalText] = useState(String(editing?.interval ?? 2));
  const [unit, setUnit] = useState<"day" | "week" | "month">(editing?.intervalUnit ?? "week");
  const [startDate, setStartDate] = useState(editing?.startDate ?? today);
  const [endDate, setEndDate] = useState(editing?.endDate ?? "");
  const [reminder, setReminder] = useState(editing?.reminder ?? true);
  const [activeFlag, setActiveFlag] = useState(editing?.active ?? true);
  const [autoGenerate, setAutoGenerate] = useState(editing?.autoGenerate ?? true);
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [scope, setScope] = useState<"future" | "pending">("future");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const currency = editing?.currency ?? finance.currency;
  const cat = presets.find(c => c.name === category);

  const save = () => {
    if (saving.current) return;
    const e: Record<string, string> = {};
    const value = parseMoney(amount);
    if (!name.trim()) e.name = "Add a name.";
    if (value === null) e.amount = "Enter a positive amount with up to two decimals.";
    if (!validLocalDate(startDate)) e.start = "Use YYYY-MM-DD.";
    if (endDate && (!validLocalDate(endDate) || endDate < startDate)) e.end = "End date must be a valid date on or after the start.";
    const n = Number(interval);
    if (frequency === "custom" && (!Number.isInteger(n) || n < 1 || n > 365)) e.interval = "Use a whole number from 1 to 365.";
    setErrors(e);
    if (Object.keys(e).length) return;
    const input: RecurringExpense = {
      id: formId, name: name.trim(), amount: value!, currency, category,
      iconName: editing?.category === category ? editing.iconName : cat?.icon ?? "repeat",
      color: editing?.category === category ? editing.color : cat?.color ?? colors.primary,
      accountId, frequency, ...(frequency === "custom" ? { interval: n, intervalUnit: unit } : {}),
      startDate, nextDueDate: editing ? editing.nextDueDate : startDate, endDate: endDate || undefined,
      active: activeFlag, reminder, autoGenerate, notes: notes.trim() || undefined,
    };
    saving.current = true;
    if (finance.saveRecurring(input, editing ? scope : "future")) onClose();
    else { saving.current = false; setFormError(finance.storageError ?? "This schedule could not be saved. Check the details and try again."); }
  };

  return (
    <FormModal title={editing ? "Edit recurring" : "New recurring expense"} topInset={topInset} bottomInset={bottomInset} onClose={onClose} testID="recurring-form"
      footer={<>
        {formError ? <Text style={[ui.small, { color: colors.destructive, marginTop: 16 }]}>{formError}</Text> : null}
        <Button label={editing ? "Save changes" : "Add schedule"} onPress={save} testID="recurring-form-save" style={{ marginTop: 20 }} />
      </>}>
      <Field label="Name" error={errors.name}><Input testID="rec-name" value={name} onChangeText={setName} placeholder="Rent, internet, gym" /></Field>
      <Field label={`Amount (${currency})`} error={errors.amount}><Input testID="rec-amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" /></Field>
      <Field label="Category">
        <Chips items={presets.map(c => ({ key: c.name, label: c.name }))} value={category} onChange={setCategory} prefix="rec-category" />
      </Field>
      <View style={{ marginTop: 16 }}><PaymentAccountPicker value={accountId} onChange={setAccountId} currency={currency} /></View>
      <Field label="Frequency" hint="Monthly dates on the 29th–31st fall back to the last day of shorter months.">
        <Chips items={FREQS} value={frequency} onChange={setFrequency} prefix="rec-freq" />
      </Field>
      {frequency === "custom" ? (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
          <View style={{ width: 90 }}><Field label="Every" error={errors.interval}><Input testID="rec-interval" value={interval} onChangeText={setIntervalText} keyboardType="number-pad" /></Field></View>
          <View style={{ flex: 1 }}><Chips items={UNITS} value={unit} onChange={setUnit} prefix="rec-unit" /></View>
        </View>
      ) : null}
      <Field label="Start date" error={errors.start} hint={editing ? undefined : "The first payment is due on this date."}>
        <Input testID="rec-start" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" maxLength={10} autoCapitalize="none" />
      </Field>
      {editing ? (
        <Field label="Next due date" hint="Calculated, not editable. After saving, the next due date is the first scheduled date after today, based on the start date and frequency. Change the start date to move the schedule.">
          <Text testID="rec-next" style={[ui.bodyStrong, { color: colors.foreground }]}>Currently {shortDate(editing.nextDueDate)}</Text>
        </Field>
      ) : null}
      <Field label="End date (optional)" error={errors.end}>
        <Input testID="rec-end" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" maxLength={10} autoCapitalize="none" />
      </Field>
      <View style={{ marginTop: 12 }}>
        <ToggleRow label="Active" hint="Paused schedules stop creating occurrences." value={activeFlag} onChange={setActiveFlag} testID="rec-active" />
        <ToggleRow label="Reminder" value={reminder} onChange={setReminder} testID="rec-reminder" />
        <ToggleRow label="Auto-create pending item" hint="Creates a pending occurrence when due. It never pays or changes a balance." value={autoGenerate} onChange={setAutoGenerate} testID="rec-auto" />
      </View>
      <Field label="Notes (optional)"><Input testID="rec-notes" value={notes} onChangeText={setNotes} multiline style={{ minHeight: 70, textAlignVertical: "top" }} /></Field>
      {editing ? (
        <Field label="Apply changes to" hint="Paid history is never rewritten.">
          <Chips items={[{ key: "future", label: "Future only" }, { key: "pending", label: "Pending and future" }]} value={scope} onChange={setScope} prefix="rec-scope" />
        </Field>
      ) : null}
    </FormModal>
  );
}
