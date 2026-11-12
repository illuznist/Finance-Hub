import { Feather } from "@expo/vector-icons";
import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { HeaderAction, ScreenHeader } from "@/components/ScreenHeader";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { TYPOGRAPHY } from "@/constants/typography";
import { useFinance } from "@/context/FinanceContext";
import type { getBudgetView } from "@/finance/budgets";
import { useColors } from "@/hooks/useColors";
import { formatAppCurrency, formatAppDate, normalizeLocalizedNumberInput } from "@/i18n/localization";
import { usePreferences } from "@/context/PreferencesContext";

export type Colors = ReturnType<typeof useColors>;
export type BudgetView = ReturnType<typeof getBudgetView>;

export const usePlanning = useFinance;

export function money(value: number, currency: string): string {
  return formatAppCurrency(value, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function shortDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return formatAppDate(value, { day: "numeric", month: "short", year: "numeric" });
}

export function monthTitle(month: string): string {
  return formatAppDate(`${month}-01`, { month: "long", year: "numeric" });
}

export function parseMoney(text: string, allowZero = false): number | null {
  const t = normalizeLocalizedNumberInput(text.trim());
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && (allowZero ? n >= 0 : n > 0) ? n : null;
}

/** Shared threshold tone: <75 normal, 75 approaching, 90 near, 100 exceeded. */
export function statusTone(status: string, colors: Colors) {
  switch (status) {
    case "exceeded": return { color: colors.destructive, bg: colors.errorLight, label: "Exceeded" };
    case "near": return { color: colors.warning, bg: colors.warningLight, label: "Near limit" };
    case "approaching": return { color: colors.warning, bg: colors.warningLight, label: "Approaching" };
    case "unset": return { color: colors.mutedForeground, bg: colors.muted, label: "No limit" };
    default: return { color: colors.primary, bg: colors.secondary, label: "On track" };
  }
}

export function Chips<T extends string>({ items, value, onChange, prefix }: {
  items: { key: T; label: string }[]; value: T; onChange: (v: T) => void; prefix: string;
}) {
  const colors = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ui.chips}>
      {items.map(i => {
        const active = i.key === value;
        return (
          <Pressable key={i.key} testID={`${prefix}-${i.key}`} accessibilityRole="button" accessibilityState={{ selected: active }}
            onPress={() => onChange(i.key)}
            style={[ui.chip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}>
            <Text style={[ui.chipText, { color: active ? colors.primaryForeground : colors.foreground }]}>{i.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  const colors = useColors();
  const { t } = usePreferences();
  const translatedLabel = /\bdate\b/i.test(label)
    ? `${t(label)} · ${t("Gregorian date")}`
    : t(label);
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={[ui.label, { color: colors.mutedForeground, marginBottom: 6 }]}>{translatedLabel}</Text>
      {children}
      {error ? <Text style={[ui.small, { color: colors.destructive, marginTop: 6 }]}>{t(error)}</Text>
        : hint ? <Text style={[ui.small, { color: colors.mutedForeground, marginTop: 6 }]}>{t(hint)}</Text> : null}
    </View>
  );
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  const colors = useColors();
  const { style, ...rest } = props;
  return <TextInput placeholderTextColor={colors.mutedForeground} {...rest}
    style={[ui.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }, style]} />;
}

export function ToggleRow({ label, hint, value, onChange, testID }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; testID: string }) {
  const colors = useColors();
  const { t } = usePreferences();
  return (
    <View style={[ui.toggleRow, { borderBottomColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[ui.body, { color: colors.foreground }]}>{t(label)}</Text>
        {hint ? <Text style={[ui.small, { color: colors.mutedForeground, marginTop: 2 }]}>{t(hint)}</Text> : null}
      </View>
      <Switch testID={testID} accessibilityLabel={label} value={value} onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.muted }} thumbColor={colors.card} />
    </View>
  );
}

export function Button({ label, onPress, tone = "primary", testID, disabled, style }: {
  label: string; onPress: () => void; tone?: "primary" | "neutral" | "danger"; testID?: string; disabled?: boolean; style?: object;
}) {
  const colors = useColors();
  const { t } = usePreferences();
  const bg = tone === "primary" ? colors.primary : tone === "danger" ? colors.errorLight : colors.muted;
  const fg = tone === "primary" ? colors.primaryForeground : tone === "danger" ? colors.destructive : colors.foreground;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [ui.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }, style]}>
      <Text style={[ui.btnText, { color: fg }]}>{t(label)}</Text>
    </Pressable>
  );
}

export function Progress({ pct, color }: { pct: number; color: string }) {
  const colors = useColors();
  return (
    <View style={[ui.track, { backgroundColor: colors.muted }]}>
      <View style={[ui.fill, { width: `${Math.max(0, Math.min(100, pct))}%`, backgroundColor: color }]} />
    </View>
  );
}

export function FormModal({ title, topInset, bottomInset, onClose, testID, children, footer, translateTitle = false }: {
  title: string; topInset: number; bottomInset: number; onClose: () => void; testID: string; children: React.ReactNode; footer?: React.ReactNode; translateTitle?: boolean;
}) {
  const colors = useColors();
  return (
    <Modal visible animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }} testID={testID}>
        <ScreenHeader title={title} translateTitle={translateTitle} topInset={topInset} colors={colors}
          leading={<HeaderAction icon="x" label="Cancel" variant="neutral" testID={`${testID}-cancel`} onPress={onClose} />} />
        <KeyboardAwareScrollViewCompat contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 32 }} bottomOffset={24}>
          {children}
          {footer}
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
  );
}

export function EmptyBlock({ icon, title, body, children }: { icon: React.ComponentProps<typeof Feather>["name"]; title: string; body: string; children?: React.ReactNode }) {
  const colors = useColors();
  const { t } = usePreferences();
  return (
    <View style={[ui.empty, { borderColor: colors.border }]}>
      <Feather name={icon} size={22} color={colors.mutedForeground} />
      <Text style={[ui.cardTitle, { color: colors.foreground }]}>{t(title)}</Text>
      <Text style={[ui.small, { color: colors.mutedForeground, textAlign: "center" }]}>{t(body)}</Text>
      {children}
    </View>
  );
}

export const ui = StyleSheet.create({
  chips: { gap: 8, paddingVertical: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_500Medium" },
  label: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium", letterSpacing: 0.2 },
  small: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", lineHeight: 17 },
  body: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_400Regular" },
  bodyStrong: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_600SemiBold" },
  cardTitle: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_600SemiBold" },
  section: { fontSize: TYPOGRAPHY.sectionHeading, fontFamily: "Inter_700Bold", marginTop: 24, marginBottom: 10 },
  hero: { fontSize: TYPOGRAPHY.heroValue, fontFamily: "Inter_700Bold", fontVariant: ["tabular-nums"], letterSpacing: -0.6 },
  num: { fontVariant: ["tabular-nums"] },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: TYPOGRAPHY.body, fontFamily: "Inter_400Regular" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  btn: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  btnText: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_600SemiBold" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sep: { height: StyleSheet.hairlineWidth },
  icon: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", gap: 8, padding: 24, borderWidth: 1, borderStyle: "dashed", borderRadius: 18, marginTop: 8 },
  link: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_600SemiBold" },
});
