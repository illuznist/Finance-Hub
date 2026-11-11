import React from "react";
import { ScrollView, Pressable, Text, View } from "react-native";
import { useFinance } from "@/context/FinanceContext";
import { useColors } from "@/hooks/useColors";

export function PaymentAccountPicker({ value, onChange, currency }: {
  value?: string; onChange: (id: string | undefined) => void; currency?: string;
}) {
  const finance = useFinance();
  const colors = useColors();
  const options = [{ id: undefined, name: "Unassigned" }, ...finance.accounts.filter(a => (a.currency ?? finance.currency) === (currency ?? finance.currency))];
  return (
    <View style={{ gap: 8, marginBottom: 16 }}>
      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: colors.mutedForeground }}>Account</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {options.map(a => (
          <Pressable key={a.id ?? "unassigned"} testID={`payment-account-${a.id ?? "unassigned"}`}
            accessibilityRole="button" accessibilityState={{ selected: value === a.id }}
            onPress={() => onChange(a.id)}
            style={{ paddingHorizontal: 14, paddingVertical: 12, borderRadius: 22, backgroundColor: value === a.id ? colors.primary : colors.muted }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13, color: value === a.id ? colors.primaryForeground : colors.foreground }}>{a.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {!value && <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>Recorded without changing an account balance.</Text>}
    </View>
  );
}
