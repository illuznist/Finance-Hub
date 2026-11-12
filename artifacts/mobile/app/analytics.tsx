import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CashFlowChart, DrillRow, NetWorthLine, NetWorthModal, NoteText, Section, Sep, pct, s, tap } from "@/components/analytics/AnalyticsParts";
import { Chips, Field, Input, ToggleRow, money, shortDate, ui, type Colors } from "@/components/PlanningUI";
import { HeaderAction, ScreenHeader } from "@/components/ScreenHeader";
import { TYPOGRAPHY } from "@/constants/typography";
import { useFinance } from "@/context/FinanceContext";
import { PERIODS, SPENDING_LABELS, buildAnalyticsReport, reportingRange } from "@/finance/analytics";
import type { AnalyticsReport, DateRange, NetWorthItem, PeriodPreset } from "@/finance/analyticsTypes";
import { useColors } from "@/hooks/useColors";
import { usePreferences } from "@/context/PreferencesContext";
import { formatAppNumber } from "@/i18n/localization";
import { exportAnalyticsReport } from "@/utils/shareAnalyticsReport";

type DrillType = "income" | "expenses" | "movements";
type Drill = (type: DrillType, extra?: { categoryKey?: string; sourceKey?: string }, range?: DateRange) => void;

function signed(v: number, c: string) { return `${v > 0 ? "+" : v < 0 ? "-" : ""}${money(Math.abs(v), c)}`; }

/** Change vs previous. higherIsBetter=false for spending. Percentage is unavailable when previous is zero. */
function Delta({ now, before, currency, higherIsBetter, colors }: { now: number; before: number; currency: string; higherIsBetter: boolean; colors: Colors }) {
  const { t } = usePreferences();
  const d = Math.round((now - before) * 100) / 100;
  if (d === 0) return <Text style={[ui.small, { color: colors.mutedForeground }]}>{t("No change from previous period")}</Text>;
  const good = higherIsBetter ? d > 0 : d < 0;
  const p = before !== 0 ? ` (${formatAppNumber(Math.abs(d / Math.abs(before) * 100), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)` : "";
  return (
    <Text style={[ui.small, ui.num, { color: good ? colors.success : colors.destructive }]}>
      {t(d > 0 ? "Up" : "Down")} {money(Math.abs(d), currency)}{p} {good ? `· ${t("favorable")}` : `· ${t("unfavorable")}`}
    </Text>
  );
}

function Overview({ r, drill, colors }: { r: AnalyticsReport; drill: Drill; colors: Colors }) {
  const { t } = usePreferences();
  const c = r.query.currency, totals = r.totals, p = r.previous;
  const tile = (id: string, label: string, v: number, prev: number, up: boolean, type: DrillType, color: string) => (
    <Pressable testID={`analytics-${id}`} accessibilityRole="button" accessibilityLabel={t("{label} {amount}. View transactions", { label: t(label), amount: money(v, c) })}
      onPress={() => { tap(); drill(type); }} style={({ pressed }) => [st.tile, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
      <View style={ui.between}>
        <Text style={[ui.label, { color: colors.mutedForeground }]}>{t(label)}</Text>
        <Feather name="arrow-up-right" size={13} color={colors.mutedForeground} />
      </View>
      <Text adjustsFontSizeToFit numberOfLines={1} style={[st.tileValue, { color }]}>{id === "net" ? signed(v, c) : money(v, c)}</Text>
      {r.comparisonAvailable ? <Delta now={v} before={prev} currency={c} higherIsBetter={up} colors={colors} /> : null}
    </Pressable>
  );
  return (
    <View style={[st.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[s.eyebrow, { color: colors.primary }]}>{t("Savings rate")}</Text>
      <Text style={[ui.hero, { color: colors.foreground, marginTop: 4 }]}>{pct(totals.savingsRate)}</Text>
      <Text style={[ui.small, { color: colors.mutedForeground }]}>
        {t(totals.savingsRate === null ? "No received income in this period, so a rate cannot be calculated." : "Positive net cash flow as a share of received income.")}
        {r.comparisonAvailable && totals.savingsRate !== null && p.savingsRate !== null ? ` ${t("Previously {rate}.", { rate: pct(p.savingsRate) })}` : ""}
      </Text>
      <View style={{ gap: 10, marginTop: 16 }}>
        {tile("income", "Received income", totals.income, p.income, true, "income", colors.foreground)}
        {tile("expenses", "Recorded spending", totals.expenses, p.expenses, false, "expenses", colors.foreground)}
        {tile("net", "Net cash flow", totals.net, p.net, true, "movements", totals.net < 0 ? colors.destructive : colors.primary)}
      </View>
      <Text style={[ui.small, { color: colors.mutedForeground, marginTop: 12 }]}>
        {r.comparisonAvailable
          ? t("Compared with {from} to {to}.", { from: shortDate(r.previousRange.from), to: shortDate(r.previousRange.to) })
          : t("Comparison unavailable: the previous equivalent period falls outside your recorded history.")}
      </Text>
    </View>
  );
}

function CashFlow({ r, drill, colors }: { r: AnalyticsReport; drill: Drill; colors: Colors }) {
  const { t } = usePreferences();
  const [view, setView] = useState<"monthly" | "yearly">("monthly");
  const [sel, setSel] = useState<string | null>(null);
  const points = view === "monthly" ? r.monthly : r.yearly;
  const point = points.find(p => p.key === sel) ?? null;
  const c = r.query.currency;
  return (
    <Section testID="analytics-cashflow" eyebrow={t("Cash flow")} title={t("Income, spending and net")}
      note={<NoteText>{t("Bars come from recorded transactions only. Months before your {currency} history begins, and future months, are not drawn. Months with no activity inside your history show as zero.", { currency: c })}</NoteText>}>
      <Chips prefix="analytics-chart-view" value={view} onChange={v => { setView(v); setSel(null); }}
        items={[{ key: "monthly", label: t("Monthly") }, { key: "yearly", label: t("Yearly") }]} />
      {points.length === 0 ? <Text style={[ui.small, { color: colors.mutedForeground }]}>{t("No recorded {currency} activity in this period.", { currency: c })}</Text>
        : <CashFlowChart points={points} currency={c} selected={sel} onSelect={k => setSel(k === sel ? null : k)} />}
      {point ? (
        <View testID="analytics-chart-selection" style={[st.inset, { backgroundColor: colors.secondary }]}>
          <Text style={[ui.bodyStrong, { color: colors.secondaryForeground }]}>{t("{from} to {to}{partial}", { from: shortDate(point.from), to: shortDate(point.to), partial: point.partial ? ` (${t("partial")})` : "" })}</Text>
          <DrillRow testID="analytics-chart-income" label={t("Income")} value={money(point.income, c)} onPress={() => drill("income", {}, point)} />
          <DrillRow testID="analytics-chart-expenses" label={t("Spending")} value={money(point.expenses, c)} onPress={() => drill("expenses", {}, point)} />
          <DrillRow testID="analytics-chart-net" label="Net" value={signed(point.net, c)} valueColor={point.net < 0 ? colors.destructive : colors.primary}
             sub={t("Savings rate {rate}", { rate: pct(point.savingsRate) })} onPress={() => drill("movements", {}, point)} />
        </View>
      ) : points.length ? <Text style={[ui.small, { color: colors.mutedForeground }]}>{t("Tap a period to inspect its figures.")}</Text> : null}
    </Section>
  );
}

function Spending({ r, drill, colors }: { r: AnalyticsReport; drill: Drill; colors: Colors }) {
  const { t } = usePreferences();
  const [all, setAll] = useState(false);
  const c = r.query.currency;
  const shown = all ? r.categories : r.categories.slice(0, 6);
  const kindTotals = (Object.keys(SPENDING_LABELS) as (keyof typeof SPENDING_LABELS)[])
    .map(k => ({ k, n: r.categories.filter(x => x.kind === k).length })).filter(x => x.n);
  return (
    <Section testID="analytics-spending" eyebrow={t("Spending")} title={t("Where money went")}
      note={<NoteText>{t("Each recorded payment is counted once, under one category and one kind. Transfers, reconciliation adjustments, lent-loan funding and refunds are not spending.")}</NoteText>}>
      {r.categories.length === 0 ? <Text style={[ui.small, { color: colors.mutedForeground }]}>{t("No recorded spending in this period.")}</Text> : null}
      {kindTotals.length > 1 ? <Text style={[ui.small, { color: colors.mutedForeground }]}>{t("Includes {types}.", { types: kindTotals.map(x => t(SPENDING_LABELS[x.k])).join("، ") })}</Text> : null}
      {shown.map((cat, i) => (
        <View key={cat.key}>
          {i ? <Sep /> : null}
           <DrillRow testID={`analytics-category-${i}`} label={t(cat.name)} accent={colors.primary}
             sub={t("{kind} · {count} payments · {percent}%", { kind: t(SPENDING_LABELS[cat.kind]), count: formatAppNumber(cat.count), percent: formatAppNumber(cat.percentage, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}
            value={money(cat.amount, c)} share={cat.percentage} onPress={() => drill("expenses", { categoryKey: cat.key })} />
        </View>
      ))}
      {r.categories.length > 6 ? (
        <Pressable testID="analytics-categories-toggle" accessibilityRole="button" onPress={() => { tap(); setAll(a => !a); }}>
           <Text style={[ui.link, { color: colors.primary }]}>{all ? t("Show fewer") : t("Show all {count} categories", { count: formatAppNumber(r.categories.length) })}</Text>
        </Pressable>
      ) : null}
    </Section>
  );
}

function FixedVariable({ r, colors }: { r: AnalyticsReport; colors: Colors }) {
  const { t } = usePreferences();
  const c = r.query.currency, total = r.fixed + r.variable + r.unclassified || 1;
  const parts = [
    { l: "Fixed commitments", v: r.fixed, col: colors.primary, d: "Recurring expenses, EMIs and balloon payments that were actually paid." },
    { l: "Variable spending", v: r.variable, col: colors.accent, d: "Ordinary one-off everyday expenses." },
    { l: "Other outflows", v: r.unclassified, col: colors.mutedForeground, d: "Borrowed-loan repayments and savings contributions, when included." },
  ];
  return (
    <Section testID="analytics-fixed" eyebrow={t("Patterns")} title={t("Fixed versus variable")}
      note={<NoteText>{t("Classification uses transaction types and recurring definitions, never category names or amounts. It describes what was recorded, not a prediction.")}</NoteText>}>
      <View style={[st.stack, { backgroundColor: colors.muted }]}>
        {parts.map(p => p.v > 0 ? <View key={p.l} style={{ flex: p.v / total, backgroundColor: p.col }} /> : null)}
      </View>
      {parts.map(p => (
        <View key={p.l} style={[ui.between, { alignItems: "flex-start" }]}>
          <View style={[s.dot, { backgroundColor: p.col, marginTop: 6 }]} />
          <View style={{ flex: 1 }}>
            <Text style={[ui.bodyStrong, { color: colors.foreground }]}>{t(p.l)}</Text>
            <Text style={[ui.small, { color: colors.mutedForeground }]}>{t(p.d)}</Text>
          </View>
          <Text style={[ui.bodyStrong, ui.num, { color: colors.foreground }]}>{money(p.v, c)}</Text>
        </View>
      ))}
    </Section>
  );
}

function Income({ r, drill, colors }: { r: AnalyticsReport; drill: Drill; colors: Colors }) {
  const { t } = usePreferences();
  const c = r.query.currency;
  return (
    <Section testID="analytics-income-section" eyebrow={t("Income")} title={t("What you received")}
      note={<NoteText>{t("Received income is recorded income transactions in the period. The expected plan is your current monthly setup and is never added to cash flow.")}</NoteText>}>
      {r.incomeSources.length === 0 ? <Text style={[ui.small, { color: colors.mutedForeground }]}>{t("No received income recorded in this period.")}</Text> : null}
      {r.incomeSources.map((src, i) => (
        <View key={src.key}>
          {i ? <Sep /> : null}
           <DrillRow testID={`analytics-source-${i}`} label={src.name ? t(src.name) : t("Unknown source")} sub={t("{count} receipts", { count: formatAppNumber(src.count) })}
            value={money(src.amount, c)} onPress={() => drill("income", { sourceKey: src.key })} />
        </View>
      ))}
      <View style={[st.inset, { borderColor: colors.border, borderWidth: 1, borderStyle: "dashed" }]}>
        <View style={ui.between}>
           <Text style={[s.eyebrow, { color: colors.mutedForeground }]}>{t("Expected monthly plan")}</Text>
          <Text style={[ui.bodyStrong, ui.num, { color: colors.mutedForeground }]}>{money(r.expectedIncome, c)}</Text>
        </View>
         {r.expectedSources.length === 0 ? <Text style={[ui.small, { color: colors.mutedForeground }]}>{t("No planned {currency} income set up.", { currency: c })}</Text>
          : r.expectedSources.map(e => (
            <View key={e.id} style={ui.between}>
              <Text style={[ui.small, { color: colors.mutedForeground, flex: 1 }]} numberOfLines={1}>{e.name}</Text>
              <Text style={[ui.small, ui.num, { color: colors.mutedForeground }]}>{money(e.amount, c)}</Text>
            </View>
          ))}
         <Text style={[ui.small, { color: colors.mutedForeground }]}>{t("Planned, not received. Excluded from all actual figures.")}</Text>
      </View>
    </Section>
  );
}

function Health({ r, colors }: { r: AnalyticsReport; colors: Colors }) {
  const { t } = usePreferences();
  const h = r.health;
  const rows = [
    { l: "Savings rate", v: pct(h.savingsRate), d: "Positive net cash flow divided by received income." },
    { l: "Fixed commitments", v: pct(h.fixedBurden), d: "Paid recurring, EMI and balloon payments divided by received income." },
    { l: "Variable spending", v: pct(h.variableBurden), d: "Everyday one-off spending divided by received income." },
    { l: "Debt repayment burden", v: pct(h.debtBurden), d: r.query.includeDebt ? "EMI, balloon and borrowed-loan repayments divided by received income." : "Unavailable while debt repayments are excluded by report settings." },
    { l: "Cash-flow consistency", v: pct(h.consistency, 0), d: h.consistency === null ? `Needs at least 3 complete months; ${h.completeMonths} available.` : `Share of ${h.completeMonths} complete months with net cash flow at or above zero.` },
  ];
  return (
    <Section testID="analytics-health" eyebrow={t("Indicators")} title={t("Financial health")}
      note={<NoteText>{t("Each indicator is a single transparent ratio of your recorded figures. There is no combined score, and these are not financial advice. Unavailable means income is zero or history is too short.")}</NoteText>}>
      {rows.map((x, i) => (
        <View key={x.l}>
          {i ? <Sep /> : null}
          <View style={[ui.between, { paddingVertical: 8, alignItems: "flex-start" }]}>
            <View style={{ flex: 1 }}>
              <Text style={[ui.bodyStrong, { color: colors.foreground }]}>{t(x.l)}</Text>
              <Text style={[ui.small, { color: colors.mutedForeground, marginTop: 2 }]}>{t(x.d)}</Text>
            </View>
            <Text style={[ui.bodyStrong, ui.num, { color: x.v === "Unavailable" ? colors.mutedForeground : colors.foreground }]}>{x.v === "Unavailable" ? t("Unavailable") : x.v}</Text>
          </View>
        </View>
      ))}
    </Section>
  );
}

function NetWorth({ r, colors, topInset }: { r: AnalyticsReport; colors: Colors; topInset: number }) {
  const { t } = usePreferences();
  const nw = r.netWorth, c = nw.currency;
  const [modal, setModal] = useState<"assets" | "liabilities" | "all" | null>(null);
  const open = (m: "assets" | "liabilities" | "all") => { tap(); setModal(m); };
  const onItem = (i: NetWorthItem) => {
    setModal(null);
    if (i.kind === "account" || i.kind === "overdraft") router.push("/(tabs)/wallets" as never);
    else router.push({ pathname: "/(tabs)/loans", params: { loanId: i.id } } as never);
  };
  const items = modal === "assets" ? nw.assetItems : modal === "liabilities" ? nw.liabilityItems : [...nw.assetItems, ...nw.liabilityItems];
  const translateNotice = (notice: string) => {
    const history = notice.match(/^Your (.+) transaction history begins on (.+)\. Earlier financial activity may not be included\.$/);
    if (history) return t("Your {currency} transaction history begins on {date}. Earlier financial activity may not be included.", { currency: history[1], date: history[2] });
    const emptyHistory = notice.match(/^No recorded (.+) transaction history yet\. No earlier activity has been estimated\.$/);
    if (emptyHistory) return t("No recorded {currency} transaction history yet. No earlier activity has been estimated.", { currency: emptyHistory[1] });
    const receivables = notice.match(/^(\d+) lent-loan receivable\(s\) excluded because funding or principal allocation is not reliable\.$/);
    if (receivables) return t("{count} lent-loan receivables excluded because funding or principal allocation is not reliable.", { count: formatAppNumber(Number(receivables[1])) });
    return t(notice);
  };
  return (
    <Section testID="analytics-networth" eyebrow={t("Net worth")} title={t("Your recorded position today")}
      note={<View style={{ gap: 6 }}>{nw.notices.map(n => <NoteText key={n}>{translateNotice(n)}</NoteText>)}</View>}>
       <Pressable testID="analytics-networth-total" accessibilityRole="button" accessibilityLabel={t("Net worth {amount}. View breakdown", { amount: money(nw.netWorth, c) })} onPress={() => open("all")}>
        <Text style={[ui.hero, { color: nw.netWorth < 0 ? colors.destructive : colors.foreground }]}>{money(nw.netWorth, c)}</Text>
        <Text style={[ui.small, { color: colors.mutedForeground }]}>
           {nw.monthChange === null ? t("Month-over-month change appears once a snapshot from last month exists.") : t("{amount} since last month's snapshot", { amount: signed(nw.monthChange, c) })}
        </Text>
      </Pressable>
       {!nw.reliable ? <Text style={[ui.small, { color: colors.warning }]}>{t("Account balances need reconciliation; history tracking is paused.")}</Text> : null}
       {r.currencies.length > 1 ? <Text style={[ui.small, { color: colors.mutedForeground }]}>{t("Currency-specific total. A combined total is unavailable without conversion.")}</Text> : null}
       <DrillRow testID="analytics-networth-assets" label={t("Assets")} sub={t("{count} items{excluded}", { count: formatAppNumber(nw.assetItems.length), excluded: nw.excludedReceivables.length ? ` · ${t("{count} excluded", { count: formatAppNumber(nw.excludedReceivables.length) })}` : "" })}
        value={money(nw.assets, c)} onPress={() => open("assets")} />
      <Sep />
       <DrillRow testID="analytics-networth-liabilities" label={t("Liabilities")} sub={t("{count} items", { count: formatAppNumber(nw.liabilityItems.length) })}
        value={money(nw.liabilities, c)} onPress={() => open("liabilities")} />
      {nw.history.length >= 2 ? (
        <>
          <NetWorthLine history={nw.history} currency={c} />
          <Text style={[ui.small, { color: colors.mutedForeground }]}>{t("{count} observed snapshots since {date}. Gaps are not filled.", { count: formatAppNumber(nw.history.length), date: shortDate(nw.historyStart ?? "") })}</Text>
        </>
      ) : (
        <Text style={[ui.small, { color: colors.mutedForeground }]}>
           {nw.historyStart ? t("Tracking began {date}. A trend appears after a second observed day.", { date: shortDate(nw.historyStart) }) : t("History starts from your first reliable snapshot. Past balances are not reconstructed.")}
        </Text>
      )}
       <NetWorthModal open={modal !== null} title={t(modal === "assets" ? "Assets" : modal === "liabilities" ? "Liabilities" : "Net worth breakdown")}
        items={items} excluded={modal === "liabilities" ? undefined : nw.excludedReceivables} currency={c}
        onClose={() => setModal(null)} onItem={onItem} topInset={topInset} colors={colors} />
    </Section>
  );
}

function Exports({ report, colors }: { report: AnalyticsReport; colors: Colors }) {
  const { t } = usePreferences();
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (f: "csv" | "pdf") => {
    tap(); setBusy(f); setMsg(null);
    try { await exportAnalyticsReport(report, f); setMsg({ ok: true, text: t(f === "csv" ? "CSV ready." : Platform.OS === "web" ? "Print dialog opened. Choose Save as PDF." : "PDF ready to share.") }); }
    catch (e) { setMsg({ ok: false, text: t(e instanceof Error ? e.message : "Export failed. Try again.") }); }
    finally { setBusy(null); }
  };
  const btn = (f: "csv" | "pdf", label: string, icon: React.ComponentProps<typeof Feather>["name"]) => (
    <Pressable testID={`analytics-export-${f}`} accessibilityRole="button" accessibilityState={{ disabled: !!busy, busy: busy === f }} disabled={!!busy}
      onPress={() => run(f)} style={({ pressed }) => [st.exportBtn, { borderColor: colors.border, backgroundColor: colors.card, opacity: busy && busy !== f ? 0.5 : pressed ? 0.7 : 1 }]}>
      {busy === f ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name={icon} size={16} color={colors.primary} />}
      <Text style={[ui.bodyStrong, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 8 }}>
      <Text style={[s.eyebrow, { color: colors.mutedForeground }]}>{t("Export this exact report")}</Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {btn("csv", Platform.OS === "web" ? "Download CSV" : "Share CSV", "file-text")}
        {btn("pdf", Platform.OS === "web" ? "Print / Save PDF" : "Share PDF", "printer")}
      </View>
      {msg ? <Text testID="analytics-export-status" style={[ui.small, { color: msg.ok ? colors.success : colors.destructive }]}>{msg.text}</Text> : null}
    </View>
  );
}

export default function AnalyticsScreen() {
  const colors = useColors();
  const { t } = usePreferences();
  const insets = useSafeAreaInsets();
  const finance = useFinance();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const today = finance.calendarKey.slice(0, 10);

  const [preset, setPreset] = useState<PeriodPreset>("this");
  const [custom, setCustom] = useState<DateRange>({ from: `${today.slice(0, 7)}-01`, to: today });
  const [chosenCurrency, setCurrency] = useState<string>(finance.currency);
  const [includeDebt, setIncludeDebt] = useState(true);
  const [includeSavings, setIncludeSavings] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const result = useMemo((): { report: AnalyticsReport; label: string } | { error: string } => {
    try {
      const range = reportingRange(preset, today, preset === "custom" ? custom : undefined);
      const currency = chosenCurrency;
      return { label: range.label, report: buildAnalyticsReport(finance, { from: range.from, to: range.to, currency, includeDebt, includeSavings }, range.previous, today) };
    } catch (e) { return { error: e instanceof Error ? e.message : "Choose a valid date range." }; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finance.transactions, finance.accounts, finance.loans, finance.incomes, finance.expenses, finance.netWorthSnapshots, finance.currency, finance.reconciliationRequired, finance.calendarKey, preset, custom, chosenCurrency, includeDebt, includeSavings]);

  const report = "report" in result ? result.report : null;
  const translateReportNotice = (notice: string) => {
    const history = notice.match(/^Your (.+) transaction history begins on (.+)\. Earlier financial activity may not be included\.$/);
    if (history) return t("Your {currency} transaction history begins on {date}. Earlier financial activity may not be included.", { currency: history[1], date: history[2] });
    const emptyHistory = notice.match(/^No recorded (.+) transaction history yet\. No earlier activity has been estimated\.$/);
    if (emptyHistory) return t("No recorded {currency} transaction history yet. No earlier activity has been estimated.", { currency: emptyHistory[1] });
    return t(notice);
  };

  const drill: Drill = (type, extra = {}, range) => {
    if (!report) return;
    const q = report.query;
    const params: Record<string, string> = { from: range?.from ?? q.from, to: range?.to ?? q.to, currency: q.currency, analytics: type,
      includeDebt: q.includeDebt ? "1" : "0", includeSavings: q.includeSavings ? "1" : "0" };
    if (extra.categoryKey) params.categoryKey = extra.categoryKey;
    if (extra.sourceKey) params.sourceKey = extra.sourceKey;
    router.push({ pathname: "/transactions", params } as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title={t("Analytics")} subtitle={report ? `${t("label" in result ? result.label : "")} · ${shortDate(report.query.from)} ${t("to")} ${shortDate(report.query.to)}` : t("Choose a period")}
        topInset={topPad} colors={colors}
        leading={<HeaderAction icon="arrow-left" label={t("Back to Home")} variant="neutral" testID="analytics-back"
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} />}
        trailing={<HeaderAction icon="sliders" label={t("Report settings")} variant={settingsOpen ? "primary" : "neutral"} testID="analytics-settings"
          onPress={() => { tap(); setSettingsOpen(o => !o); }} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 + Math.max(insets.bottom, Platform.OS === "web" ? 34 : 0), gap: 16 }}
        showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Pressable testID="analytics-open-forecast" accessibilityRole="button" accessibilityLabel={t("Open cash flow forecast")}
          onPress={() => { tap(); router.push("/forecast"); }}
          style={({ pressed }) => [ui.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.78 : 1 }]}>
          <View style={ui.between}>
            <View style={[ui.row, { paddingVertical: 0, flex: 1 }]}>
              <View style={[ui.icon, { backgroundColor: colors.secondary }]}>
                <Feather name="trending-up" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ui.bodyStrong, { color: colors.foreground }]}>{t("Plan ahead")}</Text>
                <Text style={[ui.small, { color: colors.mutedForeground }]}>{t("Forecast balances and upcoming commitments")}</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
          </View>
        </Pressable>
        <View>
          <Chips prefix="analytics-period" value={preset} onChange={p => { tap(); setPreset(p); }} items={PERIODS} />
          {report && report.currencies.length > 1 ? (
            <Chips prefix="analytics-currency" value={report.query.currency} onChange={setCurrency} items={report.currencies.map(k => ({ key: k, label: k }))} />
          ) : null}
        </View>

        {report?.historyStart && report.query.from < report.historyStart ? (
          <Text testID="analytics-history-limitation" style={[ui.small, { color: colors.warning }]}>
            {t("Recorded history starts {date}. Earlier dates in this report are unavailable.", { date: shortDate(report.historyStart) })}
          </Text>
        ) : null}

        {preset === "custom" ? (
          <View style={[ui.card, { backgroundColor: colors.card, borderColor: colors.border, paddingTop: 0 }]}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Field label="From (YYYY-MM-DD)"><Input testID="analytics-custom-from" value={custom.from} autoCapitalize="none" maxLength={10}
                onChangeText={v => setCustom(c => ({ ...c, from: v.trim() }))} /></Field></View>
              <View style={{ flex: 1 }}><Field label="To (YYYY-MM-DD)"><Input testID="analytics-custom-to" value={custom.to} autoCapitalize="none" maxLength={10}
                onChangeText={v => setCustom(c => ({ ...c, to: v.trim() }))} /></Field></View>
            </View>
          </View>
        ) : null}

        {settingsOpen ? (
          <View testID="analytics-settings-panel" style={[ui.card, { backgroundColor: colors.card, borderColor: colors.border, paddingVertical: 4 }]}>
            <ToggleRow testID="analytics-setting-debt" label="Include debt repayments" hint="EMI, balloon and borrowed-loan repayments" value={includeDebt} onChange={setIncludeDebt} />
            <ToggleRow testID="analytics-setting-savings" label="Include savings contributions" hint="Money moved into savings goals" value={includeSavings} onChange={setIncludeSavings} />
          </View>
        ) : null}

        {"error" in result ? (
          <View testID="analytics-range-error" style={[st.inset, { backgroundColor: colors.errorLight }]}>
            <Text style={[ui.bodyStrong, { color: colors.destructive }]}>{t(result.error)}</Text>
            <Text style={[ui.small, { color: colors.destructive }]}>{t("No report is shown until the range is valid.")}</Text>
          </View>
        ) : report ? (
          <>
            <Overview r={report} drill={drill} colors={colors} />
            <CashFlow key={`${report.query.from}${report.query.to}${report.query.currency}`} r={report} drill={drill} colors={colors} />
            <Spending r={report} drill={drill} colors={colors} />
            <FixedVariable r={report} colors={colors} />
            <Income r={report} drill={drill} colors={colors} />
            <NetWorth r={report} colors={colors} topInset={topPad} />
            <Health r={report} colors={colors} />
            <Section testID="analytics-history" eyebrow={t("About this data")} title={report.historyStart ? t("History begins {date}", { date: shortDate(report.historyStart) }) : t("No recorded history yet")}
              note={<View style={{ gap: 6 }}>{report.notices.map(n => <NoteText key={n}>{translateReportNotice(n)}</NoteText>)}</View>}>
              <Text style={[ui.small, { color: colors.mutedForeground }]}>{t("Figures use recorded {currency} transactions only. Nothing before your history is estimated, and currencies are never combined.", { currency: report.query.currency })}</Text>
            </Section>
            <Exports report={report} colors={colors} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { borderWidth: 1, borderRadius: 22, padding: 20 },
  tile: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  tileValue: { fontSize: TYPOGRAPHY.sectionHeading + 2, fontFamily: "Inter_700Bold", fontVariant: ["tabular-nums"], letterSpacing: -0.3 },
  inset: { borderRadius: 14, padding: 14, gap: 6 },
  stack: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", gap: 2 },
  exportBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, borderRadius: 14, borderWidth: 1 },
});
