import React, { useRef, useState } from "react";
import { Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type Expense, useFinance } from "@/context/FinanceContext";
import { useColors } from "@/hooks/useColors";
import { formatAppCurrency } from "@/i18n/localization";
import { usePreferences } from "@/context/PreferencesContext";
import { localDate, validLocalDate } from "@/finance/ledger";
import { PaymentAccountPicker } from "./PaymentAccountPicker";
import { KeyboardAwareScrollViewCompat } from "./KeyboardAwareScrollViewCompat";

export function ExpensePaymentModal({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const finance = useFinance();
  const colors = useColors();
  const { t } = usePreferences();
  const insets = useSafeAreaInsets();
  const [accountId, setAccountId] = useState(expense.accountId);
  const [date, setDate] = useState(localDate());
  const [error, setError] = useState("");
  const submitted = useRef(false);
  const inputStyle = { backgroundColor: colors.muted, color: colors.foreground, borderRadius: 12, padding: 14, fontFamily: "Inter_400Regular", fontSize: 14 };
  function save() {
    if (submitted.current) return;
    if (!validLocalDate(date)) return setError("Enter a valid date in YYYY-MM-DD format.");
    submitted.current = true;
    if (finance.setExpensePaid(expense.id, true, accountId, date)) onClose();
    else { submitted.current = false; setError("Payment could not be saved. Check the storage message and retry."); }
  }
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.foreground + "66" }}>
        <KeyboardAwareScrollViewCompat keyboardShouldPersistTaps="handled" bottomOffset={24}
          style={{ maxHeight: "85%", flexGrow: 0, backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
          contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 24 + (Platform.OS === "web" ? 34 : insets.bottom) }}>
          <Text style={{ color: colors.foreground, fontSize: 20, fontFamily: "Inter_700Bold" }}>{t("Confirm payment")}</Text>
          <Text style={{ color: colors.foreground, fontSize: 16, fontFamily: "Inter_600SemiBold" }}>{expense.name} · {formatAppCurrency(expense.amount, expense.currency ?? finance.currency, { maximumFractionDigits: 0 })}</Text>
          <PaymentAccountPicker value={accountId} onChange={setAccountId} currency={expense.currency} />
          <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{t("Payment date")}</Text>
          <TextInput testID="expense-payment-date" accessibilityLabel="Payment date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={inputStyle} />
          {!!error && <Text accessibilityRole="alert" style={{ color: colors.destructive }}>{error}</Text>}
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable onPress={onClose} style={{ flex: 1, padding: 16, borderRadius: 14, backgroundColor: colors.muted }}><Text style={{ textAlign: "center", color: colors.foreground }}>{t("Cancel")}</Text></Pressable>
            <Pressable testID="expense-payment-confirm" onPress={save} style={{ flex: 1, padding: 16, borderRadius: 14, backgroundColor: colors.primary }}><Text style={{ textAlign: "center", color: colors.primaryForeground }}>{t("Confirm")}</Text></Pressable>
          </View>
        </KeyboardAwareScrollViewCompat>
      </View>
    </Modal>
  );
}
