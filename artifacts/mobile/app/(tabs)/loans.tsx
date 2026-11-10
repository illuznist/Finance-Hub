import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  Alert,
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
import {
  type Loan,
  type LoanCategory,
  type LoanDirection,
  type LoanPayment,
  type LoanRepaymentFrequency,
  type LoanSourceType,
  useFinance,
} from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { useColors } from "@/hooks/useColors";
import { TYPOGRAPHY } from "@/constants/typography";
import {
  getLoanObligation,
  getLoanOutstandingBalance,
  getLoanPaidAmount,
  getLoanProgress,
  isLoanSettled,
} from "@/utils/loanCalculations";

type LoanFilter = "all" | LoanDirection | "settled";

const CATEGORIES: { value: LoanCategory; label: string }[] = [
  { value: "personal", label: "Personal" },
  { value: "home", label: "Home" },
  { value: "vehicle", label: "Vehicle" },
  { value: "education", label: "Education" },
  { value: "business", label: "Business" },
  { value: "family", label: "Family" },
  { value: "other", label: "Other" },
];
const SOURCES: { value: LoanSourceType; label: string }[] = [
  { value: "person", label: "Person" },
  { value: "bank", label: "Bank" },
  { value: "other", label: "Other" },
];
const FREQUENCIES: { value: LoanRepaymentFrequency; label: string }[] = [
  { value: "one-time", label: "One-time" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];
const FILTERS: { value: LoanFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "borrowed", label: "Borrowed" },
  { value: "lent", label: "Lent" },
  { value: "settled", label: "Settled" },
];

function todayString(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function formatDate(value?: string): string {
  if (!value || !validDate(value)) return "Not set";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function fmt(amount: number, currency: string): string {
  return `${currency} ${Math.max(0, amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function idForPayment(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loanDirectionLabel(direction: LoanDirection): string {
  return direction === "borrowed" ? "Borrowed" : "Lent";
}

function sourceLabel(source: LoanSourceType): string {
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function frequencyLabel(frequency: LoanRepaymentFrequency): string {
  return frequency === "one-time" ? "One-time" : frequency.charAt(0).toUpperCase() + frequency.slice(1);
}

function ChoiceChips<T extends string>({ value, options, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.chipWrap}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.choiceChip,
              {
                backgroundColor: selected ? colors.secondary : colors.muted,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.choiceText, { color: selected ? colors.primary : colors.mutedForeground }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LoanField({ label, value, onChangeText, placeholder, numeric, multiline, testID }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  numeric?: boolean;
  multiline?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={numeric ? "decimal-pad" : "default"}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        autoCapitalize={label.toLowerCase().includes("date") ? "none" : "sentences"}
        style={[
          styles.input,
          multiline && styles.multilineInput,
          { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border },
        ]}
      />
    </View>
  );
}

function LoanCard({ loan, currency, onPress }: { loan: Loan; currency: string; onPress: () => void }) {
  const colors = useColors();
  const settled = isLoanSettled(loan);
  const outstanding = getLoanOutstandingBalance(loan);
  const progress = getLoanProgress(loan);
  const directionColor = loan.direction === "borrowed" ? colors.warning : colors.success;
  return (
    <Pressable
      testID={`loan-card-${loan.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Open ${loan.name} details`}
      onPress={onPress}
      style={[styles.loanCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.loanIcon, { backgroundColor: (loan.color ?? colors.primary) + "20" }]}>
          <Feather name={(loan.iconName ?? "dollar-sign") as React.ComponentProps<typeof Feather>["name"]} size={19} color={loan.color ?? colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[styles.loanName, { color: colors.foreground }]}>{loan.name}</Text>
          <Text numberOfLines={1} style={[styles.counterparty, { color: colors.mutedForeground }]}>{loan.counterpartyName} · {sourceLabel(loan.sourceType)}</Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
      </View>

      <View style={styles.tagRow}>
        <View style={[styles.statusTag, { backgroundColor: directionColor + "20" }]}>
          <Text style={[styles.statusText, { color: directionColor }]}>{loanDirectionLabel(loan.direction)}</Text>
        </View>
        <View style={[styles.statusTag, { backgroundColor: settled ? colors.successLight : colors.muted }]}>
          <Text style={[styles.statusText, { color: settled ? colors.success : colors.mutedForeground }]}>{settled ? "Settled" : "Active"}</Text>
        </View>
      </View>

      <View style={styles.balanceRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Principal</Text>
          <Text style={[styles.cardAmount, { color: colors.foreground }]}>{fmt(loan.principalAmount, currency)}</Text>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Outstanding</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.cardAmount, { color: settled ? colors.success : colors.foreground }]}>{fmt(outstanding, currency)}</Text>
        </View>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: loan.color ?? colors.primary }]} />
      </View>
      <View style={styles.progressCaptionRow}>
        <Text style={[styles.progressCaption, { color: colors.mutedForeground }]}>{Math.round(progress * 100)}% repaid</Text>
        <Text style={[styles.progressCaption, { color: colors.mutedForeground }]}>{fmt(getLoanPaidAmount(loan), currency)} paid</Text>
      </View>
    </Pressable>
  );
}

function LoanFormModal({ visible, onClose, editing }: { visible: boolean; onClose: () => void; editing?: Loan }) {
  const colors = useColors();
  const finance = useFinance();
  const toast = useToast();
  const [name, setName] = useState(editing?.name ?? "");
  const [direction, setDirection] = useState<LoanDirection>(editing?.direction ?? "borrowed");
  const [counterparty, setCounterparty] = useState(editing?.counterpartyName ?? "");
  const [sourceType, setSourceType] = useState<LoanSourceType>(editing?.sourceType ?? "person");
  const [category, setCategory] = useState<LoanCategory>(editing?.category ?? "personal");
  const [principal, setPrincipal] = useState(String(editing?.principalAmount ?? ""));
  const [totalRepayment, setTotalRepayment] = useState(String(editing?.totalRepaymentAmount ?? ""));
  const [interestRate, setInterestRate] = useState(String(editing?.interestRate ?? ""));
  const [startDate, setStartDate] = useState(editing?.startDate ?? todayString());
  const [expectedEndDate, setExpectedEndDate] = useState(editing?.expectedEndDate ?? "");
  const [frequency, setFrequency] = useState<LoanRepaymentFrequency>(editing?.repaymentFrequency ?? "one-time");
  const [plannedPayment, setPlannedPayment] = useState(String(editing?.plannedPaymentAmount ?? ""));
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [initialAmount, setInitialAmount] = useState("");
  const [initialDate, setInitialDate] = useState(todayString());
  const [showRepaymentDetails, setShowRepaymentDetails] = useState(Boolean(editing?.totalRepaymentAmount || editing?.interestRate || editing?.plannedPaymentAmount));
  const [error, setError] = useState("");

  function submit() {
    const parsedPrincipal = Number(principal);
    const parsedTotal = totalRepayment.trim() ? Number(totalRepayment) : undefined;
    const parsedRate = interestRate.trim() ? Number(interestRate) : undefined;
    const parsedPlanned = plannedPayment.trim() ? Number(plannedPayment) : undefined;
    const initial = initialAmount.trim() ? Number(initialAmount) : 0;
    if (!name.trim()) return setError("Enter a name for the loan.");
    if (!counterparty.trim()) return setError("Enter the person or institution involved.");
    if (!Number.isFinite(parsedPrincipal) || parsedPrincipal <= 0) return setError("Principal must be greater than zero.");
    if (!validDate(startDate)) return setError("Enter a valid start date in YYYY-MM-DD format.");
    if (expectedEndDate && !validDate(expectedEndDate)) return setError("Enter a valid expected end date.");
    if (expectedEndDate && expectedEndDate < startDate) return setError("Expected end date cannot be before the start date.");
    if (parsedTotal !== undefined && (!Number.isFinite(parsedTotal) || parsedTotal < parsedPrincipal)) {
      return setError("Total repayment must be at least the principal amount.");
    }
    if (parsedRate !== undefined && (!Number.isFinite(parsedRate) || parsedRate < 0)) return setError("Interest rate cannot be negative.");
    if (parsedPlanned !== undefined && (!Number.isFinite(parsedPlanned) || parsedPlanned <= 0)) return setError("Planned payment must be greater than zero.");
    const obligation = parsedTotal ?? parsedPrincipal;
    if (!editing && initialAmount.trim() && (!Number.isFinite(initial) || initial < 0 || initial > obligation)) {
      return setError("Initial payment must be zero or within the repayment obligation.");
    }
    if (!editing && initial > 0 && !validDate(initialDate)) return setError("Enter a valid initial payment date.");
    if (editing) {
      const alreadyPaid = getLoanPaidAmount(editing);
      if (alreadyPaid > obligation + 0.005) return setError("Repayment obligation cannot be less than payments already recorded.");
    }

    const loanData = {
      name: name.trim(),
      direction,
      counterpartyName: counterparty.trim(),
      sourceType,
      category,
      principalAmount: parsedPrincipal,
      totalRepaymentAmount: parsedTotal,
      interestRate: parsedRate,
      startDate,
      expectedEndDate: expectedEndDate || undefined,
      repaymentFrequency: frequency,
      plannedPaymentAmount: parsedPlanned,
      notes: notes.trim(),
      color: editing?.color ?? colors.primary,
      iconName: editing?.iconName ?? (category === "vehicle" ? "truck" : category === "home" ? "home" : "dollar-sign"),
    };
    if (editing) {
      const updated = finance.updateLoan(editing.id, loanData);
      if (!updated) return setError("This change would put recorded payments above the repayment obligation.");
      toast.show("Loan updated");
    } else {
      const payments: LoanPayment[] = initial > 0
        ? [{ id: idForPayment(), amount: initial, date: initialDate, notes: "Initial amount recorded" }]
        : [];
      finance.addLoan({ ...loanData, payments, createdAt: new Date().toISOString() });
      toast.show("Loan added");
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
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editing ? "Edit loan" : "Add loan"}</Text>
            <Pressable accessibilityLabel="Close loan form" onPress={onClose} hitSlop={10}><Feather name="x" size={21} color={colors.mutedForeground} /></Pressable>
          </View>
          <KeyboardAwareScrollViewCompat
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: 18 }}
            keyboardShouldPersistTaps="handled"
            bottomOffset={70}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Loan direction</Text>
            <ChoiceChips
              value={direction}
              options={editing?.payments.length
                ? [{ value: editing.direction, label: loanDirectionLabel(editing.direction) }]
                : [{ value: "borrowed", label: "Borrowed" }, { value: "lent", label: "Lent" }]}
              onChange={setDirection}
            />
            {!!editing?.payments.length && (
              <Text style={[styles.helperText, { color: colors.mutedForeground }]}>Direction stays fixed while payment history exists.</Text>
            )}

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Loan details</Text>
            <LoanField label="Loan name" value={name} onChangeText={setName} placeholder="e.g. Family loan" />
            <LoanField label="Person or institution" value={counterparty} onChangeText={setCounterparty} placeholder="e.g. Ahmed or local bank" />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Source type</Text>
            <ChoiceChips value={sourceType} options={SOURCES} onChange={setSourceType} />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
            <ChoiceChips value={category} options={CATEGORIES} onChange={setCategory} />
            <LoanField label={`Principal amount (${finance.currency})`} value={principal} onChangeText={setPrincipal} placeholder="10000" numeric testID="loan-principal-input" />
            <LoanField label="Start date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} placeholder="2026-01-01" />
            <LoanField label="Expected end date (optional)" value={expectedEndDate} onChangeText={setExpectedEndDate} placeholder="2026-12-31" />

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showRepaymentDetails }}
              onPress={() => setShowRepaymentDetails((open) => !open)}
              style={styles.optionalHeader}
            >
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Repayment details</Text>
              <Feather name={showRepaymentDetails ? "chevron-up" : "chevron-down"} size={17} color={colors.mutedForeground} />
            </Pressable>
            {showRepaymentDetails && (
              <>
                <LoanField label={`Total repayment amount (${finance.currency}, optional)`} value={totalRepayment} onChangeText={setTotalRepayment} placeholder={principal || "10000"} numeric />
                <LoanField label="Interest rate % (informational only)" value={interestRate} onChangeText={setInterestRate} placeholder="5" numeric />
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Repayment frequency</Text>
                <ChoiceChips value={frequency} options={FREQUENCIES} onChange={setFrequency} />
                <LoanField label={`Planned payment (${finance.currency}, optional)`} value={plannedPayment} onChangeText={setPlannedPayment} placeholder="500" numeric />
              </>
            )}

            {!editing && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Initial payment (optional)</Text>
                <LoanField
                  label={direction === "borrowed" ? "Amount already repaid" : "Amount already received"}
                  value={initialAmount}
                  onChangeText={setInitialAmount}
                  placeholder="0"
                  numeric
                />
                {Number(initialAmount) > 0 && (
                  <LoanField label="Initial payment date (YYYY-MM-DD)" value={initialDate} onChangeText={setInitialDate} placeholder={todayString()} />
                )}
              </>
            )}

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Additional details</Text>
            <LoanField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Add a note" multiline />
            {!!error && <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>}
            <View style={styles.modalActions}>
              <Pressable onPress={onClose} style={[styles.actionButton, { backgroundColor: colors.muted }]}>
                <Text style={[styles.actionText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable testID="loan-form-submit" onPress={submit} style={[styles.actionButton, { backgroundColor: colors.primary }]}>
                <Text style={[styles.actionText, { color: colors.primaryForeground }]}>{editing ? "Save changes" : "Add loan"}</Text>
              </Pressable>
            </View>
          </KeyboardAwareScrollViewCompat>
        </View>
      </View>
    </Modal>
  );
}

function PaymentModal({ loan, editing, onClose }: { loan: Loan; editing?: LoanPayment; onClose: () => void }) {
  const colors = useColors();
  const finance = useFinance();
  const toast = useToast();
  const [amount, setAmount] = useState(String(editing?.amount ?? ""));
  const [date, setDate] = useState(editing?.date ?? todayString());
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [error, setError] = useState("");
  const directionVerb = loan.direction === "borrowed" ? "repayment" : "amount received";

  function submit() {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return setError("Amount must be greater than zero.");
    if (!validDate(date)) return setError("Enter a valid date in YYYY-MM-DD format.");
    const success = editing
      ? finance.updateLoanPayment(loan.id, editing.id, { amount: parsedAmount, date, notes: notes.trim() || undefined })
      : finance.recordLoanPayment(loan.id, { amount: parsedAmount, date, notes: notes.trim() || undefined });
    if (!success) return setError("This amount cannot exceed the outstanding balance.");
    toast.show(editing ? "Payment updated" : loan.direction === "borrowed" ? "Repayment recorded" : "Amount received recorded");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.paymentSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{editing ? "Edit payment" : loan.direction === "borrowed" ? "Record repayment" : "Record amount received"}</Text>
            <Pressable accessibilityLabel="Close payment form" onPress={onClose} hitSlop={10}><Feather name="x" size={21} color={colors.mutedForeground} /></Pressable>
          </View>
          <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
            {editing ? `Update this ${directionVerb}.` : `Outstanding balance: ${fmt(getLoanOutstandingBalance(loan), finance.currency)}`}
          </Text>
          <LoanField label={`Amount (${finance.currency})`} value={amount} onChangeText={setAmount} placeholder="500" numeric testID="loan-payment-amount" />
          <LoanField label="Payment date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder={todayString()} />
          <LoanField label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Add a note" multiline />
          {!!error && <Text accessibilityRole="alert" style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>}
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={[styles.actionButton, { backgroundColor: colors.muted }]}>
              <Text style={[styles.actionText, { color: colors.mutedForeground }]}>Cancel</Text>
            </Pressable>
            <Pressable testID="loan-payment-submit" onPress={submit} style={[styles.actionButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.actionText, { color: colors.primaryForeground }]}>{editing ? "Save changes" : loan.direction === "borrowed" ? "Record repayment" : "Record amount received"}</Text>
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

function LoanDetailModal({ loan, onClose, onEdit, onDelete, onPayment }: {
  loan: Loan;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPayment: (payment?: LoanPayment) => void;
}) {
  const colors = useColors();
  const finance = useFinance();
  const settled = isLoanSettled(loan);
  const progress = getLoanProgress(loan);
  const paid = getLoanPaidAmount(loan);
  const outstanding = getLoanOutstandingBalance(loan);
  const totalObligation = getLoanObligation(loan);

  function confirmDeletePayment(payment: LoanPayment) {
    Alert.alert("Delete payment?", "The outstanding balance and repayment progress will be recalculated.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => finance.deleteLoanPayment(loan.id, payment.id) },
    ]);
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.detailSheet, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={styles.detailHeader}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={[styles.detailTitle, { color: colors.foreground }]}>{loan.name}</Text>
              <Text style={[styles.detailSubtitle, { color: colors.mutedForeground }]}>{loanDirectionLabel(loan.direction)} · {loan.counterpartyName}</Text>
            </View>
            <Pressable accessibilityLabel="Edit loan" testID="loan-detail-edit" onPress={onEdit} style={styles.headerIcon}><Feather name="edit-2" size={17} color={colors.primary} /></Pressable>
            <Pressable accessibilityLabel="Delete loan" testID="loan-detail-delete" onPress={onDelete} style={styles.headerIcon}><Feather name="trash-2" size={17} color={colors.destructive} /></Pressable>
            <Pressable accessibilityLabel="Close loan details" onPress={onClose} style={styles.headerIcon}><Feather name="x" size={19} color={colors.mutedForeground} /></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.outstandingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.outstandingTop}>
                <Text style={[styles.detailLabel, { color: colors.mutedForeground }]}>Outstanding balance</Text>
                <View style={[styles.statusTag, { backgroundColor: settled ? colors.successLight : colors.muted }]}>
                  <Text style={[styles.statusText, { color: settled ? colors.success : colors.mutedForeground }]}>{settled ? "Settled" : "Active"}</Text>
                </View>
              </View>
              <Text style={[styles.outstandingValue, { color: colors.foreground }]}>{fmt(outstanding, finance.currency)}</Text>
              <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: loan.color ?? colors.primary }]} />
              </View>
              <View style={styles.progressCaptionRow}>
                <Text style={[styles.progressCaption, { color: colors.mutedForeground }]}>{Math.round(progress * 100)}% repaid</Text>
                <Text style={[styles.progressCaption, { color: colors.mutedForeground }]}>{fmt(paid, finance.currency)} paid</Text>
              </View>
            </View>

            {!settled && (
              <Pressable testID="loan-record-payment" onPress={() => onPayment()} style={[styles.recordButton, { backgroundColor: colors.primary }]}>
                <Feather name="plus-circle" size={17} color={colors.primaryForeground} />
                <Text style={[styles.actionText, { color: colors.primaryForeground }]}>{loan.direction === "borrowed" ? "Record repayment" : "Record amount received"}</Text>
              </Pressable>
            )}

            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Loan details</Text>
              <InfoRow label="Direction" value={loanDirectionLabel(loan.direction)} />
              <InfoRow label="Counterparty" value={loan.counterpartyName} />
              <InfoRow label="Source" value={sourceLabel(loan.sourceType)} />
              <InfoRow label="Category" value={CATEGORIES.find((item) => item.value === loan.category)?.label ?? "Other"} />
              <InfoRow label="Original principal" value={fmt(loan.principalAmount, finance.currency)} />
              {loan.totalRepaymentAmount !== undefined && <InfoRow label="Total repayment obligation" value={fmt(totalObligation, finance.currency)} />}
              <InfoRow label={loan.direction === "borrowed" ? "Total repaid" : "Total received"} value={fmt(paid, finance.currency)} color={colors.success} />
              <InfoRow label="Start date" value={formatDate(loan.startDate)} />
              <InfoRow label="Expected end date" value={formatDate(loan.expectedEndDate)} />
              {loan.interestRate !== undefined && <InfoRow label="Interest rate (informational)" value={`${loan.interestRate}%`} />}
              <InfoRow label="Repayment frequency" value={frequencyLabel(loan.repaymentFrequency)} />
              {loan.plannedPaymentAmount !== undefined && <InfoRow label="Planned payment" value={fmt(loan.plannedPaymentAmount, finance.currency)} />}
            </View>

            {!!loan.notes && (
              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Notes</Text>
                <Text style={[styles.noteText, { color: colors.mutedForeground }]}>{loan.notes}</Text>
              </View>
            )}

            <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.historyHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Payment history</Text>
                <Text style={[styles.historyCount, { color: colors.mutedForeground }]}>{loan.payments.length}</Text>
              </View>
              {loan.payments.length === 0 ? (
                <Text style={[styles.helperText, { color: colors.mutedForeground, marginTop: 12 }]}>No payments recorded yet.</Text>
              ) : [...loan.payments].sort((a, b) => b.date.localeCompare(a.date)).map((payment) => (
                <View key={payment.id} style={[styles.paymentRow, { borderTopColor: colors.border }]}>
                  <View style={[styles.paymentIcon, { backgroundColor: colors.successLight }]}><Feather name="check" size={13} color={colors.success} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.paymentTitle, { color: colors.foreground }]}>{loan.direction === "borrowed" ? "Repayment" : "Amount received"}</Text>
                    <Text style={[styles.paymentMeta, { color: colors.mutedForeground }]}>{formatDate(payment.date)}{payment.notes ? ` · ${payment.notes}` : ""}</Text>
                  </View>
                  <Text style={[styles.paymentAmount, { color: colors.foreground }]}>{fmt(payment.amount, finance.currency)}</Text>
                  <Pressable testID={`loan-payment-edit-${payment.id}`} accessibilityLabel="Edit payment" onPress={() => onPayment(payment)} style={styles.paymentControl}>
                    <Feather name="edit-2" size={14} color={colors.primary} />
                  </Pressable>
                  <Pressable testID={`loan-payment-delete-${payment.id}`} accessibilityLabel="Delete payment" onPress={() => confirmDeletePayment(payment)} style={styles.paymentControl}>
                    <Feather name="trash-2" size={14} color={colors.destructive} />
                  </Pressable>
                </View>
              ))}
            </View>
            <Text style={[styles.infoNote, { color: colors.mutedForeground }]}>
              Interest rate is shown for reference only. No interest is calculated unless you enter a total repayment amount.
            </Text>
            <Pressable onPress={onDelete} style={[styles.deleteLoanButton, { borderColor: colors.destructive + "60" }]}>
              <Text style={[styles.actionText, { color: colors.destructive }]}>Delete loan and payment history</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SummaryItem({ title, amount, color }: { title: string; amount: number; color: string }) {
  const finance = useFinance();
  const colors = useColors();
  return (
    <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.summaryDot, { backgroundColor: color }]} />
      <Text numberOfLines={1} style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{title}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.summaryValue, { color: colors.foreground }]}>{fmt(amount, finance.currency)}</Text>
    </View>
  );
}

export default function LoansScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const finance = useFinance();
  const toast = useToast();
  const [filter, setFilter] = useState<LoanFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | undefined>();
  const [selectedLoan, setSelectedLoan] = useState<Loan | undefined>();
  const [paymentTarget, setPaymentTarget] = useState<{ loan: Loan; payment?: LoanPayment }>();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const visibleLoans = useMemo(() => finance.loans.filter((loan) => {
    if (filter === "borrowed" || filter === "lent") return loan.direction === filter;
    if (filter === "settled") return isLoanSettled(loan);
    return true;
  }), [finance.loans, filter]);

  function openForm(loan?: Loan) {
    setSelectedLoan(undefined);
    setEditingLoan(loan);
    setFormOpen(true);
  }

  function openPayment(payment?: LoanPayment) {
    if (!selectedLoan) return;
    setPaymentTarget({ loan: selectedLoan, payment });
  }

  function confirmDeleteLoan(loan: Loan) {
    Alert.alert(
      "Delete loan?",
      `Delete "${loan.name}" and all of its payment history? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete loan",
          style: "destructive",
          onPress: () => {
            finance.deleteLoan(loan.id);
            setSelectedLoan(undefined);
            toast.show("Loan removed");
          },
        },
      ]
    );
  }

  const selectedCurrent = selectedLoan ? finance.loans.find((loan) => loan.id === selectedLoan.id) ?? selectedLoan : undefined;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Loans</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>Money borrowed and lent</Text>
        </View>
        <Pressable
          accessibilityLabel="Add loan"
          testID="loan-add-button"
          onPress={() => openForm()}
          style={[styles.addButton, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={20} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.pageContent, { paddingBottom: 100 + (Platform.OS === "web" ? 34 : 0) }]} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryRow}>
          <SummaryItem title="You Owe" amount={finance.outstandingBorrowedBalance} color={colors.warning} />
          <SummaryItem title="Owed to You" amount={finance.outstandingLentBalance} color={colors.success} />
          <SummaryItem title="Repaid" amount={finance.totalRepaidOnBorrowedLoans} color={colors.primary} />
        </View>
        <View style={styles.countRow}>
          <Text style={[styles.countText, { color: colors.mutedForeground }]}>{finance.activeLoanCount} active</Text>
          <View style={[styles.countDot, { backgroundColor: colors.border }]} />
          <Text style={[styles.countText, { color: colors.mutedForeground }]}>{finance.settledLoanCount} settled</Text>
          <Text style={[styles.countText, { color: colors.mutedForeground, marginLeft: "auto" }]}>
            {fmt(finance.totalReceivedOnLentLoans, finance.currency)} received
          </Text>
        </View>

        <View style={styles.listHeader}>
          <Text style={[styles.sectionHeading, { color: colors.foreground }]}>Your Loans</Text>
          <Pressable testID="loan-empty-add" accessibilityLabel="Add loan" onPress={() => openForm()} style={styles.addInline}>
            <Feather name="plus" size={15} color={colors.primary} />
            <Text style={[styles.addInlineText, { color: colors.primary }]}>Add</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((item) => {
            const active = filter === item.value;
            return (
              <Pressable
                key={item.value}
                testID={`loan-filter-${item.value}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(item.value)}
                style={[styles.filterChip, { backgroundColor: active ? colors.primary : colors.card, borderColor: active ? colors.primary : colors.border }]}
              >
                <Text style={[styles.filterText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {visibleLoans.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}><Feather name="dollar-sign" size={22} color={colors.primary} /></View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{finance.loans.length === 0 ? "No loans yet" : "No loans in this view"}</Text>
            <Text style={[styles.emptyDescription, { color: colors.mutedForeground }]}>
              {finance.loans.length === 0 ? "Track money borrowed or lent separately from EMI plans." : "Try another filter or add a new loan."}
            </Text>
            {finance.loans.length === 0 && (
              <Pressable onPress={() => openForm()} style={[styles.emptyButton, { backgroundColor: colors.primary }]}>
                <Text style={[styles.actionText, { color: colors.primaryForeground }]}>Add your first loan</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={styles.loanList}>
            {visibleLoans.map((loan) => (
              <LoanCard key={loan.id} loan={loan} currency={finance.currency} onPress={() => setSelectedLoan(loan)} />
            ))}
          </View>
        )}
      </ScrollView>

      {formOpen && (
        <LoanFormModal
          key={editingLoan?.id ?? "new-loan"}
          visible
          editing={editingLoan}
          onClose={() => {
            setFormOpen(false);
            setEditingLoan(undefined);
          }}
        />
      )}
      {selectedCurrent && !paymentTarget && (
        <LoanDetailModal
          loan={selectedCurrent}
          onClose={() => setSelectedLoan(undefined)}
          onEdit={() => openForm(selectedCurrent)}
          onDelete={() => confirmDeleteLoan(selectedCurrent)}
          onPayment={openPayment}
        />
      )}
      {paymentTarget && (
        <LoanDetailModal
          loan={finance.loans.find((loan) => loan.id === paymentTarget.loan.id) ?? paymentTarget.loan}
          onClose={() => setSelectedLoan(undefined)}
          onEdit={() => openForm(paymentTarget.loan)}
          onDelete={() => confirmDeleteLoan(paymentTarget.loan)}
          onPayment={openPayment}
        />
      )}
      {paymentTarget && (
        <PaymentModal
          key={paymentTarget.payment?.id ?? `${paymentTarget.loan.id}-new-payment`}
          loan={finance.loans.find((loan) => loan.id === paymentTarget.loan.id) ?? paymentTarget.loan}
          editing={paymentTarget.payment}
          onClose={() => setPaymentTarget(undefined)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: TYPOGRAPHY.pageTitle, fontFamily: "Inter_700Bold" },
  headerSubtitle: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_400Regular", marginTop: 2 },
  addButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  pageContent: { paddingHorizontal: 17, paddingTop: 15, gap: 12 },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryCard: { flex: 1, minWidth: 0, minHeight: 85, paddingHorizontal: 10, paddingVertical: 11, borderRadius: 14, borderWidth: 1, justifyContent: "space-between" },
  summaryDot: { width: 7, height: 7, borderRadius: 4 },
  summaryLabel: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium", marginTop: 6 },
  summaryValue: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_700Bold", marginTop: 3 },
  countRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 2 },
  countText: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium" },
  countDot: { width: 3, height: 3, borderRadius: 2 },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  sectionHeading: { fontSize: TYPOGRAPHY.sectionHeading, fontFamily: "Inter_700Bold" },
  addInline: { flexDirection: "row", alignItems: "center", gap: 4, padding: 5 },
  addInlineText: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_600SemiBold" },
  filterRow: { flexDirection: "row", gap: 7, paddingRight: 10 },
  filterChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  filterText: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold" },
  loanList: { gap: 10 },
  loanCard: { padding: 14, borderRadius: 17, borderWidth: 1, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  loanIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  loanName: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_700Bold" },
  counterparty: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", marginTop: 3 },
  tagRow: { flexDirection: "row", gap: 6 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
  statusText: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold" },
  balanceRow: { flexDirection: "row", gap: 10 },
  cardLabel: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular" },
  cardAmount: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_700Bold", marginTop: 3 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  progressCaptionRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  progressCaption: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium" },
  emptyState: { alignItems: "center", paddingHorizontal: 26, paddingVertical: 36, gap: 8 },
  emptyIcon: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  emptyTitle: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_700Bold" },
  emptyDescription: { fontSize: TYPOGRAPHY.bodySmall, lineHeight: 19, textAlign: "center", fontFamily: "Inter_400Regular" },
  emptyButton: { paddingHorizontal: 15, height: 42, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  formSheet: { maxHeight: "94%", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 18 },
  paymentSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 11, paddingBottom: 28 },
  detailSheet: { height: "94%", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 17, paddingTop: 11 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  modalTitle: { fontSize: TYPOGRAPHY.dialogTitle, fontFamily: "Inter_700Bold" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 12, marginTop: 5 },
  choiceChip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1 },
  choiceText: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: TYPOGRAPHY.sectionHeading, fontFamily: "Inter_700Bold", marginTop: 8, marginBottom: 9 },
  fieldWrap: { flex: 1, marginBottom: 10 },
  fieldLabel: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium", marginBottom: 5 },
  input: { minHeight: 45, borderRadius: 11, paddingHorizontal: 12, fontSize: 16, fontFamily: "Inter_400Regular", borderWidth: 1 },
  multilineInput: { minHeight: 70, paddingTop: 11 },
  optionalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 5 },
  errorText: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium", marginVertical: 7 },
  helperText: { fontSize: TYPOGRAPHY.bodySmall, lineHeight: 19, fontFamily: "Inter_400Regular", marginBottom: 12 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  actionButton: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  actionText: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_600SemiBold" },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 7, paddingBottom: 13 },
  detailTitle: { fontSize: TYPOGRAPHY.dialogTitle, fontFamily: "Inter_700Bold" },
  detailSubtitle: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", marginTop: 3 },
  headerIcon: { width: 33, height: 33, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  detailContent: { paddingBottom: 28, gap: 11 },
  outstandingCard: { borderRadius: 17, padding: 16, borderWidth: 1, gap: 10 },
  outstandingTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  detailLabel: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium" },
  outstandingValue: { fontSize: TYPOGRAPHY.heroValue, fontFamily: "Inter_700Bold" },
  recordButton: { minHeight: 46, borderRadius: 12, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  infoCard: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 6 },
  infoLabel: { flex: 1, fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular" },
  infoValue: { flexShrink: 1, fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  noteText: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", paddingBottom: 5 },
  historyHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 2 },
  historyCount: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium" },
  paymentRow: { flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, paddingVertical: 9 },
  paymentIcon: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  paymentTitle: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold" },
  paymentMeta: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", marginTop: 2 },
  paymentAmount: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_600SemiBold" },
  paymentControl: { width: 23, height: 30, alignItems: "center", justifyContent: "center" },
  infoNote: { fontSize: TYPOGRAPHY.supporting, lineHeight: 16, fontFamily: "Inter_400Regular", paddingHorizontal: 3 },
  deleteLoanButton: { minHeight: 44, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
