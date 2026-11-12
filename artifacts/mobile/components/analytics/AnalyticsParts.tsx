import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";

import { money, shortDate, ui, type Colors } from "@/components/PlanningUI";
import { TYPOGRAPHY } from "@/constants/typography";
import type { CashFlowPoint, NetWorthItem, NetWorthSnapshot } from "@/finance/analyticsTypes";
import { useColors } from "@/hooks/useColors";
import { usePreferences } from "@/context/PreferencesContext";
import { formatAppNumber } from "@/i18n/localization";

export const tap = () => { if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {}); };

export function pct(v: number | null, digits = 1): string {
  return v === null || !Number.isFinite(v) ? "Unavailable" : `${formatAppNumber(v, { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

/** Card with an eyebrow label, title and optional expandable explanation. */
export function Section({ eyebrow, title, children, note, testID }: { eyebrow: string; title: string; children: React.ReactNode; note?: React.ReactNode; testID?: string }) {
  const colors = useColors();
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  return (
    <View testID={testID} style={[ui.card, s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={ui.between}>
        <View style={{ flex: 1 }}>
          <Text style={[s.eyebrow, { color: colors.primary }]}>{t(eyebrow)}</Text>
          <Text style={[ui.cardTitle, { color: colors.foreground, marginTop: 2 }]}>{t(title)}</Text>
        </View>
        {note ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t(open ? "Hide explanation" : "How this is calculated")} hitSlop={8}
            testID={testID ? `${testID}-explain` : undefined}
            onPress={() => { tap(); setOpen(o => !o); }}
            style={[s.infoBtn, { backgroundColor: open ? colors.secondary : "transparent", borderColor: colors.border }]}>
            <Feather name={open ? "x" : "info"} size={14} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      {open && note ? <View style={[s.note, { backgroundColor: colors.secondary }]}>{note}</View> : null}
      {children}
    </View>
  );
}

export function NoteText({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <Text style={[ui.small, { color: colors.secondaryForeground }]}>{children}</Text>;
}

/** Tappable row that drills into the supporting records. */
export function DrillRow({ label, sub, value, valueColor, onPress, testID, accent, share }: {
  label: string; sub?: string; value: string; valueColor?: string; onPress?: () => void; testID?: string; accent?: string; share?: number;
}) {
  const colors = useColors();
  const { isRTL, t } = usePreferences();
  return (
    <Pressable testID={testID} disabled={!onPress} accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={t("{label}, {value}{sub}", { label, value, sub: sub ? `, ${sub}` : "" })}
      onPress={() => { tap(); onPress?.(); }}
      style={({ pressed }) => [s.drill, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={ui.between}>
        {accent ? <View style={[s.dot, { backgroundColor: accent }]} /> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={[ui.bodyStrong, { color: colors.foreground }]}>{label}</Text>
          {sub ? <Text numberOfLines={1} style={[ui.small, { color: colors.mutedForeground, marginTop: 2 }]}>{sub}</Text> : null}
        </View>
        <Text style={[ui.bodyStrong, ui.num, { color: valueColor ?? colors.foreground }]}>{value}</Text>
        {onPress ? <Feather name={isRTL ? "chevron-left" : "chevron-right"} size={16} color={colors.mutedForeground} /> : null}
      </View>
      {share !== undefined ? (
        <View style={[ui.track, { backgroundColor: colors.muted, marginTop: 8, height: 4 }]}>
          <View style={{ height: 4, borderRadius: 2, width: `${Math.max(0, Math.min(100, share))}%`, backgroundColor: accent ?? colors.primary }} />
        </View>
      ) : null}
    </Pressable>
  );
}

export function Sep() { const c = useColors(); return <View style={[ui.sep, { backgroundColor: c.border }]} />; }

const BAR_H = 140;
/** Zero-baselined grouped bars: income, expenses, signed net. Only real points are drawn. */
export function CashFlowChart({ points, currency, selected, onSelect }: {
  points: CashFlowPoint[]; currency: string; selected: string | null; onSelect: (k: string) => void;
}) {
  const colors = useColors();
  const { t } = usePreferences();
  const top = Math.max(0, ...points.flatMap(p => [p.income, p.expenses, p.net]));
  const bottom = Math.min(0, ...points.map(p => p.net));
  const span = top - bottom || 1;
  const zero = BAR_H * (top / span);
  const bar = (v: number, color: string, faded: boolean) => {
    const h = Math.abs(v) / span * BAR_H;
    return <View style={[s.bar, { height: Math.max(v === 0 ? 0 : 2, h), backgroundColor: color, opacity: faded ? 0.35 : 1,
      top: v >= 0 ? zero - h : zero, borderRadius: 3 }]} />;
  };
  return (
    <View>
      <View style={s.legend}>
        {[["Income", colors.primary], ["Expenses", colors.mutedForeground], ["Net", colors.accent]].map(([l, c]) => (
          <View key={l} style={s.legendItem}><View style={[s.dot, { backgroundColor: c }]} /><Text style={[ui.small, { color: colors.mutedForeground }]}>{t(l)}</Text></View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flexDirection: "row", flexGrow: 1, minHeight: BAR_H + 30 }}>
          <View style={[s.zeroLine, { top: zero, backgroundColor: colors.border }]} />
          {points.map(p => {
            const active = selected === p.key, faded = selected !== null && !active;
            return (
              <Pressable key={p.key} testID={`analytics-chart-${p.key}`} accessibilityRole="button" accessibilityState={{ selected: active }}
                 accessibilityLabel={t("{period}{partial}: income {income}, expenses {expenses}, net {net}", { period: p.label, partial: p.partial ? ` ${t("partial")}` : "", income: money(p.income, currency), expenses: money(p.expenses, currency), net: money(p.net, currency) })}
                onPress={() => { tap(); onSelect(p.key); }} style={[s.group, active && { backgroundColor: colors.secondary }]}>
                <View style={{ height: BAR_H, width: 36, flexDirection: "row", justifyContent: "center", gap: 2 }}>
                  <View style={s.slot}>{bar(p.income, colors.primary, faded)}</View>
                  <View style={s.slot}>{bar(p.expenses, colors.mutedForeground, faded)}</View>
                  <View style={s.slot}>{bar(p.net, p.net < 0 ? colors.destructive : colors.accent, faded)}</View>
                </View>
                <Text style={[s.axis, { color: active ? colors.primary : colors.mutedForeground }]}>{p.label}{p.partial ? "*" : ""}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {points.some(p => p.partial) ? <Text style={[ui.small, { color: colors.mutedForeground, marginTop: 6 }]}>{t("* Partial period: clipped by your range, history start or today.")}</Text> : null}
    </View>
  );
}

/** Observed snapshots only, plotted on real calendar time. */
export function NetWorthLine({ history, currency }: { history: NetWorthSnapshot[]; currency: string }) {
  const colors = useColors();
  const { t } = usePreferences();
  const [w, setW] = useState(0);
  const H = 110, pad = 8;
  const timestamps = history.map(h => Date.parse(`${h.date}T00:00:00`));
  const vals = history.map(h => h.netWorth);
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals), span = hi - lo || 1;
  const t0 = timestamps[0], tSpan = (timestamps[timestamps.length - 1] - t0) || 1;
  const x = (i: number) => pad + (timestamps[i] - t0) / tSpan * (w - pad * 2);
  const y = (v: number) => pad + (hi - v) / span * (H - pad * 2);
  const last = history[history.length - 1];
  return (
    <View accessible accessibilityLabel={t("Net worth history from {from} to {to}, {count} observed snapshots, latest {amount}", { from: shortDate(history[0].date), to: shortDate(last.date), count: formatAppNumber(history.length), amount: money(last.netWorth, currency) })}
      onLayout={e => setW(e.nativeEvent.layout.width)} style={{ height: H, marginTop: 8 }}>
      {w > 0 ? (
        <Svg width={w} height={H}>
          <Line x1={pad} x2={w - pad} y1={y(0)} y2={y(0)} stroke={colors.border} strokeWidth={1} />
          <Polyline points={history.map((h, i) => `${x(i)},${y(h.netWorth)}`).join(" ")} fill="none" stroke={colors.primary} strokeWidth={2} />
          {history.map((h, i) => <Circle key={h.date} cx={x(i)} cy={y(h.netWorth)} r={3} fill={colors.primary} />)}
        </Svg>
      ) : null}
      <View style={[ui.between, { marginTop: 2 }]}>
        <Text style={[ui.small, { color: colors.mutedForeground }]}>{shortDate(history[0].date)}</Text>
        <Text style={[ui.small, { color: colors.mutedForeground }]}>{shortDate(last.date)}</Text>
      </View>
    </View>
  );
}

const KIND_LABEL: Record<NetWorthItem["kind"], string> = { account: "Account", receivable: "Lent loan receivable", borrowed: "Borrowed loan", overdraft: "Overdrawn account" };

export function NetWorthModal({ open, title, items, excluded, currency, onClose, onItem, topInset, colors }: {
  open: boolean; title: string; items: NetWorthItem[]; excluded?: { id: string; name: string; reason: string }[];
  currency: string; onClose: () => void; onItem: (i: NetWorthItem) => void; topInset: number; colors: Colors;
}) {
  const { t } = usePreferences();
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose} transparent>
      <View style={[s.backdrop]}>
        <View testID="analytics-networth-modal" style={[s.sheet, { backgroundColor: colors.background, marginTop: topInset + 40 }]}>
          <View style={[ui.between, { marginBottom: 8 }]}>
            <Text style={[ui.cardTitle, { color: colors.foreground, fontSize: TYPOGRAPHY.dialogTitle }]}>{title}</Text>
            <Pressable testID="analytics-networth-close" accessibilityRole="button" accessibilityLabel={t("Close")} onPress={onClose} hitSlop={8}
              style={[s.infoBtn, { borderColor: colors.border, width: 36, height: 36, borderRadius: 18 }]}>
              <Feather name="x" size={18} color={colors.foreground} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            {items.length === 0 ? <Text style={[ui.small, { color: colors.mutedForeground, paddingVertical: 12 }]}>{t("Nothing recorded in {currency}.", { currency })}</Text> : null}
            {items.map((i, n) => (
              <View key={`${i.kind}-${i.id}`}>
                {n ? <Sep /> : null}
                <DrillRow testID={`analytics-networth-item-${i.id}`} label={i.name} sub={t(KIND_LABEL[i.kind])} value={money(i.amount, currency)} onPress={() => onItem(i)} />
              </View>
            ))}
            {excluded?.length ? (
              <>
                <Text style={[s.eyebrow, { color: colors.mutedForeground, marginTop: 20, marginBottom: 6 }]}>{t("Excluded from total")}</Text>
                {excluded.map(e => (
                  <View key={e.id} style={{ paddingVertical: 8 }}>
                    <Text style={[ui.bodyStrong, { color: colors.foreground }]}>{e.name}</Text>
                    <Text style={[ui.small, { color: colors.mutedForeground, marginTop: 2 }]}>{t(e.reason)}</Text>
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export const s = StyleSheet.create({
  section: { gap: 12 },
  eyebrow: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  infoBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  note: { borderRadius: 12, padding: 12, gap: 6 },
  drill: { paddingVertical: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legend: { flexDirection: "row", gap: 14, marginBottom: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  zeroLine: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth },
  group: { flex: 1, minWidth: 48, alignItems: "center", borderRadius: 10, paddingTop: 0, paddingBottom: 6 },
  slot: { width: 10, height: BAR_H },
  bar: { position: "absolute", left: 0, right: 0 },
  axis: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 6 },
  backdrop: { flex: 1, backgroundColor: "rgba(7,10,18,0.45)", justifyContent: "flex-end" },
  sheet: { flex: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
});
