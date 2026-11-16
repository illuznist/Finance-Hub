import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { OnlineAccountSecuritySection } from "@/components/OnlineAccountMfa";
import { useOnlineAccount } from "@/context/OnlineAccountContext";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";
import { TYPOGRAPHY } from "@/constants/typography";
import { classifyOnlineAuthError } from "@/security/onlineAuthError";

type FormMode = "sign-in" | "sign-up" | "recovery" | null;

export function OnlineAccountSettings() {
  const colors = useColors();
  const { t, isRTL } = usePreferences();
  const online = useOnlineAccount();
  const [mode, setMode] = useState<FormMode>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError(t("Enter your email address."));
      return;
    }
    if (mode !== "recovery" && password.length < 8) {
      setError(t("Use at least 8 characters for your password."));
      return;
    }
    if (mode === "sign-up" && password !== confirmPassword) {
      setError(t("Passwords do not match."));
      return;
    }

    setBusy(true);
    try {
      if (mode === "sign-up") {
        const signedIn = await online.signUp(email, password);
        setNotice(t(signedIn ? "Online account created." : "Check your email to verify your online account."));
        setMode(signedIn ? null : "sign-in");
        setPassword("");
        setConfirmPassword("");
      } else if (mode === "sign-in") {
        await online.signIn(email, password);
        setNotice(null);
        setMode(null);
        setPassword("");
        setConfirmPassword("");
      } else if (mode === "recovery") {
        await online.sendPasswordRecovery(email);
        setNotice(t("If the account exists, a password recovery email has been sent."));
        setMode(null);
      }
    } catch (submitError) {
      const category = classifyOnlineAuthError(submitError);
      setError(
        t(
          category === "rate-limit"
            ? "Too many requests. Please wait a little and try again."
            : category === "network"
              ? "Could not connect to the account service. Check your connection and try again."
              : "Online account action failed. Please try again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOutOnline() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await online.signOut();
      setNotice(t("Online account signed out. Your local profile and financial records are unchanged."));
    } catch {
      setError(t("Online account action failed. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground },
  ];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.identityRow, { flexDirection: isRTL ? "row-reverse" : "row" }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + "20" }]}>
          <Feather name="cloud" size={17} color={colors.primary} />
        </View>
        <View style={styles.identityCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>{t("Online account")}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {t("Online access is optional. Finance records stay on this device and are not uploaded.")}
          </Text>
        </View>
      </View>

      {online.loading ? (
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{t("Checking online account…")}</Text>
      ) : !online.configured ? (
        <>
          <Text style={[styles.status, { color: colors.mutedForeground }]}>
            {t(online.configurationError ? "Online account setup needs configuration." : "Online accounts are not configured yet.")}
          </Text>
          <PrimaryButton label={t("Continue without online account")} disabled={busy} onPress={() => setMode(null)} />
        </>
      ) : online.user && mode === "recovery" ? (
        <View style={styles.form}>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {t("Enter your account email to receive a secure password reset link.")}
          </Text>
          <TextInput
            accessibilityLabel={t("Email")}
            testID="online-account-email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            placeholder={t("Email")}
            placeholderTextColor={colors.mutedForeground}
            style={inputStyle}
          />
          {error ? <Text accessibilityRole="alert" style={[styles.message, { color: colors.destructive }]}>{error}</Text> : null}
          <PrimaryButton
            testID="online-account-submit"
            label={t(busy ? "Please wait…" : "Send recovery email")}
            disabled={busy}
            loading={busy}
            onPress={() => void submit()}
          />
          <ActionButton
            label={t("Cancel")}
            disabled={busy}
            onPress={() => { setMode(null); setError(null); }}
            colors={colors}
          />
        </View>
      ) : online.user ? (
        <>
          <OnlineAccountSecuritySection />
          <ActionButton
            testID="online-account-recovery"
            label={t("Send password recovery email")}
            disabled={busy}
            onPress={() => {
              setEmail(online.user?.email ?? "");
              setMode("recovery");
              setNotice(null);
              setError(null);
            }}
            colors={colors}
          />
          <ActionButton label={t("Sign out of online account")} disabled={busy} onPress={() => void signOutOnline()} colors={colors} />
        </>
      ) : (
        <>
          {mode ? (
            <View style={styles.form}>
              <TextInput
                accessibilityLabel={t("Email")}
                testID="online-account-email"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
                placeholder={t("Email")}
                placeholderTextColor={colors.mutedForeground}
                style={inputStyle}
              />
              {mode !== "recovery" ? (
                <TextInput
                  accessibilityLabel={t("Password")}
                  testID="online-account-password"
                  autoCapitalize="none"
                  autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
                  textContentType={mode === "sign-up" ? "newPassword" : "password"}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t("Password")}
                  placeholderTextColor={colors.mutedForeground}
                  style={inputStyle}
                />
              ) : null}
              {mode === "sign-up" ? (
                <TextInput
                  accessibilityLabel={t("Confirm password")}
                  testID="online-account-password-confirm"
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t("Confirm password")}
                  placeholderTextColor={colors.mutedForeground}
                  style={inputStyle}
                />
              ) : null}
              {error ? <Text accessibilityRole="alert" style={[styles.message, { color: colors.destructive }]}>{error}</Text> : null}
              <PrimaryButton
                testID="online-account-submit"
                label={t(busy ? "Please wait…" : mode === "sign-up" ? "Create online account" : mode === "sign-in" ? "Sign in" : "Send recovery email")}
                disabled={busy}
                loading={busy}
                onPress={() => void submit()}
              />
              <ActionButton
                label={t("Cancel")}
                disabled={busy}
                onPress={() => { setMode(null); setError(null); }}
                colors={colors}
              />
            </View>
          ) : (
            <View style={styles.actions}>
              <PrimaryButton
                testID="online-account-create"
                label={t("Create online account")}
                disabled={busy}
                onPress={() => { setMode("sign-up"); setNotice(null); setError(null); }}
              />
              <ActionButton
                testID="online-account-sign-in"
                label={t("Sign in")}
                disabled={busy}
                onPress={() => { setMode("sign-in"); setNotice(null); setError(null); }}
                colors={colors}
              />
              <Pressable
                testID="online-account-continue-local"
                accessibilityRole="button"
                disabled={busy}
                onPress={() => setMode(null)}
                style={styles.continueButton}
              >
                <Text style={[styles.link, { color: colors.primary }]}>{t("Continue without online account")}</Text>
              </Pressable>
            </View>
          )}
        </>
      )}
      {notice ? <Text accessibilityRole="alert" style={[styles.message, { color: colors.success }]}>{notice}</Text> : null}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  testID,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  testID?: string;
  loading?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: disabled ? 0.6 : 1, flexDirection: "row", gap: 8 }]}
    >
      {loading ? <ActivityIndicator size="small" color={colors.primaryForeground} /> : null}
      <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  onPress,
  disabled,
  colors,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  colors: ReturnType<typeof useColors>;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, { borderColor: colors.border, opacity: disabled ? 0.6 : 1 }]}
    >
      <Text style={[styles.actionText, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 12, marginBottom: 2 },
  identityRow: { alignItems: "center", gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  identityCopy: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_600SemiBold" },
  body: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_400Regular", lineHeight: 19 },
  bodyStrong: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_600SemiBold", textAlign: "auto", flexShrink: 1 },
  status: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_500Medium", lineHeight: 20 },
  form: { gap: 10 },
  actions: { gap: 8 },
  input: { width: "100%", minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, fontSize: TYPOGRAPHY.body, fontFamily: "Inter_400Regular" },
  primaryButton: { minHeight: 46, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, paddingVertical: 10 },
  buttonText: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  actionButton: { minHeight: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, paddingVertical: 9 },
  actionText: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_500Medium", textAlign: "center" },
  continueButton: { minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  link: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  message: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_500Medium", lineHeight: 20 },
});
