import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useOnlineAccount } from "@/context/OnlineAccountContext";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";
import { TYPOGRAPHY } from "@/constants/typography";
import { classifyRecoveryLinkError } from "@/security/onlineAuthError";

function firstQueryString(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null;
}

function recoveryErrorMessage(category: ReturnType<typeof classifyRecoveryLinkError>): string {
  switch (category) {
    case "expired-or-used":
      return "This recovery link has expired or was already used. Request a new email and open its latest link once.";
    case "missing-verifier":
      return "This recovery link has no matching Expo Go session. Request a new link and open it on the same iPhone in the same Expo Go app.";
    case "rate-limit":
      return "Supabase temporarily limited link verification. Wait a few minutes before requesting another recovery email.";
    case "network":
      return "The recovery link could not be verified because the connection failed. Check your connection; the link may already have been used.";
    default:
      return "This recovery link could not be verified. No password was changed. Wait a few minutes, then request a fresh link.";
  }
}

export default function OnlineAuthCallbackScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const url = Linking.useURL();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const online = useOnlineAccount();
  const { t, isRTL } = usePreferences();
  const [callbackDone, setCallbackDone] = useState(false);
  const [callbackErrorKey, setCallbackErrorKey] = useState<string | null>(null);
  const [callbackProcessing, setCallbackProcessing] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const handledCode = useRef<string | null>(null);
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  const urlParams = url ? Linking.parse(url).queryParams : null;
  const urlCode = firstQueryString(urlParams?.code);
  const callbackCode = code ?? urlCode;
  const linkErrorCode = firstQueryString(urlParams?.error_code) ?? firstQueryString(urlParams?.error);
  const linkErrorDescription = firstQueryString(urlParams?.error_description);

  useEffect(() => {
    if (!online.configured) {
      setCallbackErrorKey("Online accounts are not configured yet.");
      setCallbackProcessing(false);
      return;
    }
    if (!url && !code) return;
    if (!callbackCode) {
      setCallbackErrorKey(
        linkErrorCode || linkErrorDescription
          ? recoveryErrorMessage(classifyRecoveryLinkError({
              code: linkErrorCode ?? undefined,
              message: linkErrorDescription ?? undefined,
            }))
          : "This recovery link did not include a code. Open the latest email link in Expo Go. If this continues, check the Supabase recovery email template.",
      );
      setCallbackProcessing(false);
      return;
    }
    if (handledCode.current === callbackCode) return;
    handledCode.current = callbackCode;

    let active = true;
    setCallbackErrorKey(null);
    setCallbackProcessing(true);
    void online.handleAuthCallback(callbackCode)
      .then((handled) => {
        if (active) {
          setCallbackDone(handled);
          setCallbackErrorKey(
            handled
              ? null
              : "This recovery link did not include a code. Open the latest email link in Expo Go. If this continues, check the Supabase recovery email template.",
          );
        }
      })
      .catch((callbackError) => {
        if (active) setCallbackErrorKey(recoveryErrorMessage(classifyRecoveryLinkError(callbackError)));
      })
      .finally(() => {
        if (active) setCallbackProcessing(false);
      });
    return () => { active = false; };
  }, [url, code, callbackCode, linkErrorCode, linkErrorDescription, online.configured, online.handleAuthCallback]);

  async function saveNewPassword() {
    setPasswordError(null);
    if (password.length < 8) {
      setPasswordError(t("Use at least 8 characters for your password."));
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError(t("Passwords do not match."));
      return;
    }
    setSaving(true);
    try {
      await online.completePasswordRecovery(password);
      online.clearPasswordRecovery();
      setPassword("");
      setConfirmPassword("");
      setPasswordUpdated(true);
    } catch {
      setPasswordError(t("Password could not be updated. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={t("Online account")}
        topInset={topInset}
        colors={colors}
        leading={
          <Pressable accessibilityRole="button" accessibilityLabel={t("Back")} onPress={() => router.back()} style={styles.back}>
            <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={21} color={colors.foreground} />
          </Pressable>
        }
      />
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{ padding: 20, paddingBottom: 32 + Math.max(insets.bottom, Platform.OS === "web" ? 34 : 0), gap: 14 }}
        bottomOffset={24}
      >
        {online.needsPasswordRecovery ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>{t("Set a new password")}</Text>
            <TextInput
              accessibilityLabel={t("New password")}
              testID="online-recovery-password"
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder={t("New password")}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            />
            <TextInput
              accessibilityLabel={t("Confirm new password")}
              testID="online-recovery-password-confirm"
              autoCapitalize="none"
              autoComplete="new-password"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t("Confirm new password")}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
            />
            {passwordError ? <Text accessibilityRole="alert" style={[styles.note, { color: colors.destructive }]}>{passwordError}</Text> : null}
            <Pressable
              testID="online-recovery-save"
              accessibilityRole="button"
              accessibilityState={{ disabled: saving, busy: saving }}
              onPress={() => void saveNewPassword()}
              disabled={saving}
              style={[styles.button, { backgroundColor: colors.primary, opacity: saving ? 0.65 : 1, flexDirection: "row", gap: 8 }]}
            >
              {saving ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : null}
              <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{t(saving ? "Saving…" : "Update password")}</Text>
            </Pressable>
          </View>
        ) : callbackProcessing ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: "center" }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.title, { color: colors.foreground }]}>{t("Verifying recovery link…")}</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name={callbackErrorKey ? "alert-circle" : "check-circle"} size={24} color={callbackErrorKey ? colors.warning : colors.success} />
            <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>
              {callbackErrorKey
                ? t("This account link could not be completed.")
                : passwordUpdated
                  ? t("Password updated successfully.")
                : callbackDone || online.user
                  ? t("Online account confirmed.")
                  : t("Complete your online account setup")}
            </Text>
            <Text style={[styles.note, { color: colors.mutedForeground }]}>
              {callbackErrorKey
                ? t(callbackErrorKey)
                : passwordUpdated
                  ? t("Your online account password has been changed. Your local financial records are unchanged.")
                : t("Your online account is separate from your local Finance Hub profile and financial records.")}
            </Text>
            <Pressable testID="online-callback-done" onPress={() => router.replace("/settings")} style={[styles.button, { backgroundColor: colors.primary }]}>
              <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{t("Return to Settings")}</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 12 },
  title: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_700Bold" },
  note: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_400Regular", lineHeight: 20 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: TYPOGRAPHY.body, fontFamily: "Inter_400Regular" },
  button: { minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  buttonText: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_600SemiBold" },
});
