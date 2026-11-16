import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useOnlineAccount } from "@/context/OnlineAccountContext";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";
import { supabaseClient } from "@/lib/supabase";
import { TYPOGRAPHY } from "@/constants/typography";
import {
  classifyProtectedMetadataResponse,
  type ProtectedMetadataOutcome,
} from "@/security/rlsProbeResult";

type RoleOutcome = "passed" | "unexpected" | "unavailable";

type DiagnosticResult = {
  ownRole: RoleOutcome;
  otherRole: RoleOutcome;
  protectedMetadata: {
    grants: ProtectedMetadataOutcome;
    purchaseLinks: ProtectedMetadataOutcome;
    auditLogs: ProtectedMetadataOutcome;
    webhookInbox: ProtectedMetadataOutcome;
  };
};

const USER_ID_PATTERN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function OnlineAccountRlsDiagnostic() {
  const colors = useColors();
  const { t, isRTL } = usePreferences();
  const online = useOnlineAccount();
  const [otherUserId, setOtherUserId] = useState("");
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  async function checkRls() {
    const currentUserId = online.user?.id;
    const comparisonUserId = otherUserId.trim();
    setMessage(null);
    setResult(null);

    if (!currentUserId || !supabaseClient) {
      setMessage(t("RLS check unavailable."));
      return;
    }
    if (!USER_ID_PATTERN.test(comparisonUserId) || comparisonUserId.toLowerCase() === currentUserId.toLowerCase()) {
      setMessage(t("Enter a different valid account ID."));
      return;
    }

    setOtherUserId("");
    setChecking(true);
    try {
      const client = supabaseClient;
      const [ownRole, otherRole, grants, purchaseLinks, auditLogs, webhookInbox] = await Promise.all([
        client.from("user_roles").select("role").eq("user_id", currentUserId),
        client.from("user_roles").select("role").eq("user_id", comparisonUserId),
        client.from("promotional_grants").select("id").limit(1),
        client.from("revenuecat_identity_links").select("id").limit(1),
        client.from("admin_audit_logs").select("id").limit(1),
        client.from("webhook_inbox").select("event_id").limit(1),
      ]);

      const ownRoles = ownRole.data?.map((row) => row.role) ?? [];
      const signedInUserConfirmed =
        !ownRole.error && ownRoles.length === 1 && ownRoles[0] === "USER";
      setResult({
        ownRole: ownRole.error
          ? "unavailable"
          : signedInUserConfirmed ? "passed" : "unexpected",
        otherRole: otherRole.error
          ? "unavailable"
          : otherRole.data?.length === 0
            ? "passed"
            : "unexpected",
        protectedMetadata: {
          grants: classifyProtectedMetadataResponse(grants, signedInUserConfirmed),
          purchaseLinks: classifyProtectedMetadataResponse(purchaseLinks, signedInUserConfirmed),
          auditLogs: classifyProtectedMetadataResponse(auditLogs, signedInUserConfirmed),
          webhookInbox: classifyProtectedMetadataResponse(webhookInbox, signedInUserConfirmed),
        },
      });
    } catch {
      setMessage(t("RLS check unavailable."));
    } finally {
      setChecking(false);
    }
  }

  const resultLabel = (outcome: RoleOutcome) =>
    t(outcome === "passed" ? "Passed" : outcome === "unexpected" ? "Unexpected access" : "Could not verify");
  const metadataLabel = (outcome: ProtectedMetadataOutcome) => {
    switch (outcome) {
      case "blocked":
        return t("Blocked");
      case "empty":
        return t("No visible rows; not proof of blocking");
      case "unexpected-access":
        return t("Unexpected access");
      case "missing-schema":
        return t("Table or schema missing");
      case "authentication-failed":
        return t("Authentication/session failed");
      case "network-failed":
        return t("Network unavailable");
      default:
        return t("Could not verify");
    }
  };

  return (
    <View style={[styles.panel, { backgroundColor: colors.input, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>{t("Development-only RLS check")}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        {t("Tap for read-only checks. The account ID is masked; at most one metadata ID per table is checked and discarded. Nothing is saved or logged.")}
      </Text>
      <TextInput
        accessibilityLabel={t("Other ordinary account ID")}
        testID="online-rls-other-user-id"
        value={otherUserId}
        onChangeText={setOtherUserId}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        placeholder={t("Other ordinary account ID")}
        placeholderTextColor={colors.mutedForeground}
        style={[
          styles.input,
          { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: checking, busy: checking }}
        testID="online-rls-run-check"
        disabled={checking}
        onPress={() => void checkRls()}
        style={[
          styles.button,
          { borderColor: colors.border, opacity: checking ? 0.6 : 1, flexDirection: isRTL ? "row-reverse" : "row" },
        ]}
      >
        {checking ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        <Text style={[styles.buttonText, { color: colors.foreground }]}>
          {t(checking ? "Checking…" : "Check account access")}
        </Text>
      </Pressable>
      {message ? <Text accessibilityRole="alert" style={[styles.body, { color: colors.warning }]}>{message}</Text> : null}
      {result ? (
        <View testID="online-rls-results" style={styles.results}>
          <ResultRow label={t("Own USER role visible")} value={resultLabel(result.ownRole)} colors={colors} isRTL={isRTL} />
          <ResultRow label={t("Other account role hidden")} value={resultLabel(result.otherRole)} colors={colors} isRTL={isRTL} />
          <ResultRow label={t("Promotional grants")} value={metadataLabel(result.protectedMetadata.grants)} colors={colors} isRTL={isRTL} />
          <ResultRow label={t("Purchase identity links")} value={metadataLabel(result.protectedMetadata.purchaseLinks)} colors={colors} isRTL={isRTL} />
          <ResultRow label={t("Admin audit metadata")} value={metadataLabel(result.protectedMetadata.auditLogs)} colors={colors} isRTL={isRTL} />
          <ResultRow label={t("Webhook metadata")} value={metadataLabel(result.protectedMetadata.webhookInbox)} colors={colors} isRTL={isRTL} />
        </View>
      ) : null}
    </View>
  );
}

function ResultRow({
  label,
  value,
  colors,
  isRTL,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
}) {
  return (
    <View style={[styles.resultRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
      <Text style={[styles.body, { color: colors.mutedForeground, flex: 1 }]}>{label}</Text>
      <Text style={[styles.resultValue, { color: colors.foreground, textAlign: isRTL ? "left" : "right" }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 9 },
  title: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_600SemiBold" },
  body: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_400Regular", lineHeight: 19 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_400Regular", textAlign: "left" },
  button: { minHeight: 42, borderWidth: 1, borderRadius: 11, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  buttonText: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_600SemiBold" },
  results: { gap: 5, paddingTop: 3 },
  resultRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  resultValue: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_600SemiBold", textAlign: "right" },
});
