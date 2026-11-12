import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ForecastChart } from "@/components/forecast/ForecastChart";
import { Button, Chips, Field, Input, money, parseMoney, shortDate, ui, type Colors } from "@/components/PlanningUI";
import { HeaderAction, ScreenHeader } from "@/components/ScreenHeader";
import { useFinance } from "@/context/FinanceContext";
import { addDays, monthBounds } from "@/finance/calendar";
import { localDate, newId, validLocalDate } from "@/finance/ledger";
import {
  buildBudgetOutlook, buildCashFlowForecast, forecastRange,
  type CashFlowForecast, type ForecastMode, type ForecastPreset, type ForecastScenario,
} from "@/finance/forecast";
import { useColors } from "@/hooks/useColors";
import { parseLocalizedNumberInput } from "@/i18n/localization";

const PRESETS: { key: ForecastPreset; label: string }[] = [
  { key: "7", label: "7 days" }, { key: "30", label: "30 days" },
  { key: "60", label: "60 days" }, { key: "90", label: "90 days" },
  { key: "custom", label: "Custom" },
];
const SCENARIOS: { key: ForecastScenario["kind"]; label: string }[] = [
  { key: "additional_income", label: "Extra income" },
  { key: "one_time_expense", label: "One-time expense" },
  { key: "increase_monthly_spending", label: "More monthly spend" },
  { key: "reduce_monthly_spending", label: "Less monthly spend" },
  { key: "delay_expected_income", label: "Delay income" },
  { key: "extra_loan_repayment", label: "Extra loan payment" },
  { key: "savings_contribution", label: "Savings contribution" },
];
const UNALLOCATED = "__unallocated__";

function Stat({ label, value, colors, tone }: { label: string; value: string; colors: Colors; tone?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 130, paddingVertical: 8 }}>
      <Text style={[ui.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={[ui.bodyStrong, ui.num, { color: tone ?? colors.foreground, marginTop: 4 }]}>{value}</Text>
    </View>
  );
}

function ConfidenceNote({ mode, colors, startsLater }: { mode: ForecastMode; colors: Colors; startsLater: boolean }) {
  return (
    <Text style={[ui.small, { color: colors.mutedForeground, lineHeight: 19 }]}>
      Current balances come from recorded transactions. Scheduled payments use known dates and remaining amounts.
      {mode === "expected" ? " Expected mode also includes explicitly dated expected income." : " Conservative mode excludes expected income."}
      {startsLater ? " Known events before this window are reflected in its projected starting balance." : ""}
      {" "}Projections are estimates, not guaranteed balances.
    </Text>
  );
}

function ForecastSummary({ forecast, colors }: { forecast: CashFlowForecast; colors: Colors }) {
  return (
    <View testID="forecast-summary" style={[ui.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 8 }]}>
      <Text style={[ui.label, { color: colors.primary }]}>PROJECTED ENDING BALANCE</Text>
      <Text adjustsFontSizeToFit numberOfLines={1} style={[ui.hero, ui.num, { color: forecast.projectedEndingBalance < 0 ? colors.destructive : colors.foreground }]}>
        {money(forecast.projectedEndingBalance, forecast.currency)}
      </Text>
      <Text style={[ui.small, { color: colors.mutedForeground }]}>
        {shortDate(forecast.range.from)} to {shortDate(forecast.range.to)} · {forecast.currency} only
      </Text>
      <View style={[ui.sep, { backgroundColor: colors.border, marginVertical: 4 }]} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Stat label="Available today" value={money(forecast.currentAvailable, forecast.currency)} colors={colors} />
        <Stat label="Expected inflows" value={money(forecast.expectedInflows, forecast.currency)} colors={colors} />
        <Stat label="Scheduled outflows" value={money(forecast.scheduledOutflows, forecast.currency)} colors={colors} />
        <Stat label="Lowest projected" value={money(forecast.lowestProjectedBalance, forecast.currency)} colors={colors}
          tone={forecast.lowestProjectedBalance < 0 ? colors.destructive : undefined} />
      </View>
      {forecast.nextPayment ? (
        <View style={[ui.row, { borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: 0, alignItems: "flex-start" }]}>
          <Feather name="calendar" size={17} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[ui.label, { color: colors.mutedForeground }]}>NEXT SCHEDULED OUTFLOW</Text>
            <Text style={[ui.bodyStrong, { color: colors.foreground, marginTop: 3 }]}>{forecast.nextPayment.name}</Text>
            <Text style={[ui.small, { color: colors.mutedForeground }]}>{shortDate(forecast.nextPayment.date)} · {money(forecast.nextPayment.amount, forecast.currency)}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function BudgetCard({ outlook, colors }: { outlook: ReturnType<typeof buildBudgetOutlook> | null; colors: Colors }) {
  if (!outlook) {
    return (
      <View testID="forecast-budget" style={[ui.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 6 }]}>
        <Text style={[ui.cardTitle, { color: colors.foreground }]}>Budget outlook</Text>
        <Text style={[ui.small, { color: colors.mutedForeground }]}>Your budget could not be calculated right now. The cash forecast is unchanged.</Text>
      </View>
    );
  }
  const color = outlook.projectedRemaining < 0 ? colors.destructive : colors.foreground;
  return (
    <View testID="forecast-budget" style={[ui.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 10 }]}>
      <View style={ui.between}>
        <Text style={[ui.cardTitle, { color: colors.foreground }]}>Budget outlook</Text>
        <Text style={[ui.small, { color: colors.mutedForeground }]}>{outlook.month}</Text>
      </View>
      <View style={ui.between}>
        <Text style={[ui.small, { color: colors.mutedForeground }]}>Limit</Text>
        <Text style={[ui.bodyStrong, ui.num, { color: colors.foreground }]}>{outlook.limit > 0 ? money(outlook.limit, outlook.currency) : "Not set"}</Text>
      </View>
      <View style={ui.between}>
        <Text style={[ui.small, { color: colors.mutedForeground }]}>Actual spending</Text>
        <Text style={[ui.bodyStrong, ui.num, { color: colors.foreground }]}>{money(outlook.actual, outlook.currency)}</Text>
      </View>
      <View style={ui.between}>
        <Text style={[ui.small, { color: colors.mutedForeground }]}>Known scheduled spending</Text>
        <Text style={[ui.bodyStrong, ui.num, { color: colors.foreground }]}>{money(outlook.scheduled, outlook.currency)}</Text>
      </View>
      <View style={[ui.sep, { backgroundColor: colors.border }]} />
      <View style={ui.between}>
        <Text style={[ui.bodyStrong, { color: colors.foreground }]}>Projected use</Text>
        <Text style={[ui.bodyStrong, ui.num, { color }]}>{money(outlook.projected, outlook.currency)}</Text>
      </View>
      {outlook.limit > 0 ? (
        <Text style={[ui.small, { color: outlook.projectedRemaining < 0 ? colors.destructive : colors.mutedForeground }]}>
          {outlook.projectedRemaining < 0
            ? `${money(Math.abs(outlook.projectedRemaining), outlook.currency)} over the limit if known commitments occur.`
            : `${money(outlook.projectedRemaining, outlook.currency)} remaining after known commitments.`}
        </Text>
      ) : null}
      {outlook.overLimitCategories.length ? (
        <View style={{ gap: 4 }}>
          <Text style={[ui.label, { color: colors.destructive }]}>CATEGORIES ABOVE LIMIT</Text>
          {outlook.overLimitCategories.map(category => (
            <View key={category.id} style={ui.between}>
              <Text style={[ui.small, { color: colors.foreground }]}>{category.name}</Text>
              <Text style={[ui.small, ui.num, { color: colors.destructive }]}>{money(category.projected, outlook.currency)} / {money(category.limit, outlook.currency)}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={[ui.small, { color: colors.mutedForeground }]}>Actual and scheduled spending are separate; only confirmed transactions count as actual.</Text>
    </View>
  );
}

function ScenarioName(kind: ForecastScenario["kind"]) {
  return SCENARIOS.find(item => item.key === kind)?.label ?? "Simulation";
}

function eventDestination(event: CashFlowForecast["events"][number]) {
  if (event.confidence === "hypothetical") return null;
  const sourceId = encodeURIComponent(event.sourceId);
  if (event.kind === "expense") return `/recurring?detailId=${sourceId}`;
  if (event.kind === "emi" || event.kind === "balloon") return `/(tabs)/emis?emiId=${sourceId}`;
  if (event.kind === "loan") return `/(tabs)/loans?loanId=${sourceId}`;
  if (event.kind === "expected-income") return `/(tabs)/wallets?incomeId=${sourceId}`;
  return "/upcoming";
}

export default function ForecastScreen() {
  const colors = useColors();
  const finance = useFinance();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;
  const today = finance.calendarKey?.slice(0, 10) || localDate();
  const [preset, setPreset] = useState<ForecastPreset>("30");
  const [customRange, setCustomRange] = useState({ from: today, to: addDays(today, 29) });
  const [mode, setMode] = useState<ForecastMode>("conservative");
  const [currency, setCurrency] = useState(finance.currency);
  const [scenarioKind, setScenarioKind] = useState<ForecastScenario["kind"]>("one_time_expense");
  const [scenarioAmount, setScenarioAmount] = useState("100");
  const [scenarioDate, setScenarioDate] = useState(today);
  const [scenarioAccountId, setScenarioAccountId] = useState(UNALLOCATED);
  const [delayDays, setDelayDays] = useState("7");
  const [delayIncomeId, setDelayIncomeId] = useState("");
  const [scenarios, setScenarios] = useState<ForecastScenario[]>([]);
  const [scenarioError, setScenarioError] = useState("");

  const currencies = useMemo(() => [...new Set([
    finance.currency,
    ...finance.accounts.map(a => a.currency ?? finance.currency),
    ...(finance.planning?.recurring ?? []).map(r => r.currency),
    ...finance.emis.map(e => e.currency ?? finance.currency),
    ...finance.loans.map(l => l.currency ?? finance.currency),
    ...finance.incomes.filter(i => i.kind === "expected" && i.date).map(i => i.currency ?? finance.currency),
  ])].filter(Boolean).sort(), [finance.currency, finance.accounts, finance.planning, finance.emis, finance.loans, finance.incomes]);
  const accounts = useMemo(() => finance.accounts
    .filter(a => (a.currency ?? finance.currency) === currency)
    .map(a => ({ id: a.id, name: a.name })), [finance.accounts, finance.currency, currency]);
  const datedExpectedIncomes = useMemo(() => finance.incomes.filter(i =>
    i.kind === "expected" && (i.currency ?? finance.currency) === currency && !!i.date && validLocalDate(i.date)),
  [finance.incomes, finance.currency, currency]);
  const rangeResult = useMemo(() => {
    try {
      return { range: forecastRange(preset, today, preset === "custom" ? customRange : undefined), error: "" };
    } catch (error) {
      return { range: null, error: error instanceof Error ? error.message : "Choose a valid forecast period." };
    }
  }, [preset, today, customRange]);
  const forecastOptions = useMemo(() => rangeResult.range ? { currency, range: rangeResult.range, mode, today } : null,
    [rangeResult.range, currency, mode, today]);
  const baselineResult = useMemo(() => {
    if (!forecastOptions) return { value: null as CashFlowForecast | null, error: "" };
    try { return { value: buildCashFlowForecast(finance, forecastOptions), error: "" }; }
    catch (error) { return { value: null, error: error instanceof Error ? error.message : "The forecast could not be calculated." }; }
  }, [finance.transactions, finance.accounts, finance.emis, finance.loans, finance.incomes, finance.planning, finance.currency, finance.calendarKey, forecastOptions]);
  const baseline = baselineResult.value;
  const scenarioResult = useMemo(() => {
    if (!forecastOptions || !scenarios.length) return null;
    try { return buildCashFlowForecast(finance, { ...forecastOptions, scenarios }); }
    catch { return null; }
  }, [finance.transactions, finance.accounts, finance.emis, finance.loans, finance.incomes, finance.planning, finance.currency, finance.calendarKey, forecastOptions, scenarios]);
  const displayed = scenarioResult ?? baseline;
  const budgetOutlook = useMemo(() => {
    try {
      const month = today.slice(0, 7);
      const view = finance.getBudget(month, currency);
      const remainingMonth = buildCashFlowForecast(finance, {
        currency,
        range: { from: today, to: monthBounds(month).to },
        mode: "conservative",
        today,
      });
      return buildBudgetOutlook(finance, view.period, month, remainingMonth.events);
    } catch { return null; }
  }, [finance.transactions, finance.currency, finance.planning, finance.accounts, finance.emis, finance.loans, today, currency]);

  const addScenario = () => {
    setScenarioError("");
    if (scenarioKind === "delay_expected_income") {
      const days = parseLocalizedNumberInput(delayDays) ?? NaN;
      if (!delayIncomeId || !Number.isInteger(days) || days < 1 || days > 365) {
        setScenarioError("Choose a dated expected income and a delay from 1 to 365 days.");
        return;
      }
      setScenarios(items => [...items, { id: newId(), kind: scenarioKind, currency, incomeId: delayIncomeId, delayDays: days }]);
      return;
    }
    const amount = parseMoney(scenarioAmount);
    if (amount === null || !validLocalDate(scenarioDate) || scenarioDate < today) {
      setScenarioError("Enter a positive amount and a date today or later.");
      return;
    }
    setScenarios(items => [...items, {
      id: newId(), kind: scenarioKind, currency, amount, date: scenarioDate,
      accountId: scenarioAccountId === UNALLOCATED ? undefined : scenarioAccountId,
    }]);
  };

  const removeScenario = (id: string) => setScenarios(items => items.filter(scenario => scenario.id !== id));
  const resetScenarios = () => { setScenarios([]); setScenarioError(""); };
  const openEvent = (event: CashFlowForecast["events"][number]) => {
    const destination = eventDestination(event);
    if (destination) router.push(destination as never);
  };

  const contentWidth = Math.max(280, Math.min(760, window.width - 40));
  const forecastError = rangeResult.error || baselineResult.error;
  const eventDays = useMemo(() => {
    const events = displayed?.events ?? [];
    const grouped = new Map<string, typeof events>();
    for (const event of events) grouped.set(event.date, [...(grouped.get(event.date) ?? []), event]);
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [displayed]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Forecast"
        subtitle={baseline ? `${baseline.currency} · ${shortDate(baseline.range.from)} to ${shortDate(baseline.range.to)}` : "Plan with your recorded data"}
        topInset={topInset}
        colors={colors}
        leading={<HeaderAction icon="arrow-left" label="Back to Home" variant="neutral" testID="forecast-back"
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} />}
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 + bottomInset, gap: 16 }}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 4 }}>
          <Text style={[ui.label, { color: colors.mutedForeground }]}>FORECAST PERIOD</Text>
          <Chips prefix="forecast-range" value={preset} onChange={setPreset} items={PRESETS} />
          {preset === "custom" ? (
            <View style={[ui.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: "row", gap: 10, paddingTop: 0 }]}>
              <View style={{ flex: 1 }}><Field label="From"><Input testID="forecast-custom-from" value={customRange.from} onChangeText={from => setCustomRange(r => ({ ...r, from }))} maxLength={10} autoCapitalize="none" /></Field></View>
              <View style={{ flex: 1 }}><Field label="To"><Input testID="forecast-custom-to" value={customRange.to} onChangeText={to => setCustomRange(r => ({ ...r, to }))} maxLength={10} autoCapitalize="none" /></Field></View>
            </View>
          ) : null}
        </View>

        {currencies.length > 1 ? (
          <View>
            <Text style={[ui.label, { color: colors.mutedForeground }]}>CURRENCY VIEW</Text>
            <Chips prefix="forecast-currency" value={currency} onChange={setCurrency} items={currencies.map(code => ({ key: code, label: code }))} />
          </View>
        ) : null}

        <View>
          <Text style={[ui.label, { color: colors.mutedForeground }]}>INCOME ASSUMPTION</Text>
          <Chips prefix="forecast-mode" value={mode} onChange={setMode} items={[
            { key: "conservative", label: "Conservative" }, { key: "expected", label: "Expected" },
          ]} />
        </View>

        {forecastError ? (
          <View testID="forecast-error" style={[ui.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[ui.body, { color: colors.destructive }]}>{forecastError}</Text>
          </View>
        ) : null}

        {!finance.isReady ? <ActivityIndicator color={colors.primary} /> : null}
        {baseline && finance.isReady ? (
          <>
            <ForecastSummary forecast={baseline} colors={colors} />
            <ConfidenceNote mode={mode} colors={colors} startsLater={baseline.range.from > localDate()} />

            <View style={[ui.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 8 }]} testID="forecast-chart">
              <Text style={[ui.cardTitle, { color: colors.foreground }]}>Projected balance</Text>
              <Text style={[ui.small, { color: colors.mutedForeground }]}>Combined tracked accounts in {currency}; currencies are never converted.</Text>
              <ForecastChart points={baseline.points} scenarioPoints={scenarioResult?.points} width={contentWidth - 32} colors={colors} />
            </View>

            {baseline.shortfall ? (
              <View testID="forecast-shortfall" style={[ui.card, { backgroundColor: colors.errorLight, borderColor: colors.destructive + "55", gap: 6 }]}>
                <View style={[ui.row, { paddingVertical: 0 }]}>
                  <Feather name="alert-circle" size={18} color={colors.destructive} />
                  <Text style={[ui.cardTitle, { color: colors.destructive }]}>Projected balance below zero</Text>
                </View>
                <Text style={[ui.body, { color: colors.foreground }]}>
                  {baseline.shortfall.accountName} may fall below zero on {shortDate(baseline.shortfall.date)}.
                  {" "}About {money(baseline.shortfall.amountRequired, currency)} would cover the projected gap.
                </Text>
                <Text style={[ui.small, { color: colors.mutedForeground }]}>
                  {baseline.shortfall.contributingEvents.length
                    ? `Known commitments affecting this account: ${baseline.shortfall.contributingEvents.map(e => e.name).join(", ")}.`
                    : "The account is already below zero in its recorded balance."}
                </Text>
              </View>
            ) : null}

            {scenarioResult ? (
              <View testID="forecast-scenario-comparison" style={[ui.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 5 }]}>
                <Text style={[ui.label, { color: colors.accent }]}>SIMULATION ONLY</Text>
                <Text style={[ui.cardTitle, { color: colors.foreground }]}>Scenario ending balance</Text>
                <Text style={[ui.hero, ui.num, { color: scenarioResult.projectedEndingBalance >= baseline.projectedEndingBalance ? colors.success : colors.destructive }]}>
                  {money(scenarioResult.projectedEndingBalance, currency)}
                </Text>
                <Text style={[ui.small, { color: colors.mutedForeground }]}>
                  {money(Math.abs(scenarioResult.projectedEndingBalance - baseline.projectedEndingBalance), currency)} {scenarioResult.projectedEndingBalance >= baseline.projectedEndingBalance ? "higher" : "lower"} than baseline. Actual records are unchanged.
                </Text>
              </View>
            ) : null}

            <BudgetCard outlook={budgetOutlook} colors={colors} />

            <View testID="forecast-timeline" style={[ui.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 4 }]}>
              <View style={ui.between}>
                <Text style={[ui.cardTitle, { color: colors.foreground }]}>Upcoming timeline</Text>
                <Text style={[ui.small, { color: colors.mutedForeground }]}>{displayed?.events.length ?? 0} items</Text>
              </View>
              <Text style={[ui.small, { color: colors.mutedForeground, marginBottom: 4 }]}>Unallocated items are shown but do not change a wallet projection.</Text>
              {eventDays.length === 0 ? (
                <View style={[ui.empty, { borderColor: colors.border }]}>
                  <Feather name="calendar" size={22} color={colors.mutedForeground} />
                  <Text style={[ui.bodyStrong, { color: colors.foreground }]}>No scheduled movements</Text>
                  <Text style={[ui.small, { color: colors.mutedForeground, textAlign: "center" }]}>The projection stays at current tracked balances for this period.</Text>
                </View>
              ) : eventDays.map(([date, events]) => (
                <View key={date} testID={`forecast-day-${date}`}>
                  <View style={[ui.sep, { backgroundColor: colors.border, marginVertical: 8 }]} />
                  <Text style={[ui.label, { color: colors.primary, marginVertical: 4 }]}>{shortDate(date)}</Text>
                  {events.map(event => {
                    const destination = eventDestination(event);
                    const isInflow = event.direction === "in";
                    return (
                      <Pressable key={event.id} testID={`forecast-event-${event.id}`} accessibilityRole="button"
                        accessibilityLabel={`${event.name}, ${shortDate(event.date)}, ${money(event.amount, currency)}${destination ? ", open source record" : ", hypothetical"}`}
                        onPress={() => openEvent(event)} disabled={!destination}
                        style={({ pressed }) => [ui.row, { borderBottomWidth: 1, borderBottomColor: colors.border, opacity: pressed ? 0.72 : 1 }]}>
                        <View style={[ui.icon, { backgroundColor: event.confidence === "hypothetical" ? colors.accent + "18" : colors.secondary }]}>
                          <Feather name={isInflow ? "arrow-down-left" : "arrow-up-right"} size={17} color={event.confidence === "hypothetical" ? colors.accent : colors.primary} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text numberOfLines={1} style={[ui.bodyStrong, { color: colors.foreground }]}>{event.name}</Text>
                          <Text numberOfLines={1} style={[ui.small, { color: colors.mutedForeground }]}>{event.source} · {event.category} · {event.accountName ?? "Unallocated"}</Text>
                          <Text style={[ui.small, { color: colors.mutedForeground }]}>
                            {event.accountName ? `${event.accountName} after day: ${money(event.projectedBalanceAfter ?? 0, currency)}` : "No wallet balance assumed"}
                          </Text>
                        </View>
                        <Text adjustsFontSizeToFit numberOfLines={1} style={[ui.bodyStrong, ui.num, { color: isInflow ? colors.success : colors.foreground, maxWidth: 112 }]}>
                          {isInflow ? "+" : "−"}{money(event.amount, currency)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            <View testID="forecast-scenarios" style={[ui.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 8 }]}>
              <View style={ui.between}>
                <Text style={[ui.cardTitle, { color: colors.foreground }]}>What if?</Text>
                {scenarios.length ? <Pressable testID="forecast-scenario-reset" accessibilityRole="button" onPress={resetScenarios}>
                  <Text style={[ui.link, { color: colors.primary }]}>Reset</Text>
                </Pressable> : null}
              </View>
              <Text style={[ui.small, { color: colors.mutedForeground }]}>Simulations never change your ledger, payment history, or wallet balances.</Text>
              <Chips prefix="forecast-scenario-kind" value={scenarioKind} onChange={setScenarioKind} items={SCENARIOS} />
              {scenarioKind === "delay_expected_income" ? (
                <>
                  {datedExpectedIncomes.length ? (
                    <Chips prefix="forecast-delay-income" value={delayIncomeId || datedExpectedIncomes[0].id}
                      onChange={setDelayIncomeId} items={datedExpectedIncomes.map(i => ({ key: i.id, label: i.name }))} />
                  ) : <Text style={[ui.small, { color: colors.mutedForeground }]}>Add an expected income with a specific date to simulate a delay.</Text>}
                  <Field label="Delay by days"><Input testID="forecast-delay-days" value={delayDays} onChangeText={setDelayDays} keyboardType="number-pad" maxLength={3} /></Field>
                  <Text style={[ui.small, { color: colors.mutedForeground }]}>This simulation applies only in Expected mode.</Text>
                </>
              ) : (
                <>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}><Field label="Amount"><Input testID="forecast-scenario-amount" value={scenarioAmount} onChangeText={setScenarioAmount} keyboardType="decimal-pad" maxLength={14} /></Field></View>
                    <View style={{ flex: 1 }}><Field label={scenarioKind.includes("monthly") ? "First date" : "Date"}><Input testID="forecast-scenario-date" value={scenarioDate} onChangeText={setScenarioDate} maxLength={10} autoCapitalize="none" /></Field></View>
                  </View>
                  <Text style={[ui.label, { color: colors.mutedForeground }]}>AFFECTED ACCOUNT</Text>
                  <Chips prefix="forecast-scenario-account" value={scenarioAccountId} onChange={setScenarioAccountId}
                    items={[{ key: UNALLOCATED, label: "Unallocated" }, ...accounts.map(a => ({ key: a.id, label: a.name }))]} />
                </>
              )}
              {scenarioError ? <Text testID="forecast-scenario-error" style={[ui.small, { color: colors.destructive }]}>{scenarioError}</Text> : null}
              <Button label="Add simulation" testID="forecast-scenario-add" onPress={addScenario} />
              {scenarios.length ? (
                <View style={{ gap: 2, marginTop: 4 }}>
                  <Text style={[ui.label, { color: colors.mutedForeground }]}>ACTIVE SIMULATIONS</Text>
                  {scenarios.map(scenario => {
                    const detail = scenario.kind === "delay_expected_income"
                      ? `${datedExpectedIncomes.find(i => i.id === scenario.incomeId)?.name ?? "Expected income"} delayed ${scenario.delayDays} days`
                      : `${money(scenario.amount ?? 0, scenario.currency)}${scenario.date ? ` · ${shortDate(scenario.date)}` : ""}${scenario.accountId ? ` · ${accounts.find(a => a.id === scenario.accountId)?.name ?? "Account"}` : " · Unallocated"}`;
                    return (
                      <View key={scenario.id} style={[ui.between, { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 8 }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[ui.bodyStrong, { color: colors.foreground }]}>{ScenarioName(scenario.kind)}</Text>
                          <Text style={[ui.small, { color: colors.mutedForeground }]}>{detail}</Text>
                        </View>
                        <Pressable testID={`forecast-scenario-remove-${scenario.id}`} accessibilityRole="button"
                          accessibilityLabel={`Remove ${ScenarioName(scenario.kind)}`} onPress={() => removeScenario(scenario.id)}>
                          <Feather name="x" size={18} color={colors.mutedForeground} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>

            <Text style={[ui.small, { color: colors.mutedForeground, textAlign: "center" }]}>
              Forecasts are based on known records only. Missing due dates stay unprojected; no exchange rates or future transactions are invented.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
