import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ScreenHeader } from "@/components/ScreenHeader";
import { type Account, type EMI, type EMIPayment, useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { SkeletonEMICard } from "@/components/Skeleton";
import { useColors } from "@/hooks/useColors";
import { TYPOGRAPHY } from "@/constants/typography";

const TAB_BAR_HEIGHT = 90;
const DONUT_SIZE = 106;
const STROKE_WIDTH = 12;
const RADIUS = (DONUT_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = DONUT_SIZE / 2;
const CATEGORIES = [
  { id: "vehicle", label: "Vehicle" },
  { id: "personal", label: "Personal" },
  { id: "home", label: "Home" },
  { id: "other", label: "Other" },
] as const;

function fmt(amount: number, currency: string): string {
  return `${currency} ${Math.max(0, amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function todayString(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function displayDate(value?: string): string {
  if (!value || !isValidDate(value)) return "Not set";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function emiMonthly(emi: EMI): number {
  return emi.monthlyEMIAmount ?? emi.monthlyAmount;
}

function emiDuration(emi: EMI): number {
  return emi.durationMonths ?? emi.totalInstallments;
}

function emiPaidCount(emi: EMI): number {
  return Math.min(emiDuration(emi), emi.paidInstallments ?? 0);
}

function balloonPaid(emi: EMI): number {
  return (emi.paymentHistory ?? [])
    .filter((payment) => payment.paymentType === "balloon" && payment.status === "paid")
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function balloonRemaining(emi: EMI): number {
  return Math.max(0, (emi.balloonPaymentAmount ?? 0) - balloonPaid(emi));
}

function monthlyPaid(emi: EMI): number {
  return emiPaidCount(emi) * emiMonthly(emi);
}

function allPaid(emi: EMI): number {
  return (emi.paymentHistory ?? []).reduce((sum, payment) => sum + payment.amount, 0);
}

function monthlyRemaining(emi: EMI): number {
  return Math.max(0, (emiDuration(emi) - emiPaidCount(emi)) * emiMonthly(emi));
}

function isPlanActive(emi: EMI): boolean {
  return emiPaidCount(emi) < emiDuration(emi) || balloonRemaining(emi) > 0;
}

function nextMonthlyPaymentDate(emi: EMI): string | undefined {
  const first = emi.firstPaymentDate;
  if (!first || !isValidDate(first)) return undefined;
  let index = emiPaidCount(emi);
  const [year, month, day] = first.split("-").map(Number);
  const atIndex = (offset: number) => {
    const monthStart = new Date(year, month - 1 + offset, 1);
    const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const scheduledDay = offset === 0 ? day : (emi.paymentDueDay ?? emi.dueDayOfMonth ?? day);
    return new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(scheduledDay, lastDay));
  };
  let next = atIndex(index);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (next < today && index < emiDuration(emi)) {
    index += 1;
    next = atIndex(index);
  }
  if (index >= emiDuration(emi)) return undefined;
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

function getLinkedAccount(emi: EMI, accounts: Account[]): Account | undefined {
  return accounts.find((account) => account.id === emi.linkedAccountId);
}

function DonutChart({ progress, color, bgColor }: { progress: number; color: string; bgColor: string }) {
  const offset = CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, progress)));
  return (
    <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
      <Circle cx={CENTER} cy={CENTER} r={RADIUS} stroke={bgColor} strokeWidth={STROKE_WIDTH} fill="none" />
      <Circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        fill="none"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${CENTER}, ${CENTER}`}
      />
    </Svg>
  );
}

function SummaryMetric({ label, value, icon, color }: { label: string; value: string; icon: React.ComponentProps<typeof Feather>["name"]; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.metric, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.metricIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon} size={15} color={color} />
      </View>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function EMICard({ emi, currency, account, onOpen, onQuickPay }: {
  emi: EMI;
  currency: string;
  account?: Account;
  onOpen: () => void;
  onQuickPay: () => void;
}) {
  const colors = useColors();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;
  const paidCount = emiPaidCount(emi);
  const duration = emiDuration(emi);
  const remainingCount = Math.max(0, duration - paidCount);
  const monthlyAmount = emiMonthly(emi);
  const progress = duration > 0 ? paidCount / duration : 0;
  const nextDate = nextMonthlyPaymentDate(emi);
  const monthlyComplete = remainingCount === 0;
  const balloonBalance = balloonRemaining(emi);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 100, friction: 14, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${emi.name} details`}
        testID={`emi-card-${emi.id}`}
        onPress={onOpen}
        style={[styles.emiCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleGroup}>
            <View style={[styles.emiIcon, { backgroundColor: emi.color + "20" }]}>
              <Feather name={emi.iconName as React.ComponentProps<typeof Feather>["name"]} size={20} color={emi.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[styles.emiName, { color: colors.foreground }]}>{emi.name}</Text>
              <Text numberOfLines={1} style={[styles.emiDue, { color: colors.mutedForeground }]}>
                {emi.financeProvider || "Finance plan"} · {CATEGORIES.find((item) => item.id === emi.category)?.label ?? "Other"}
              </Text>
            </View>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>

        <View style={styles.chartRow}>
          <View style={styles.donutWrap}>
            <DonutChart
              progress={progress}
              color={monthlyComplete ? colors.success : emi.color}
              bgColor={colors.muted}
            />
            <View style={styles.donutCenter}>
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.donutAmount, { color: colors.foreground }]}>
                {fmt(monthlyAmount, currency)}
              </Text>
              <Text style={[styles.donutLabel, { color: colors.mutedForeground }]}>monthly</Text>
            </View>
          </View>
          <View style={styles.emiStats}>
            <StatRow label="Installments" value={`${paidCount} / ${duration} paid`} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <StatRow label="Monthly balance" value={fmt(monthlyRemaining(emi), currency)} />
            {balloonBalance > 0 && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <StatRow label="Balloon balance" value={fmt(balloonBalance, currency)} highlight={colors.warning} />
              </>
            )}
          </View>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: monthlyComplete ? colors.success : emi.color }]} />
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.badgeWrap}>
            {emi.autoDebitEnabled && (
              <View style={[styles.badge, { backgroundColor: colors.successLight }]}>
                <Feather name="repeat" size={11} color={colors.success} />
                <Text style={[styles.badgeText, { color: colors.success }]}>Auto-debit</Text>
              </View>
            )}
            {balloonBalance > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.warningLight }]}>
                <Feather name="flag" size={11} color={colors.warning} />
                <Text style={[styles.badgeText, { color: colors.warning }]}>Balloon</Text>
              </View>
            )}
          </View>
          <Text numberOfLines={1} style={[styles.nextDate, { color: colors.mutedForeground }]}>
            {monthlyComplete ? "Monthly plan complete" : `Next ${displayDate(nextDate)}`}
          </Text>
        </View>
        {account && emi.autoDebitEnabled && (
          <Text style={[styles.accountCaption, { color: colors.mutedForeground }]}>
            Deducts {fmt(monthlyAmount, currency)} from {account.name}
          </Text>
        )}
        {!monthlyComplete && (
          <Pressable
            accessibilityRole="button"
            testID={`emi-mark-paid-${emi.id}`}
            onPress={(event) => {
              event.stopPropagation();
              onQuickPay();
            }}
            style={[styles.quickPay, { backgroundColor: colors.successLight, borderColor: colors.success + "40" }]}
          >
            <Feather name="check-circle" size={16} color={colors.success} />
            <Text style={[styles.quickPayText, { color: colors.success }]}>Confirm monthly payment</Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  const colors = useColors();
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.statValue, { color: highlight ?? colors.foreground }]}>{value}</Text>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, testID }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "decimal-pad";
  multiline?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        testID={testID}
        style={[
          styles.input,
          multiline && styles.multilineInput,
          { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border },
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? "default"}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        autoCapitalize={label.toLowerCase().includes("date") ? "none" : "sentences"}
      />
    </View>
  );
}

function SectionLabel({ title }: { title: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{title}</Text>;
}

function ToggleRow({ label, detail, value, onToggle }: { label: string; detail: string; value: boolean; onToggle: () => void }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={onToggle} style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
        <Text style={[styles.toggleDetail, { color: colors.mutedForeground }]}>{detail}</Text>
      </View>
      <View style={[styles.toggleTrack, { backgroundColor: value ? colors.primary : colors.border }]}>
        <View style={[styles.toggleThumb, { alignSelf: value ? "flex-end" : "flex-start", backgroundColor: colors.primaryForeground }]} />
      </View>
    </Pressable>
  );
}

function EMIFormModal({ visible, onClose, editing }: { visible: boolean; onClose: () => void; editing?: EMI }) {
  const colors = useColors();
  const finance = useFinance();
  const toast = useToast();
  const initialStart = editing?.startDate ?? todayString();
  const [name, setName] = useState(editing?.name ?? "");
  const [provider, setProvider] = useState(editing?.financeProvider ?? "");
  const [category, setCategory] = useState<string>(editing?.category ?? "other");
  const [financedAmount, setFinancedAmount] = useState(String(editing?.financedAmount ?? editing?.totalAmount ?? ""));
  const [monthlyAmount, setMonthlyAmount] = useState(String(editing?.monthlyEMIAmount ?? editing?.monthlyAmount ?? ""));
  const [duration, setDuration] = useState(String(editing?.durationMonths ?? editing?.totalInstallments ?? ""));
  const [startDate, setStartDate] = useState(initialStart);
  const [firstPaymentDate, setFirstPaymentDate] = useState(editing?.firstPaymentDate ?? initialStart);
  const [dueDay, setDueDay] = useState(String(editing?.paymentDueDay ?? editing?.dueDayOfMonth ?? 7));
  const [hasBalloon, setHasBalloon] = useState((editing?.balloonPaymentAmount ?? 0) > 0);
  const [balloonAmount, setBalloonAmount] = useState(String(editing?.balloonPaymentAmount ?? ""));
  const [balloonDueDate, setBalloonDueDate] = useState(editing?.balloonPaymentDueDate ?? "");
  const [autoDebit, setAutoDebit] = useState(Boolean(editing?.autoDebitEnabled));
  const [accountId, setAccountId] = useState(editing?.linkedAccountId ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState("");
  const selectableAccounts = finance.accounts.filter((account) => account.type === "bank" || account.type === "cash");

  function submit() {
    const amount = Number(financedAmount);
    const monthly = Number(monthlyAmount);
    const months = Number(duration);
    const day = Number(dueDay);
    const balloon = hasBalloon ? Number(balloonAmount) : 0;
    if (!name.trim()) return setError("Enter a name for this plan.");
    if (!Number.isFinite(amount) || amount <= 0) return setError("Financed amount must be greater than zero.");
    if (!Number.isFinite(monthly) || monthly <= 0) return setError("Monthly EMI must be greater than zero.");
    if (!Number.isInteger(months) || months <= 0) return setError("Duration must be a positive number of months.");
    if (editing && months < emiPaidCount(editing)) return setError("Duration cannot be less than installments already paid.");
    if (!Number.isInteger(day) || day < 1 || day > 31) return setError("Payment due day must be between 1 and 31.");
    if (!isValidDate(startDate) || !isValidDate(firstPaymentDate)) return setError("Enter valid dates in YYYY-MM-DD format.");
    if (firstPaymentDate < startDate) return setError("First payment date cannot be before the start date.");
    if (hasBalloon && (!Number.isFinite(balloon) || balloon <= 0)) return setError("Balloon amount must be greater than zero.");
    if (hasBalloon && (!isValidDate(balloonDueDate) || balloonDueDate < startDate)) {
      return setError("Balloon due date must be valid and cannot precede the start date.");
    }
    if (autoDebit && !selectableAccounts.some((account) => account.id === accountId)) {
      return setError("Choose a bank account or wallet for auto-debit tracking.");
    }

    const shared = {
      name: name.trim(),
      financeProvider: provider.trim() || "Finance provider",
      category,
      financedAmount: amount,
      monthlyEMIAmount: monthly,
      durationMonths: months,
      startDate,
      firstPaymentDate,
      paymentDueDay: day,
      balloonPaymentAmount: balloon,
      balloonPaymentDueDate: hasBalloon ? balloonDueDate : undefined,
      linkedAccountId: autoDebit ? accountId : undefined,
      autoDebitEnabled: autoDebit,
      notes: notes.trim(),
      totalAmount: amount,
      monthlyAmount: monthly,
      totalInstallments: months,
      paidInstallments: editing ? emiPaidCount(editing) : 0,
      startMonth: startDate.slice(0, 7),
      dueDayOfMonth: day,
      color: editing?.color ?? colors.primary,
      iconName: editing?.iconName ?? (category === "vehicle" ? "truck" : category === "home" ? "home" : "credit-card"),
    };

    if (editing) {
      finance.updateEMI(editing.id, shared);
      toast.show("EMI plan updated");
    } else {
      finance.addEMI({
        ...shared,
        paymentHistory: [],
        createdAt: new Date().toISOString(),
      });
      toast.show("EMI plan added");
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.formSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editing ? "Edit EMI plan" : "Add EMI plan"}</Text>
            <Pressable accessibilityLabel="Close form" testID="emi-form-close" onPress={onClose} hitSlop={10}>
              <Feather name="x" size={21} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <KeyboardAwareScrollViewCompat
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled"
            bottomOffset={72}
            showsVerticalScrollIndicator={false}
          >
            <SectionLabel title="Financing details" />
            <Field label="EMI / loan name" value={name} onChangeText={setName} placeholder="e.g. Vehicle finance" />
            <Field label="Bank or finance provider" value={provider} onChangeText={setProvider} placeholder="e.g. Al Rajhi" />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Financing category</Text>
            <View style={styles.chipRow}>
              {CATEGORIES.map((item) => {
                const selected = category === item.id;
                return (
                  <Pressable key={item.id} onPress={() => setCategory(item.id)} style={[styles.choiceChip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.secondary : colors.muted }]}>
                    <Text style={[styles.choiceText, { color: selected ? colors.primary : colors.mutedForeground }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Field label={`Original financed amount (${finance.currency})`} value={financedAmount} onChangeText={setFinancedAmount} placeholder="100000" keyboardType="decimal-pad" />

            <SectionLabel title="Repayment details" />
            <View style={styles.twoFields}>
              <View style={{ flex: 1 }}><Field label={`Monthly EMI (${finance.currency})`} value={monthlyAmount} onChangeText={setMonthlyAmount} placeholder="2500" keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Duration (months)" value={duration} onChangeText={setDuration} placeholder="48" keyboardType="numeric" /></View>
            </View>
            <Field label="Start date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} placeholder="2026-01-01" />
            <Field label="First payment date (YYYY-MM-DD)" value={firstPaymentDate} onChangeText={setFirstPaymentDate} placeholder="2026-02-01" />
            <Field label="Payment due day (1–31)" value={dueDay} onChangeText={setDueDay} placeholder="7" keyboardType="numeric" />

            <SectionLabel title="Final payment" />
            <ToggleRow label="Balloon payment" detail="Track a separate final lump-sum payment" value={hasBalloon} onToggle={() => setHasBalloon((value) => !value)} />
            {hasBalloon && (
              <>
                <Field label={`Balloon amount (${finance.currency})`} value={balloonAmount} onChangeText={setBalloonAmount} placeholder="15000" keyboardType="decimal-pad" />
                <Field label="Balloon due date (YYYY-MM-DD)" value={balloonDueDate} onChangeText={setBalloonDueDate} placeholder="2030-01-01" />
              </>
            )}

            <SectionLabel title="Bank deduction" />
            <ToggleRow label="Auto-debit tracking" detail="Track an expected bank deduction; confirm it manually" value={autoDebit} onToggle={() => setAutoDebit((value) => !value)} />
            {autoDebit && (
              <View style={styles.accountChoices}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Linked bank account or wallet</Text>
                {selectableAccounts.length === 0 ? (
                  <Text style={[styles.helperText, { color: colors.mutedForeground }]}>Add a bank account or wallet in Wallets first.</Text>
                ) : selectableAccounts.map((account) => {
                  const selected = accountId === account.id;
                  return (
                    <Pressable key={account.id} onPress={() => setAccountId(account.id)} style={[styles.accountChoice, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.secondary : colors.muted }]}>
                      <Feather name={account.type === "bank" ? "briefcase" : "credit-card"} size={15} color={selected ? colors.primary : colors.mutedForeground} />
                      <Text numberOfLines={1} style={[styles.choiceText, { color: selected ? colors.primary : colors.foreground, flex: 1 }]}>{account.name}</Text>
                      {selected && <Feather name="check" size={15} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </View>
            )}

            <SectionLabel title="Additional details" />
            <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Add a note" multiline />
            {!!error && <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>}
            <View style={styles.modalActions}>
              <Pressable onPress={onClose} style={[styles.actionButton, { backgroundColor: colors.muted }]}>
                <Text style={[styles.actionText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable testID="emi-form-submit" onPress={submit} style={[styles.actionButton, { backgroundColor: colors.primary }]}>
                <Text style={[styles.actionText, { color: colors.primaryForeground }]}>{editing ? "Save changes" : "Add EMI"}</Text>
              </Pressable>
            </View>
          </KeyboardAwareScrollViewCompat>
        </View>
      </View>
    </Modal>
  );
}

function PaymentModal({ visible, onClose, emi, editing, paymentType }: {
  visible: boolean;
  onClose: () => void;
  emi: EMI;
  editing?: EMIPayment;
  paymentType: EMIPayment["paymentType"];
}) {
  const colors = useColors();
  const finance = useFinance();
  const toast = useToast();
  const due = paymentType === "monthly_emi" ? emiMonthly(emi) : balloonRemaining(emi);
  const [amount, setAmount] = useState(String(editing?.amount ?? due));
  const [date, setDate] = useState(editing?.date ?? todayString());
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState("");

  function submit() {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return setError("Enter a payment amount greater than zero.");
    if (!isValidDate(date)) return setError("Enter a valid date in YYYY-MM-DD format.");
    if (editing) {
      const ok = finance.updateEMIPayment(emi.id, editing.id, { amount: parsedAmount, date, notes: notes.trim() || undefined });
      if (!ok) return setError(paymentType === "monthly_emi" ? "Monthly payment must match the scheduled EMI amount." : "Payment exceeds the remaining balloon balance.");
      toast.show("Payment updated");
    } else {
      const ok = finance.recordEMIPayment(emi.id, { amount: parsedAmount, date, paymentType, notes: notes.trim() || undefined });
      if (!ok) return setError(paymentType === "monthly_emi" ? "Monthly payment must match the scheduled EMI amount." : "Payment exceeds the remaining balloon balance.");
      toast.show(paymentType === "balloon" ? "Balloon payment recorded" : "Monthly payment confirmed");
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.paymentSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {editing ? "Correct payment" : paymentType === "balloon" ? "Record balloon payment" : "Confirm monthly payment"}
            </Text>
            <Pressable accessibilityLabel="Close payment form" onPress={onClose} hitSlop={10}><Feather name="x" size={21} color={colors.mutedForeground} /></Pressable>
          </View>
          <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
            {paymentType === "balloon" ? `Remaining balloon balance: ${fmt(balloonRemaining(emi), finance.currency)}` : `Scheduled amount: ${fmt(emiMonthly(emi), finance.currency)}`}
          </Text>
          <Field label={`Amount (${finance.currency})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          <Field label="Payment date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-04-10" />
          <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Add a note" multiline />
          {!!error && <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>}
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={[styles.actionButton, { backgroundColor: colors.muted }]}>
              <Text style={[styles.actionText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable testID="emi-payment-submit" onPress={submit} style={[styles.actionButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.actionText, { color: colors.primaryForeground }]}>{editing ? "Save correction" : "Record payment"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  const colors = useColors();
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: color ?? colors.foreground }]}>{value}</Text>
    </View>
  );
}

function EMIDetailModal({ visible, onClose, emi, onEdit, onDelete, onRecordPayment }: {
  visible: boolean;
  onClose: () => void;
  emi: EMI;
  onEdit: () => void;
  onDelete: () => void;
  onRecordPayment: (type: EMIPayment["paymentType"], payment?: EMIPayment) => void;
}) {
  const colors = useColors();
  const finance = useFinance();
  const payments = emi.paymentHistory ?? [];
  const account = getLinkedAccount(emi, finance.accounts);
  const scheduledMonthly = emiMonthly(emi) * emiDuration(emi);
  const monthlyBalance = monthlyRemaining(emi);
  const balloonBalance = balloonRemaining(emi);
  const totalRemaining = monthlyBalance + balloonBalance;
  const monthlyPayments = payments.filter((payment) => payment.paymentType === "monthly_emi").length;

  function confirmPaymentDelete(payment: EMIPayment) {
    Alert.alert("Delete payment?", "This will recalculate the outstanding balance.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          finance.deleteEMIPayment(emi.id, payment.id);
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.detailSheet, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={styles.detailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.detailTitle, { color: colors.foreground }]}>{emi.name}</Text>
              <Text style={[styles.detailSubTitle, { color: colors.mutedForeground }]}>{emi.financeProvider || "Finance provider"}</Text>
            </View>
            <Pressable accessibilityLabel="Edit EMI plan" testID="emi-detail-edit" onPress={onEdit} style={styles.headerIcon}><Feather name="edit-2" size={17} color={colors.primary} /></Pressable>
            <Pressable accessibilityLabel="Delete EMI plan" testID="emi-detail-delete" onPress={onDelete} style={styles.headerIcon}><Feather name="trash-2" size={17} color={colors.destructive} /></Pressable>
            <Pressable accessibilityLabel="Close EMI details" onPress={onClose} style={styles.headerIcon}><Feather name="x" size={19} color={colors.mutedForeground} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.detailHero, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.heroCaption, { color: colors.mutedForeground }]}>Total remaining commitment</Text>
              <Text style={[styles.heroAmount, { color: colors.foreground }]}>{fmt(totalRemaining, finance.currency)}</Text>
              <View style={styles.detailHeroStats}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroStatLabel, { color: colors.mutedForeground }]}>Monthly balance</Text>
                  <Text style={[styles.heroStatValue, { color: colors.foreground }]}>{fmt(monthlyBalance, finance.currency)}</Text>
                </View>
                <View style={[styles.heroDivider, { backgroundColor: colors.border }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroStatLabel, { color: colors.mutedForeground }]}>Balloon balance</Text>
                  <Text style={[styles.heroStatValue, { color: colors.warning }]}>{fmt(balloonBalance, finance.currency)}</Text>
                </View>
              </View>
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <SectionLabel title="Repayment overview" />
              <InfoRow label="Original financed amount" value={fmt(emi.financedAmount ?? emi.totalAmount, finance.currency)} />
              <InfoRow label="Monthly EMI" value={fmt(emiMonthly(emi), finance.currency)} />
              <InfoRow label="Duration" value={`${emiDuration(emi)} months`} />
              <InfoRow label="Installments paid" value={`${monthlyPayments} / ${emiDuration(emi)}`} />
              <InfoRow label="Installments remaining" value={`${Math.max(0, emiDuration(emi) - monthlyPayments)}`} />
              <InfoRow label="Scheduled monthly repayment" value={fmt(scheduledMonthly, finance.currency)} />
              <InfoRow label="Total scheduled repayment" value={fmt(scheduledMonthly + (emi.balloonPaymentAmount ?? 0), finance.currency)} />
              <InfoRow label="Total amount paid" value={fmt(allPaid(emi), finance.currency)} color={colors.success} />
              <InfoRow label="Start date" value={displayDate(emi.startDate)} />
              <InfoRow label="Next expected monthly payment" value={displayDate(nextMonthlyPaymentDate(emi))} />
            </View>

            {(emi.balloonPaymentAmount ?? 0) > 0 && (
              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.warning + "60" }]}>
                <View style={styles.distinctHeading}>
                  <View style={[styles.balloonIcon, { backgroundColor: colors.warningLight }]}><Feather name="flag" size={15} color={colors.warning} /></View>
                  <SectionLabel title="Balloon payment" />
                </View>
                <InfoRow label="Scheduled balloon amount" value={fmt(emi.balloonPaymentAmount ?? 0, finance.currency)} color={colors.warning} />
                <InfoRow label="Due date" value={displayDate(emi.balloonPaymentDueDate)} />
                <InfoRow label="Amount paid" value={fmt(balloonPaid(emi), finance.currency)} />
                <InfoRow label="Remaining balloon balance" value={fmt(balloonBalance, finance.currency)} color={colors.warning} />
                {balloonBalance > 0 && (
                  <Pressable testID="emi-record-balloon" onPress={() => onRecordPayment("balloon")} style={[styles.actionButton, styles.detailAction, { backgroundColor: colors.warningLight }]}>
                    <Text style={[styles.actionText, { color: colors.warning }]}>Record balloon payment</Text>
                  </Pressable>
                )}
              </View>
            )}

            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <SectionLabel title="Bank deduction" />
              <InfoRow label="Auto-debit tracking" value={emi.autoDebitEnabled ? "Enabled — manual confirmation required" : "Off"} color={emi.autoDebitEnabled ? colors.success : undefined} />
              <InfoRow label="Linked account" value={account?.name ?? (emi.autoDebitEnabled ? "Account unavailable" : "Not linked")} />
              {emi.autoDebitEnabled && <InfoRow label="Expected monthly deduction" value={fmt(emiMonthly(emi), finance.currency)} />}
            </View>

            {!!emi.notes && (
              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <SectionLabel title="Notes" />
                <Text style={[styles.noteText, { color: colors.mutedForeground }]}>{emi.notes}</Text>
              </View>
            )}

            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.historyHeader}>
                <SectionLabel title="Payment history" />
                {emiPaidCount(emi) < emiDuration(emi) && (
                  <Pressable testID="emi-record-monthly" onPress={() => onRecordPayment("monthly_emi")} style={styles.historyAdd}>
                    <Feather name="plus" size={15} color={colors.primary} />
                    <Text style={[styles.historyAddText, { color: colors.primary }]}>Monthly</Text>
                  </Pressable>
                )}
              </View>
              {payments.length === 0 ? (
                <Text style={[styles.helperText, { color: colors.mutedForeground }]}>No confirmed payments yet.</Text>
              ) : [...payments].sort((a, b) => b.date.localeCompare(a.date)).map((payment) => (
                <View key={payment.id} style={[styles.paymentRow, { borderTopColor: colors.border }]}>
                  <View style={[styles.paymentTypeIcon, { backgroundColor: payment.paymentType === "balloon" ? colors.warningLight : colors.successLight }]}>
                    <Feather name={payment.paymentType === "balloon" ? "flag" : "check"} size={13} color={payment.paymentType === "balloon" ? colors.warning : colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.paymentTitle, { color: colors.foreground }]}>{payment.paymentType === "balloon" ? "Balloon payment" : "Monthly EMI"}</Text>
                    <Text style={[styles.paymentMeta, { color: colors.mutedForeground }]}>{displayDate(payment.date)}{payment.notes ? ` · ${payment.notes}` : ""}</Text>
                  </View>
                  <Text style={[styles.paymentAmount, { color: colors.foreground }]}>{fmt(payment.amount, finance.currency)}</Text>
                  <Pressable testID={`emi-payment-edit-${payment.id}`} accessibilityLabel="Correct payment" onPress={() => onRecordPayment(payment.paymentType, payment)} style={styles.paymentControl}>
                    <Feather name="edit-2" size={14} color={colors.primary} />
                  </Pressable>
                  <Pressable testID={`emi-payment-delete-${payment.id}`} accessibilityLabel="Delete payment" onPress={() => confirmPaymentDelete(payment)} style={styles.paymentControl}>
                    <Feather name="trash-2" size={14} color={colors.destructive} />
                  </Pressable>
                </View>
              ))}
            </View>
            <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
              Auto-debit dates and amounts are estimates for tracking only. The app does not access your bank or confirm deductions automatically.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function EMIsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const finance = useFinance();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EMI | undefined>();
  const [selectedEMI, setSelectedEMI] = useState<EMI | undefined>();
  const [paymentTarget, setPaymentTarget] = useState<{ emi: EMI; type: EMIPayment["paymentType"]; editing?: EMIPayment }>();
  const [refreshing, setRefreshing] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const activeEMIs = finance.emis.filter(isPlanActive);
  const completedEMIs = finance.emis.filter((emi) => !isPlanActive(emi));
  const totals = useMemo(() => ({
    monthly: finance.emis.reduce((sum, emi) => sum + (emiPaidCount(emi) < emiDuration(emi) ? emiMonthly(emi) : 0), 0),
    paid: finance.emis.reduce((sum, emi) => sum + allPaid(emi), 0),
    monthlyBalance: finance.emis.reduce((sum, emi) => sum + monthlyRemaining(emi), 0),
    balloonBalance: finance.emis.reduce((sum, emi) => sum + balloonRemaining(emi), 0),
    activeCount: activeEMIs.length,
  }), [finance.emis, activeEMIs.length]);

  useEffect(() => {
    const timeout = setTimeout(() => setShowSkeleton(false), 350);
    return () => clearTimeout(timeout);
  }, []);

  function openEdit(emi?: EMI) {
    setSelectedEMI(undefined);
    setEditing(emi);
    setFormOpen(true);
  }

  function confirmDelete(emi: EMI) {
    Alert.alert("Delete EMI plan?", `Remove ${emi.name} and its payment history?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          finance.deleteEMI(emi.id);
          setSelectedEMI(undefined);
          toast.show("EMI plan removed");
        },
      },
    ]);
  }

  function quickPay(emi: EMI) {
    const success = finance.recordEMIPayment(emi.id, {
      amount: emiMonthly(emi),
      date: todayString(),
      paymentType: "monthly_emi",
    });
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.show("Monthly payment confirmed");
    } else {
      toast.show("Payment could not be recorded");
    }
  }

  function startPayment(type: EMIPayment["paymentType"], editingPayment?: EMIPayment) {
    if (!selectedEMI) return;
    setPaymentTarget({ emi: selectedEMI, type, editing: editingPayment });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="EMI plans"
        subtitle="Repayment tracking"
        topInset={topPad}
        colors={colors}
        trailing={
          <Pressable
            accessibilityLabel="Add EMI plan"
            testID="emi-add-button"
            onPress={() => openEdit()}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={20} color={colors.primaryForeground} />
          </Pressable>
        }
      />

      {showSkeleton ? (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <SkeletonEMICard />
          <SkeletonEMICard />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: TAB_BAR_HEIGHT + (Platform.OS === "web" ? 34 : 0) }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setRefreshing(true);
                setTimeout(() => setRefreshing(false), 500);
              }}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.monthlyHero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}><Feather name="repeat" size={17} color="#FFFFFF" /></View>
              <Text style={styles.heroLabel}>Monthly EMI commitment</Text>
            </View>
            <Text style={styles.monthlyHeroValue}>{fmt(totals.monthly, finance.currency)}</Text>
            <Text style={styles.heroFootnote}>{totals.activeCount} active repayment {totals.activeCount === 1 ? "plan" : "plans"}</Text>
          </LinearGradient>

          <View style={styles.metricsGrid}>
            <SummaryMetric label="Amount paid" value={fmt(totals.paid, finance.currency)} icon="check-circle" color={colors.success} />
            <SummaryMetric label="Monthly balance" value={fmt(totals.monthlyBalance, finance.currency)} icon="clock" color={colors.primary} />
            <SummaryMetric label="Balloon balance" value={fmt(totals.balloonBalance, finance.currency)} icon="flag" color={colors.warning} />
            <SummaryMetric label="Active plans" value={String(totals.activeCount)} icon="layers" color={colors.accent} />
          </View>

          {activeEMIs.length === 0 && completedEMIs.length === 0 && (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}><Feather name="credit-card" size={21} color={colors.primary} /></View>
              <Text style={[styles.emptyText, { color: colors.foreground }]}>No EMI plans yet</Text>
              <Text style={[styles.helperText, { color: colors.mutedForeground }]}>Add a repayment plan to track monthly installments and final payments.</Text>
              <Pressable testID="emi-empty-add" onPress={() => openEdit()} style={[styles.actionButton, { backgroundColor: colors.primary, marginTop: 4 }]}>
                <Text style={[styles.actionText, { color: colors.primaryForeground }]}>Add EMI plan</Text>
              </Pressable>
            </View>
          )}

          {activeEMIs.length > 0 && (
            <>
              <Text style={[styles.listHeading, { color: colors.foreground }]}>Active plans</Text>
              {activeEMIs.map((emi) => (
                <EMICard
                  key={emi.id}
                  emi={emi}
                  currency={finance.currency}
                  account={getLinkedAccount(emi, finance.accounts)}
                  onOpen={() => setSelectedEMI(emi)}
                  onQuickPay={() => quickPay(emi)}
                />
              ))}
            </>
          )}

          {completedEMIs.length > 0 && (
            <>
              <Text style={[styles.listHeading, { color: colors.mutedForeground }]}>Completed</Text>
              {completedEMIs.map((emi) => (
                <EMICard
                  key={emi.id}
                  emi={emi}
                  currency={finance.currency}
                  account={getLinkedAccount(emi, finance.accounts)}
                  onOpen={() => setSelectedEMI(emi)}
                  onQuickPay={() => {}}
                />
              ))}
            </>
          )}
        </ScrollView>
      )}

      {formOpen && (
        <EMIFormModal
          key={editing?.id ?? "new"}
          visible={formOpen}
          editing={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(undefined);
          }}
        />
      )}
      {selectedEMI && (
        <EMIDetailModal
          visible
          emi={finance.emis.find((emi) => emi.id === selectedEMI.id) ?? selectedEMI}
          onClose={() => setSelectedEMI(undefined)}
          onEdit={() => openEdit(finance.emis.find((emi) => emi.id === selectedEMI.id) ?? selectedEMI)}
          onDelete={() => confirmDelete(finance.emis.find((emi) => emi.id === selectedEMI.id) ?? selectedEMI)}
          onRecordPayment={startPayment}
        />
      )}
      {paymentTarget && (
        <PaymentModal
          key={paymentTarget.editing?.id ?? `${paymentTarget.emi.id}-${paymentTarget.type}`}
          visible
          emi={finance.emis.find((emi) => emi.id === paymentTarget.emi.id) ?? paymentTarget.emi}
          editing={paymentTarget.editing}
          paymentType={paymentTarget.type}
          onClose={() => setPaymentTarget(undefined)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: TAB_BAR_HEIGHT, gap: 13 },
  monthlyHero: { borderRadius: 19, padding: 18, minHeight: 133, justifyContent: "center" },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 9 },
  heroIcon: { width: 28, height: 28, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  heroLabel: { color: "rgba(255,255,255,0.82)", fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium" },
  monthlyHeroValue: { color: "#FFFFFF", fontSize: TYPOGRAPHY.heroValue, fontFamily: "Inter_700Bold", marginTop: 9 },
  heroFootnote: { color: "rgba(255,255,255,0.72)", fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", marginTop: 2 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "48%", flexGrow: 1, minHeight: 93, borderRadius: 15, borderWidth: 1, padding: 12, justifyContent: "space-between" },
  metricIcon: { width: 27, height: 27, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  metricLabel: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium", marginTop: 8 },
  metricValue: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_700Bold", marginTop: 2 },
  listHeading: { fontSize: TYPOGRAPHY.sectionHeading, fontFamily: "Inter_700Bold", marginTop: 4 },
  emiCard: { borderRadius: 19, padding: 15, borderWidth: 1, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitleGroup: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  emiIcon: { width: 43, height: 43, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  emiName: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_700Bold" },
  emiDue: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", marginTop: 3 },
  chartRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  donutWrap: { width: DONUT_SIZE, height: DONUT_SIZE, alignItems: "center", justifyContent: "center" },
  donutCenter: { position: "absolute", alignItems: "center", justifyContent: "center", maxWidth: 82 },
  donutAmount: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_700Bold", textAlign: "center" },
  donutLabel: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", marginTop: 2 },
  emiStats: { flex: 1, gap: 7 },
  statRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6 },
  statLabel: { flex: 1, fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular" },
  statValue: { flexShrink: 1, fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  divider: { height: 1 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  badgeWrap: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7 },
  badgeText: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold" },
  nextDate: { flexShrink: 1, fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium", textAlign: "right" },
  accountCaption: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", marginTop: -6 },
  quickPay: { minHeight: 40, borderRadius: 11, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  quickPayText: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_600SemiBold" },
  emptyState: { alignItems: "center", paddingHorizontal: 20, paddingVertical: 32, gap: 8 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  emptyText: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_700Bold" },
  helperText: { fontSize: TYPOGRAPHY.bodySmall, lineHeight: 19, fontFamily: "Inter_400Regular" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  formSheet: { maxHeight: "94%", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 20 },
  paymentSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 30 },
  detailSheet: { height: "94%", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 17, paddingTop: 11 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  modalTitle: { fontSize: TYPOGRAPHY.dialogTitle, fontFamily: "Inter_700Bold" },
  sectionLabel: { fontSize: TYPOGRAPHY.sectionHeading, fontFamily: "Inter_700Bold", marginTop: 8, marginBottom: 9 },
  fieldWrap: { flex: 1, marginBottom: 10 },
  fieldLabel: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium", marginBottom: 5 },
  input: { minHeight: 45, borderRadius: 11, paddingHorizontal: 12, fontSize: 16, fontFamily: "Inter_400Regular", borderWidth: 1 },
  multilineInput: { minHeight: 70, paddingTop: 11 },
  twoFields: { flexDirection: "row", gap: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12 },
  choiceChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1 },
  choiceText: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold" },
  toggleRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  toggleLabel: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_600SemiBold" },
  toggleDetail: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", marginTop: 2 },
  toggleTrack: { width: 43, height: 25, borderRadius: 13, padding: 3, justifyContent: "center" },
  toggleThumb: { width: 19, height: 19, borderRadius: 10 },
  accountChoices: { gap: 7, marginBottom: 10 },
  accountChoice: { minHeight: 43, flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10 },
  errorText: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium", marginVertical: 7 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  actionButton: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  actionText: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_600SemiBold" },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 13 },
  detailTitle: { fontSize: TYPOGRAPHY.dialogTitle, fontFamily: "Inter_700Bold" },
  detailSubTitle: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  detailContent: { paddingBottom: 28, gap: 11 },
  detailHero: { borderRadius: 17, padding: 16, borderWidth: 1 },
  heroCaption: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium" },
  heroAmount: { fontSize: TYPOGRAPHY.heroValue, fontFamily: "Inter_700Bold", marginTop: 4, marginBottom: 14 },
  detailHeroStats: { flexDirection: "row", alignItems: "center", gap: 14 },
  heroDivider: { width: 1, height: 30 },
  heroStatLabel: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular" },
  heroStatValue: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  infoCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 6 },
  infoLabel: { flex: 1, fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular" },
  infoValue: { flexShrink: 1, fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  distinctHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  balloonIcon: { width: 27, height: 27, borderRadius: 9, alignItems: "center", justifyContent: "center", marginTop: 6 },
  detailAction: { flex: 0, marginTop: 6 },
  noteText: { fontSize: TYPOGRAPHY.bodySmall, lineHeight: 19, fontFamily: "Inter_400Regular", paddingBottom: 5 },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyAdd: { flexDirection: "row", alignItems: "center", gap: 4, padding: 5 },
  historyAddText: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold" },
  paymentRow: { flexDirection: "row", alignItems: "center", gap: 7, borderTopWidth: 1, paddingVertical: 9 },
  paymentTypeIcon: { width: 25, height: 25, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  paymentTitle: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold" },
  paymentMeta: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", marginTop: 2 },
  paymentAmount: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold" },
  paymentControl: { width: 24, height: 30, alignItems: "center", justifyContent: "center" },
  disclaimer: { fontSize: TYPOGRAPHY.supporting, lineHeight: 16, fontFamily: "Inter_400Regular", paddingHorizontal: 3 },
});
