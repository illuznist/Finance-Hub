import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HeaderAction, ScreenHeader } from "@/components/ScreenHeader";
import {
  Button, Chips, EmptyBlock, Field, FormModal, Input, Progress, ToggleRow,
  money, monthTitle, statusTone, ui, usePlanning, type BudgetView,
} from "@/components/PlanningUI";
import { categoryKey } from "@/finance/budgets";
import { shiftMonth } from "@/finance/calendar";
import { localDate, minorUnits, newId } from "@/finance/ledger";
import type { BudgetCategory, BudgetMode, BudgetPlan } from "@/finance/planningTypes";
import { useColors } from "@/hooks/useColors";

const ICONS = ["grid", "home", "shopping-cart", "coffee", "truck", "compass", "shopping-bag", "film", "heart", "zap", "repeat", "map", "book", "user", "gift", "smartphone", "tool", "credit-card", "archive"];
const SWATCHES = ["#2563EB", "#1E3A8A", "#0F766E", "#475569", "#7C3AED", "#B45309", "#BE123C"];
const MODES: { key: BudgetMode; label: string }[] = [
  { key: "fixed", label: "Fixed" }, { key: "custom", label: "Custom monthly" }, { key: "rollover", label: "Rollover" },
];

function safeView(fn: () => BudgetView): BudgetView | null {
  try { return fn(); } catch { return null; }
}

export default function BudgetScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const finance = usePlanning();
  const isWeb = Platform.OS === "web";
  const topInset = isWeb ? 67 : insets.top;
  const bottomInset = isWeb ? 34 : insets.bottom;
  const current = localDate().slice(0, 7);
  const [month, setMonth] = useState(current);
  const [editing, setEditing] = useState(false);

  const ensureRef = useRef(finance.ensureBudgetPeriod);
  ensureRef.current = finance.ensureBudgetPeriod;
  useEffect(() => { try { ensureRef.current(month); } catch { /* view still renders */ } }, [month]);

  const view = useMemo(() => safeView(() => finance.getBudget(month)),
    [finance, month]); // eslint-disable-line react-hooks/exhaustive-deps
  const prev = useMemo(() => safeView(() => finance.getBudget(shiftMonth(month, -1))),
    [finance, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = view?.period.currency ?? finance.currency;
  const tone = statusTone(view?.status ?? "unset", colors);
  const attention = (view?.categories ?? []).filter(c => ["approaching", "near", "exceeded"].includes(c.status));
  const listed = (view?.categories ?? []).filter(c => c.limit !== 0 || c.spent > 0);
  const diff = view && prev ? view.spent - prev.spent : 0;
  const relation = month < current ? "Past month" : month > current ? "Next month" : "Current month";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Budget" subtitle={`Confirmed spending in ${cur}`} topInset={topInset} colors={colors}
        leading={<HeaderAction icon="arrow-left" label="Go back" variant="neutral" testID="back-button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
        trailing={<HeaderAction icon="edit-2" label={`Edit ${monthTitle(month)} budget`} testID="edit-budget" onPress={() => setEditing(true)} />} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 32 }}>
        <View style={[ui.between, { marginBottom: 16 }]}>
          <Pressable testID="month-prev" accessibilityLabel="Previous month" hitSlop={8} onPress={() => setMonth(m => shiftMonth(m, -1))} style={[ui.icon, { backgroundColor: colors.muted }]}>
            <Feather name="chevron-left" size={18} color={colors.foreground} />
          </Pressable>
          <Pressable onPress={() => setMonth(current)} testID="month-current" accessibilityLabel="Go to current month" style={{ alignItems: "center" }}>
            <Text style={[ui.cardTitle, { color: colors.foreground }]}>{monthTitle(month)}</Text>
            <Text style={[ui.small, { color: month === current ? colors.primary : colors.mutedForeground }]}>{relation}{month !== current ? " · tap for current" : ""}</Text>
          </Pressable>
          <Pressable testID="month-next" accessibilityLabel="Next month" hitSlop={8} onPress={() => setMonth(m => shiftMonth(m, 1))} style={[ui.icon, { backgroundColor: colors.muted }]}>
            <Feather name="chevron-right" size={18} color={colors.foreground} />
          </Pressable>
        </View>

        {!view ? (
          <EmptyBlock icon="alert-circle" title="Budget unavailable" body="This month's budget could not be calculated. Try again after your data finishes loading.">
            <Button label="Retry" tone="neutral" onPress={() => setMonth(m => m)} testID="budget-retry" />
          </EmptyBlock>
        ) : (
          <>
            <View style={[ui.card, { backgroundColor: colors.card, borderColor: colors.border }]} testID="budget-summary">
              <View style={ui.between}>
                <Text style={[ui.label, { color: colors.mutedForeground }]}>REMAINING</Text>
                <View style={[ui.pill, { backgroundColor: tone.bg }]}><Text style={[ui.pillText, { color: tone.color }]}>{tone.label}</Text></View>
              </View>
              <Text style={[ui.hero, { color: view.remaining < 0 ? colors.destructive : colors.foreground, marginTop: 6 }]} numberOfLines={1} adjustsFontSizeToFit>
                {view.remaining < 0 ? "-" : ""}{money(Math.abs(view.remaining), cur)}
              </Text>
              <View style={{ marginTop: 14 }}><Progress pct={view.percentage} color={tone.color} /></View>
              <View style={[ui.between, { marginTop: 12 }]}>
                <Stat label={`Spent (${cur})`} value={view.spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} />
                <Stat label={`Budget (${cur})`} value={view.period.limit !== 0 ? view.period.limit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "Not set"} />
                <Stat label="Used" value={`${view.percentage.toFixed(1)}%`} />
              </View>
              <View style={[ui.sep, { backgroundColor: colors.border, marginVertical: 12 }]} />
              <View style={ui.between}>
                <Stat label="Daily average" value={money(view.dailyAverage, cur)} />
                <Stat label="Projected" value={month > current ? "—" : money(view.projected, cur)} />
              </View>
              {prev ? (
                <Text style={[ui.small, { color: colors.mutedForeground, marginTop: 12 }]} testID="budget-compare">
                  {monthTitle(shiftMonth(month, -1))}: {money(prev.spent, cur)} spent.{" "}
                  {diff === 0 ? "Same as this month." : `${money(Math.abs(diff), cur)} ${diff > 0 ? "more" : "less"} this month.`}
                </Text>
              ) : null}
              {(view.period.carryFrom && Object.values(view.period.carryAmounts).some(v => v !== 0)) ? (
                <Text style={[ui.small, { color: colors.mutedForeground, marginTop: 6 }]}>Limits include rollover carried from last month.</Text>
              ) : null}
            </View>

            <Text style={[ui.small, { color: colors.mutedForeground, marginTop: 10 }]}>
              Counts confirmed expenses. Transfers and income never count.
              {" "}EMI and balloon payments {view.period.includeEMI ? "are" : "are not"} included; loan repayments {view.period.includeLoans ? "are" : "are not"}; savings {view.period.includeSavings ? "are" : "are not"}.
            </Text>

            {attention.length > 0 ? (
              <>
                <Text style={[ui.section, { color: colors.foreground }]}>Needs attention</Text>
                {attention.map(c => {
                  const t = statusTone(c.status, colors);
                  return (
                    <View key={c.id} style={[ui.between, { paddingVertical: 6 }]}>
                      <Text style={[ui.body, { color: colors.foreground, flex: 1 }]}>{c.name}</Text>
                      <Text style={[ui.pillText, { color: t.color }]}>{t.label} · {Math.round(c.percentage)}%</Text>
                    </View>
                  );
                })}
              </>
            ) : null}

            <Text style={[ui.section, { color: colors.foreground }]}>Categories</Text>
            {listed.length === 0 ? (
              <EmptyBlock icon="pie-chart" title="No category limits yet" body="Set limits for categories you want to watch. Spending without a limit still counts toward the total.">
                <Button label="Set category limits" onPress={() => setEditing(true)} testID="empty-edit-budget" />
              </EmptyBlock>
            ) : listed.map((c, i) => {
              const t = statusTone(c.status, colors);
              return (
                <View key={c.id} testID={`budget-category-${c.id}`}>
                  {i > 0 ? <View style={[ui.sep, { backgroundColor: colors.border }]} /> : null}
                  <View style={{ paddingVertical: 12 }}>
                    <View style={ui.between}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                        <View style={[ui.icon, { backgroundColor: c.color + "1F", width: 30, height: 30, borderRadius: 9 }]}>
                          <Feather name={c.icon as never} size={15} color={c.color} />
                        </View>
                        <Text style={[ui.bodyStrong, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>{c.name}</Text>
                      </View>
                      <Text style={[ui.bodyStrong, ui.num, { color: colors.foreground }]}>{money(c.spent, cur)}</Text>
                    </View>
                    {c.limit > 0 ? (
                      <>
                        <View style={{ marginTop: 8 }}><Progress pct={c.percentage} color={t.color} /></View>
                        <View style={[ui.between, { marginTop: 6 }]}>
                          <Text style={[ui.small, { color: colors.mutedForeground }]}>of {money(c.limit, cur)} · {Math.round(c.percentage)}%</Text>
                          <Text style={[ui.small, { color: c.remaining < 0 ? colors.destructive : colors.mutedForeground }]}>
                            {c.remaining < 0 ? `${money(-c.remaining, cur)} over` : `${money(c.remaining, cur)} left`}
                          </Text>
                        </View>
                      </>
                    ) : <Text style={[ui.small, { color: colors.mutedForeground, marginTop: 4 }]}>No limit set</Text>}
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
      {editing && view ? (
        <BudgetEditor month={month} view={view} topInset={topInset} bottomInset={bottomInset} onClose={() => setEditing(false)} />
      ) : null}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[ui.small, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[ui.bodyStrong, ui.num, { color: colors.foreground, marginTop: 2 }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

type CatDraft = BudgetCategory & { limitText: string };

function BudgetEditor({ month, view, topInset, bottomInset, onClose }: {
  month: string; view: BudgetView; topInset: number; bottomInset: number; onClose: () => void;
}) {
  const colors = useColors();
  const finance = usePlanning();
  const p = view.period;
  const current = localDate().slice(0, 7);
  const saving = useRef(false);
  const [mode, setMode] = useState<BudgetMode>(p.mode);
  const [limit, setLimit] = useState(p.limit ? String(p.limit) : "");
  const [cats, setCats] = useState<CatDraft[]>(p.categories.map(c => ({ ...c, limitText: c.limit ? String(c.limit) : "" })));
  const [includeEMI, setIncludeEMI] = useState(p.includeEMI);
  const [includeLoans, setIncludeLoans] = useState(p.includeLoans);
  const [includeSavings, setIncludeSavings] = useState(p.includeSavings);
  const [carryDeficit, setCarryDeficit] = useState(p.carryDeficit);
  const [alerts, setAlerts] = useState(p.alerts);
  const [thresholds, setThresholds] = useState<number[]>(p.thresholds);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("grid");
  const [newColor, setNewColor] = useState(SWATCHES[0]);
  const [error, setError] = useState<string | null>(null);
  const [styling, setStyling] = useState<string | null>(null);
  const totalCarry = Object.values(p.carryAmounts).reduce((s, v) => s + minorUnits(v), 0) / 100;
  const hasCarry = Object.values(p.carryAmounts).some(v => v !== 0);

  const patch = (id: string, u: Partial<CatDraft>) => setCats(cs => cs.map(c => (c.id === id ? { ...c, ...u } : c)));
  const addCat = () => {
    const name = newName.trim();
    if (!name) return setError("Name the new category.");
    if (cats.some(c => categoryKey(c.name) === categoryKey(name))) return setError("A category with this name already exists.");
    setError(null);
    setCats(cs => [...cs, { id: newId(), name, icon: newIcon, color: newColor, limit: 0, limitText: "", rollover: false, alerts: true }]);
    setNewName("");
  };

  const commit = (plan: BudgetPlan) => {
    saving.current = true;
    if (finance.saveBudget(month, plan)) onClose();
    else { saving.current = false; setError(finance.storageError ?? "The budget could not be saved. Check the amounts and try again."); }
  };

  const save = () => {
    if (saving.current) return;
    setError(null);
    const total = limit.trim() ? parseSigned(limit) : 0;
    if (total === null) return setError("Enter a monthly budget with up to two decimals.");
    if (minorUnits(total) < minorUnits(totalCarry)) return setError(totalCarry < 0
      ? `The total can't go below the carried deficit of ${money(totalCarry, p.currency)}.`
      : `The total can't be below the carried ${money(totalCarry, p.currency)}.`);
    const out: BudgetCategory[] = [];
    for (const c of cats) {
      const v = c.limitText.trim() ? parseSigned(c.limitText) : 0;
      if (v === null) return setError(`Check the limit for ${c.name}.`);
      const carry = p.carryAmounts[c.id] ?? 0;
      if (minorUnits(v) < minorUnits(carry)) return setError(`${c.name} can't go below its carried ${money(carry, p.currency)}.`);
      const { limitText: _l, ...rest } = c;
      out.push({ ...rest, limit: v });
    }
    const plan: BudgetPlan = { currency: p.currency, startMonth: p.startMonth, mode, limit: total, categories: out,
      includeEMI, includeLoans, includeSavings, carryDeficit, alerts, thresholds: [...thresholds].sort((a, b) => a - b) };
    if (month < current) {
      const msg = `You are editing ${monthTitle(month)}, a past month. Only that month changes; the current budget stays as it is.`;
      if (Platform.OS === "web") { if (typeof window !== "undefined" && window.confirm(msg)) commit(plan); }
      else Alert.alert("Edit a past month?", msg, [{ text: "Cancel", style: "cancel" }, { text: `Save ${monthTitle(month)}`, onPress: () => commit(plan) }]);
      return;
    }
    commit(plan);
  };

  return (
    <FormModal title={`Budget · ${monthTitle(month)}`} topInset={topInset} bottomInset={bottomInset} onClose={onClose} testID="budget-form"
      footer={<>
        {error ? <Text style={[ui.small, { color: colors.destructive, marginTop: 16 }]} testID="budget-form-error">{error}</Text> : null}
        <Button label={`Save ${monthTitle(month)}`} onPress={save} testID="budget-form-save" style={{ marginTop: 20 }} />
      </>}>
      <View style={[ui.card, { backgroundColor: month < current ? colors.warningLight : colors.secondary, borderColor: colors.border }]}>
        <Text style={[ui.bodyStrong, { color: colors.foreground }]}>Editing {monthTitle(month)}</Text>
        <Text style={[ui.small, { color: colors.mutedForeground, marginTop: 2 }]}>
          {month < current ? "Past month. Saving changes only this period." : "Changes apply to this month and become the template for later months."}
        </Text>
      </View>
      <Field label="Budget behavior" hint={mode === "fixed" ? "Same limit every month." : mode === "custom" ? "New months start at zero so you set each one." : "Unused category money carries into next month for categories with rollover on."}>
        <Chips items={MODES} value={mode} onChange={setMode} prefix="budget-mode" />
      </Field>
      <Field label={`Total monthly limit (${p.currency})`} hint={hasCarry
          ? `Includes ${money(totalCarry, p.currency)} carried from last month${totalCarry < 0 ? " (a deficit, so the total may be negative)" : ""}. Base limit now ${money((minorUnits(Number(limit) || 0) - minorUnits(totalCarry)) / 100, p.currency)}. Enter the final total; carry is not added again.`
          : mode === "rollover" ? "Unused money from categories with rollover on carries into next month." : "This period's total limit."}>
        <Input testID="budget-limit" value={limit} onChangeText={setLimit} keyboardType={totalCarry < 0 ? "numbers-and-punctuation" : "decimal-pad"} placeholder="0.00" />
      </Field>

      <Text style={[ui.section, { color: colors.foreground }]}>Included in spending</Text>
      <Text style={[ui.small, { color: colors.mutedForeground, marginBottom: 4 }]} testID="budget-debt-explainer">
        By default, debt is left out: EMI, balloon and loan repayments and savings contributions don't count as spending. Turn on a switch below to include that type. Each payment is only ever counted once.
        {" "}Exception: if a category named "Debt repayments" (or one matching a loan payment's category) has a limit, loan repayments count toward that category and the total even when the loan switch is off.
      </Text>
      <ToggleRow label="EMI and balloon payments" hint="Each payment is counted once." value={includeEMI} onChange={setIncludeEMI} testID="toggle-emi" />
      <ToggleRow label="Loan repayments" value={includeLoans} onChange={setIncludeLoans} testID="toggle-loans" />
      <ToggleRow label="Savings contributions" value={includeSavings} onChange={setIncludeSavings} testID="toggle-savings" />
      {mode === "rollover" ? <ToggleRow label="Carry overspending forward" hint="Off: only unused money rolls over." value={carryDeficit} onChange={setCarryDeficit} testID="toggle-deficit" /> : null}

      <Text style={[ui.section, { color: colors.foreground }]}>Alerts</Text>
      <ToggleRow label="Budget alerts" hint="Sent once per threshold per month." value={alerts} onChange={setAlerts} testID="toggle-alerts" />
      {alerts ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          {[75, 90, 100].map(t => {
            const on = thresholds.includes(t);
            return (
              <Pressable key={t} testID={`threshold-${t}`} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                onPress={() => setThresholds(ts => (on ? ts.filter(x => x !== t) : [...ts, t]))}
                style={[ui.chip, { backgroundColor: on ? colors.primary : colors.card, borderColor: on ? colors.primary : colors.border }]}>
                <Text style={[ui.chipText, { color: on ? colors.primaryForeground : colors.foreground }]}>{t}%</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Text style={[ui.section, { color: colors.foreground }]}>Category limits</Text>
      {cats.map(c => (
        <View key={c.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }} testID={`cat-edit-${c.id}`}>
          <View style={[ui.between]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <Feather name={c.icon as never} size={16} color={c.color} />
              <Text style={[ui.body, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>{c.name}</Text>
            </View>
            <Input value={c.limitText} onChangeText={v => patch(c.id, { limitText: v })} keyboardType="numbers-and-punctuation" placeholder="No limit"
              style={{ width: 110, paddingVertical: 8, textAlign: "right" }} testID={`cat-limit-${c.id}`} accessibilityLabel={`${c.name} limit`} />
            <Pressable hitSlop={8} accessibilityLabel={`Delete ${c.name}`} testID={`cat-delete-${c.id}`}
              onPress={() => setCats(cs => cs.filter(x => x.id !== c.id))}>
              <Feather name="trash-2" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
            <MiniCheck label="Appearance" on={styling === c.id} onPress={() => setStyling(v => (v === c.id ? null : c.id))} testID={`cat-style-${c.id}`} />
            <MiniCheck label="Alerts" on={c.alerts} onPress={() => patch(c.id, { alerts: !c.alerts })} testID={`cat-alerts-${c.id}`} />
            {mode === "rollover" ? <MiniCheck label="Rollover" on={c.rollover} onPress={() => patch(c.id, { rollover: !c.rollover })} testID={`cat-rollover-${c.id}`} /> : null}
          </View>
          {(p.carryAmounts[c.id] ?? 0) !== 0 ? (
            <Text style={[ui.small, { color: colors.mutedForeground, marginTop: 6 }]} testID={`cat-carry-${c.id}`}>
              Includes {money(p.carryAmounts[c.id], p.currency)} carried{p.carryAmounts[c.id] < 0 ? " deficit" : ""}. Minimum {money(p.carryAmounts[c.id], p.currency)}.
            </Text>
          ) : null}
          {styling === c.id ? (
            <AppearancePicker icon={c.icon} color={c.color} prefix={`cat-${c.id}`}
              onIcon={ic => patch(c.id, { icon: ic })} onColor={col => patch(c.id, { color: col })} />
          ) : null}
        </View>
      ))}

      <Field label="New category">
        <Input testID="new-cat-name" value={newName} onChangeText={setNewName} placeholder="e.g. Pets" />
      </Field>
      <AppearancePicker icon={newIcon} color={newColor} prefix="new-cat" onIcon={setNewIcon} onColor={setNewColor} />
      <Button label="Add category" tone="neutral" onPress={addCat} testID="new-cat-add" />
    </FormModal>
  );
}

function parseSigned(text: string): number | null {
  const t = text.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function AppearancePicker({ icon, color, prefix, onIcon, onColor }: {
  icon: string; color: string; prefix: string; onIcon: (v: string) => void; onColor: (v: string) => void;
}) {
  const colors = useColors();
  const icons = ICONS.includes(icon) ? ICONS : [icon, ...ICONS];
  const swatches = SWATCHES.includes(color) ? SWATCHES : [color, ...SWATCHES];
  return (
    <View style={{ marginBottom: 12 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
        {icons.map(ic => (
          <Pressable key={ic} testID={`${prefix}-icon-${ic}`} accessibilityLabel={`Icon ${ic}`} accessibilityState={{ selected: icon === ic }} onPress={() => onIcon(ic)}
            style={[ui.icon, { borderWidth: 1, borderColor: icon === ic ? colors.primary : colors.border, backgroundColor: icon === ic ? colors.secondary : colors.card }]}>
            <Feather name={ic as never} size={16} color={icon === ic ? colors.primary : colors.mutedForeground} />
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        {swatches.map(s => (
          <Pressable key={s} testID={`${prefix}-color-${s}`} accessibilityLabel={`Color ${s}`} accessibilityState={{ selected: color === s }} onPress={() => onColor(s)}
            style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: s, borderWidth: 2, borderColor: color === s ? colors.foreground : "transparent" }} />
        ))}
      </View>
    </View>
  );
}

function MiniCheck({ label, on, onPress, testID }: { label: string; on: boolean; onPress: () => void; testID: string }) {
  const colors = useColors();
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} hitSlop={6}
      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Feather name={on ? "check-square" : "square"} size={15} color={on ? colors.primary : colors.mutedForeground} />
      <Text style={[ui.small, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}
