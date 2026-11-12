import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaymentAccountPicker } from "@/components/PaymentAccountPicker";
import { HeaderAction, ScreenHeader } from "@/components/ScreenHeader";
import {
  Button, Chips, EmptyBlock, Field, FormModal, Input, ToggleRow,
  money, parseMoney, shortDate, ui, usePlanning, type Colors,
} from "@/components/PlanningUI";
import { addDays, monthBounds } from "@/finance/calendar";
import { localDate, newId, validLocalDate } from "@/finance/ledger";
import type { UpcomingPayment, UpcomingType } from "@/finance/planningTypes";
import { useColors } from "@/hooks/useColors";
import { formatAppDate, formatAppNumber } from "@/i18n/localization";
import { usePreferences } from "@/context/PreferencesContext";

type TypeFilter = "all" | UpcomingType;
type RangeFilter = "7" | "30" | "month" | "custom";
const TYPES: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" }, { key: "expense", label: "Expenses" }, { key: "emi", label: "EMIs" },
  { key: "balloon", label: "Balloon" }, { key: "loan", label: "Loans" },
];
const RANGES: { key: RangeFilter; label: string }[] = [
  { key: "7", label: "Next 7 days" }, { key: "30", label: "Next 30 days" }, { key: "month", label: "This month" }, { key: "custom", label: "Custom" },
];
const TYPE_LABEL: Record<UpcomingType, string> = { expense: "Recurring expense", emi: "EMI", balloon: "Balloon payment", loan: "Loan repayment" };

function statusStyle(s: UpcomingPayment["status"], colors: Colors) {
  switch (s) {
    case "overdue": return { label: "Overdue", color: colors.destructive, bg: colors.errorLight };
    case "due_today": return { label: "Due today", color: colors.warning, bg: colors.warningLight };
    case "paid": return { label: "Paid", color: colors.success, bg: colors.successLight };
    case "skipped": return { label: "Skipped", color: colors.mutedForeground, bg: colors.muted };
    default: return { label: "Upcoming", color: colors.primary, bg: colors.secondary };
  }
}

export default function UpcomingScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const finance = usePlanning();
  const { t } = usePreferences();
  const isWeb = Platform.OS === "web";
  const topInset = isWeb ? 67 : insets.top;
  const bottomInset = isWeb ? 34 : insets.bottom;
  const today = localDate();
  const [type, setType] = useState<TypeFilter>("all");
  const [range, setRange] = useState<RangeFilter>("30");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 30));
  const [showOverdue, setShowOverdue] = useState(true);
  const [selected, setSelected] = useState<UpcomingPayment | null>(null);

  const bounds = useMemo((): { from: string; to: string } | { error: string } => {
    if (range === "7") return { from: today, to: addDays(today, 7) };
    if (range === "30") return { from: today, to: addDays(today, 30) };
    if (range === "month") { const b = monthBounds(today.slice(0, 7)); return { from: b.from, to: b.to }; }
    if (!validLocalDate(from) || !validLocalDate(to)) return { error: "Enter dates as YYYY-MM-DD." };
    if (from > to) return { error: "Start date must be on or before end date." };
    return { from, to };
  }, [range, from, to, today, t]);

  const { items, failed } = useMemo(() => {
    if ("error" in bounds) return { items: [] as UpcomingPayment[], failed: false };
    try {
      const start = showOverdue && bounds.from > "1970-01-01" ? "1970-01-01" : bounds.from;
      const list = finance.getUpcoming(start, bounds.to)
        .filter(i => i.dueDate >= bounds.from || (showOverdue && i.status === "overdue"))
        .filter(i => type === "all" || i.type === type)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
      return { items: list, failed: false };
    } catch { return { items: [] as UpcomingPayment[], failed: true }; }
  }, [finance, bounds, showOverdue, type]);

  const acctName = (id?: string) => (id ? finance.accounts.find(a => a.id === id)?.name ?? t("Removed account") : t("No account"));
  const overdue = items.filter(i => i.status === "overdue");
  const open = items.filter(i => i.status !== "overdue");

  const renderRow = (i: UpcomingPayment, idx: number) => {
    const s = statusStyle(i.status, colors);
    return (
      <View key={i.id}>
        {idx > 0 ? <View style={[ui.sep, { backgroundColor: colors.border }]} /> : null}
        <Pressable testID={`upcoming-${i.id}`} accessibilityRole="button" accessibilityLabel={t("{name}, {date}, {status}, {amount}", { name: i.name, date: shortDate(i.dueDate), status: t(s.label), amount: money(i.amount, i.currency) })}
          onPress={() => setSelected(i)} style={({ pressed }) => [ui.row, { opacity: pressed ? 0.7 : 1 }]}>
          <View style={{ width: 44, alignItems: "center" }}>
            <Text style={[ui.small, { color: colors.mutedForeground }]}>{formatAppDate(`${i.dueDate.slice(0, 7)}-01`, { month: "short" })}</Text>
            <Text style={[ui.cardTitle, ui.num, { color: colors.foreground }]}>{formatAppNumber(Number(i.dueDate.slice(8)))}</Text>
            {i.dueDate.slice(0, 4) !== today.slice(0, 4) ? <Text style={[ui.small, { color: colors.mutedForeground }]}>{formatAppNumber(Number(i.dueDate.slice(0, 4)))}</Text> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[ui.bodyStrong, { color: colors.foreground }]} numberOfLines={1}>{i.name}</Text>
            <Text style={[ui.small, { color: colors.mutedForeground }]} numberOfLines={1}>{t(TYPE_LABEL[i.type])} · {acctName(i.accountId)}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Text style={[ui.bodyStrong, ui.num, { color: i.status === "skipped" ? colors.mutedForeground : colors.foreground }]}>{money(i.amount, i.currency)}</Text>
            <View style={[ui.pill, { backgroundColor: s.bg }]}><Text style={[ui.pillText, { color: s.color }]}>{s.label}</Text></View>
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Upcoming" subtitle="Scheduled commitments, not transactions" topInset={topInset} colors={colors}
        leading={<HeaderAction icon="arrow-left" label="Go back" variant="neutral" testID="back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
        trailing={<HeaderAction icon="repeat" label="Manage recurring expenses" variant="neutral" testID="open-recurring" onPress={() => router.push("/recurring")} />} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 32 }} keyboardShouldPersistTaps="handled">
          <Chips items={TYPES.map(item => ({ ...item, label: t(item.label) }))} value={type} onChange={setType} prefix="upcoming-type" />
          <Chips items={RANGES.map(item => ({ ...item, label: t(item.label) }))} value={range} onChange={setRange} prefix="upcoming-range" />
        {range === "custom" ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="From"><Input testID="upcoming-from" value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" maxLength={10} autoCapitalize="none" /></Field></View>
            <View style={{ flex: 1 }}><Field label="To"><Input testID="upcoming-to" value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" maxLength={10} autoCapitalize="none" /></Field></View>
          </View>
        ) : null}
        {"error" in bounds ? <Text style={[ui.small, { color: colors.destructive, marginTop: 8 }]}>{t(bounds.error)}</Text> : null}
        <ToggleRow label="Include overdue" value={showOverdue} onChange={setShowOverdue} testID="toggle-overdue" />

        {failed ? (
          <EmptyBlock icon="alert-circle" title="Schedules unavailable" body="Upcoming payments could not be calculated right now.">
            <Button label="Retry" tone="neutral" onPress={() => setRange(r => r)} testID="upcoming-retry" />
          </EmptyBlock>
        ) : items.length === 0 ? (
          <EmptyBlock icon="calendar" title="Nothing scheduled" body="No commitments in this range. Recurring expenses, EMIs, balloon payments and loan schedules appear here.">
            <Button label="Add recurring expense" tone="neutral" onPress={() => router.push("/recurring?new=1")} testID="upcoming-add-recurring" />
          </EmptyBlock>
        ) : (
          <>
            {overdue.length ? <>
              <Text style={[ui.section, { color: colors.destructive }]}>{t("Overdue")} · {money(overdue.reduce((s, i) => s + i.amount, 0), finance.currency)}</Text>
              {overdue.map(renderRow)}
            </> : null}
            <Text style={[ui.section, { color: colors.foreground }]}>{t("Scheduled")} · {formatAppNumber(open.length)}</Text>
            {open.length ? open.map(renderRow) : <Text style={[ui.small, { color: colors.mutedForeground }]}>{t("Nothing else in this range.")}</Text>}
          </>
        )}
      </ScrollView>
      {selected ? <PaySheet item={selected} topInset={topInset} bottomInset={bottomInset} onClose={() => setSelected(null)} /> : null}
    </View>
  );
}

function PaySheet({ item, topInset, bottomInset, onClose }: { item: UpcomingPayment; topInset: number; bottomInset: number; onClose: () => void }) {
  const colors = useColors();
  const { t } = usePreferences();
  const router = useRouter();
  const finance = usePlanning();
  const lock = useRef(false);
  // One operation ID per modal lifetime: blocks double-submit; reopening allows another partial payment.
  const operationId = useRef(newId()).current;
  const [busy, setBusy] = useState(false);
  const [accountId, setAccountId] = useState<string | undefined>(item.accountId && finance.accounts.some(a => a.id === item.accountId) ? item.accountId : undefined);
  const [date, setDate] = useState(localDate());
  const [amount, setAmount] = useState(String(item.amount));
  const [error, setError] = useState<string | null>(null);
  const s = statusStyle(item.status, colors);
  const closed = item.status === "paid" || item.status === "skipped";
  const partial = item.type === "balloon" || item.type === "loan";

  const pay = () => {
    if (lock.current) return;
    setError(null);
    if (!validLocalDate(date)) return setError("Enter the payment date as YYYY-MM-DD.");
    if (date > localDate()) return setError("Payment date cannot be in the future.");
    const value = partial ? parseMoney(amount) : item.amount;
    if (value === null) return setError("Enter a positive amount with up to two decimals.");
    if (partial && value > item.amount + 0.001) return setError(t("Amount cannot exceed the remaining {amount}.", { amount: money(item.amount, item.currency) }));
    lock.current = true; setBusy(true);
    if (finance.recordScheduledPayment(item, accountId, date, partial ? value : undefined, operationId)) onClose();
    else { lock.current = false; setBusy(false); setError(finance.storageError ?? "Payment could not be recorded. It may already be paid."); }
  };

  const skip = (pause: boolean) => {
    if (!item.recurringId || lock.current) return;
    const run = () => {
      lock.current = true;
      if (finance.skipRecurring(item.recurringId!, item.dueDate, pause)) onClose();
      else { lock.current = false; setError("This occurrence could not be skipped."); }
    };
    const msg = pause ? "Skip this occurrence and pause the schedule. No payment is recorded." : "Skip this occurrence and move to the next due date. No payment is recorded.";
    if (Platform.OS === "web") { if (typeof window !== "undefined" && window.confirm(t(msg))) run(); }
    else Alert.alert(t(pause ? "Skip and pause?" : "Skip this one?"), t(msg), [{ text: t("Cancel"), style: "cancel" }, { text: t(pause ? "Skip and pause" : "Skip"), onPress: run }]);
  };

  return (
        <FormModal title={closed ? item.name : "Confirm payment"} translateTitle={!closed} topInset={topInset} bottomInset={bottomInset} onClose={onClose} testID="pay-sheet">
      <View style={ui.between}>
        <Text style={[ui.cardTitle, { color: colors.foreground, flex: 1 }]}>{item.name}</Text>
        <View style={[ui.pill, { backgroundColor: s.bg }]}><Text style={[ui.pillText, { color: s.color }]}>{t(s.label)}</Text></View>
      </View>
      <Text style={[ui.hero, { color: colors.foreground, marginTop: 6 }]}>{money(item.amount, item.currency)}</Text>
      <Text style={[ui.small, { color: colors.mutedForeground }]}>{t(TYPE_LABEL[item.type])} · {t("due")} {shortDate(item.dueDate)}</Text>

      {closed ? (
        <>
          <Text style={[ui.body, { color: colors.mutedForeground, marginTop: 18 }]}>
            {t(item.status === "paid" ? "This payment is confirmed and recorded in Transactions." : "This occurrence was skipped. No payment was recorded.")}
          </Text>
          {item.status === "paid" ? (
            <Button label="View in Transactions" tone="neutral" style={{ marginTop: 16 }} testID="pay-view-transactions" onPress={() => { onClose(); router.push("/transactions"); }} />
          ) : null}
        </>
      ) : (
        <>
          <Text style={[ui.small, { color: colors.mutedForeground, marginTop: 14 }]}>{t("Confirming creates one transaction and updates the selected account balance.")}</Text>
          <View style={{ marginTop: 16 }}><PaymentAccountPicker value={accountId} onChange={setAccountId} currency={item.currency} /></View>
          <Field label="Payment date"><Input testID="pay-date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" maxLength={10} autoCapitalize="none" /></Field>
          {partial ? (
            <Field label={`Amount (${item.currency})`} hint={`Remaining on this occurrence: ${money(item.amount, item.currency)}. Partial payments are allowed; reopen this item to record another.`}>
              <Input testID="pay-amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            </Field>
          ) : null}
          {error ? <Text style={[ui.small, { color: colors.destructive, marginTop: 12 }]} testID="pay-error">{t(error)}</Text> : null}
          <Button label={busy ? t("Recording...") : t("Confirm payment")} onPress={pay} disabled={busy} testID="pay-confirm" style={{ marginTop: 20 }} />
          {item.type === "expense" && item.recurringId ? (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Button label="Skip" tone="neutral" style={{ flex: 1 }} onPress={() => skip(false)} testID="pay-skip" />
              <Button label="Skip and pause" tone="neutral" style={{ flex: 1 }} onPress={() => skip(true)} testID="pay-skip-pause" />
            </View>
          ) : null}
          {item.recurringId ? (
            <Pressable testID="pay-open-recurring" onPress={() => { onClose(); router.push(`/recurring?id=${item.recurringId}`); }} style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: 16, alignSelf: "center" }}>
              <Feather name="repeat" size={14} color={colors.primary} />
              <Text style={[ui.link, { color: colors.primary }]}>{t("Edit schedule")}</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </FormModal>
  );
}
