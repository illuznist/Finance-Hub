import * as ScreenCapture from "expo-screen-capture";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useFinance } from "@/context/FinanceContext";
import { useColors } from "@/hooks/useColors";
import { lockOnResume, lockWhenBackgrounded } from "@/security/appLockPolicy";

function PasswordRecovery({
  visible,
  onCancel,
  onRecover,
}: {
  visible: boolean;
  onCancel: () => void;
  onRecover: (password: string) => Promise<boolean>;
}) {
  const colors = useColors();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!password || busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (await onRecover(password)) {
        setPassword("");
        onCancel();
      } else {
        setMessage("That account password was not correct.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Password recovery could not complete. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalShade}>
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Reset app lock</Text>
          <Text style={[styles.modalCopy, { color: colors.mutedForeground }]}>
            Verify your account password to remove the unavailable PIN. Your finance records will stay unchanged.
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Account password"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="done"
            onSubmitEditing={submit}
            style={[styles.passwordInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
          />
          {!!message && <Text style={[styles.error, { color: colors.destructive }]}>{message}</Text>}
          <View style={styles.modalActions}>
            <Pressable onPress={onCancel} style={styles.modalAction}>
              <Text style={{ color: colors.mutedForeground, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={busy}
              style={[styles.modalAction, { backgroundColor: colors.primary, borderRadius: 12 }]}
            >
              <Text style={{ color: colors.primaryForeground, fontWeight: "700" }}>
                {busy ? "Checking…" : "Verify"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PinEntry({
  onUnlock,
  onVerify,
  onRecovery,
  showBiometric,
  biometricLabel,
  onBiometricPress,
  privacyWarning,
}: {
  onUnlock: () => void;
  onVerify: (pin: string) => Promise<{ ok: boolean; retryAfterMs?: number; warning?: string }>;
  onRecovery: () => void;
  showBiometric: boolean;
  biometricLabel: string;
  onBiometricPress: () => void;
  privacyWarning: string | null;
}) {
  const colors = useColors();
  const [entered, setEntered] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!lockedUntil) return;
    const update = () => {
      const remaining = Math.max(0, lockedUntil - Date.now());
      setRemainingSeconds(Math.ceil(remaining / 1000));
      if (!remaining) {
        setLockedUntil(0);
        setMessage("");
      }
    };
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  async function appendDigit(digit: string) {
    if (busy || lockedUntil > Date.now() || entered.length >= 4) return;
    const next = entered + digit;
    setEntered(next);
    setMessage("");
    if (next.length !== 4) return;
    setBusy(true);
    try {
      const result = await onVerify(next);
      if (result.ok) {
        if (result.warning) setNotice(result.warning);
        onUnlock();
      } else if (result.retryAfterMs) {
        setLockedUntil(Date.now() + result.retryAfterMs);
        setMessage("Too many attempts. Wait before trying again.");
      } else if (result.warning) {
        setNotice(result.warning);
      } else {
        setMessage("Incorrect PIN. Try again or use account-password recovery.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PIN could not be verified. Use account-password recovery.");
    } finally {
      setEntered("");
      setBusy(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.lockIcon, { backgroundColor: colors.primary + "18" }]}>
        <Feather name="lock" size={25} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>Unlock FinanceApp</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Enter your 4-digit app PIN</Text>

      <View style={styles.dotsRow}>
        {[0, 1, 2, 3].map(index => (
          <View
            key={index}
            style={[
              styles.dot,
              { backgroundColor: index < entered.length ? colors.primary : "transparent", borderColor: index < entered.length ? colors.primary : colors.border },
            ]}
          />
        ))}
      </View>

      {!!message && <Text style={[styles.error, { color: colors.destructive }]}>{message}</Text>}
      {remainingSeconds > 0 && (
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Try again in {remainingSeconds}s</Text>
      )}
      {!!privacyWarning && <Text style={[styles.privacyWarning, { color: colors.mutedForeground }]}>{privacyWarning}</Text>}
      {!!notice && <Text style={[styles.privacyWarning, { color: colors.mutedForeground }]}>{notice}</Text>}

      <View style={styles.numpad}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "delete"].map((key, index) => (
          <Pressable
            key={index}
            disabled={!key || busy || remainingSeconds > 0}
            onPress={() => key === "delete" ? setEntered(value => value.slice(0, -1)) : appendDigit(key)}
            style={({ pressed }) => [styles.numKey, { opacity: !key ? 0 : pressed ? 0.6 : 1 }]}
          >
            {key === "delete"
              ? <Feather name="delete" size={21} color={colors.foreground} />
              : <Text style={[styles.numKeyText, { color: colors.foreground }]}>{key}</Text>}
          </Pressable>
        ))}
      </View>

      {busy && <ActivityIndicator color={colors.primary} style={{ marginBottom: 12 }} />}
      {showBiometric && (
        <Pressable onPress={onBiometricPress} style={styles.secondaryAction}>
          <Feather name="unlock" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "600" }}>{biometricLabel}</Text>
        </Pressable>
      )}
      <Pressable onPress={onRecovery} style={styles.recoveryAction}>
        <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Forgot PIN? Use account password</Text>
      </Pressable>
    </View>
  );
}

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const finance = useFinance();
  const colors = useColors();
  const [status, setStatus] = useState<"loading" | "locked" | "open">("loading");
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const [privacyWarning, setPrivacyWarning] = useState<string | null>(null);
  const initialized = useRef(false);
  const backgroundAt = useRef<number | null>(null);
  const pinEnabled = finance.securitySettings.pinEnabled;
  const biometricAvailable = auth.biometricAvailable && auth.biometricEnabled && Platform.OS !== "web";
  const biometricLabel = auth.biometricType === "face" ? "Use Face ID" : "Use fingerprint";

  useEffect(() => {
    if (auth.isLoading || !finance.isReady) return;
    if (!pinEnabled) {
      initialized.current = true;
      setStatus("open");
      return;
    }
    setStatus("locked");
    if (!initialized.current) {
      initialized.current = true;
      if (biometricAvailable) {
        void auth.signInWithBiometric().then(success => {
          if (success) setStatus("open");
        });
      }
    }
  }, [auth.isLoading, auth.signInWithBiometric, biometricAvailable, finance.isReady, pinEnabled]);

  useEffect(() => {
    if (!pinEnabled || Platform.OS === "web") return;
    let active = true;
    let screenCaptureEnabled = false;
    let appSwitcherEnabled = false;
    void (async () => {
      try {
        await ScreenCapture.preventScreenCaptureAsync("financeapp-private");
        if (!active) {
          await ScreenCapture.allowScreenCaptureAsync("financeapp-private");
          return;
        }
        screenCaptureEnabled = true;
        if (Platform.OS === "ios") {
          await ScreenCapture.enableAppSwitcherProtectionAsync(0.45);
          if (!active) {
            await ScreenCapture.disableAppSwitcherProtectionAsync();
            return;
          }
          appSwitcherEnabled = true;
        }
      } catch {
        if (active) setPrivacyWarning("Screen privacy protection is unavailable on this device; app locking remains enabled.");
      }
    })();
    return () => {
      active = false;
      if (screenCaptureEnabled) void ScreenCapture.allowScreenCaptureAsync("financeapp-private").catch(() => {});
      if (appSwitcherEnabled && Platform.OS === "ios") void ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => {});
    };
  }, [pinEnabled]);

  useEffect(() => {
    if (!pinEnabled || Platform.OS === "web") return;
    const subscription = AppState.addEventListener("change", next => {
      if (next === "inactive" || next === "background") {
        backgroundAt.current = Date.now();
        if (lockWhenBackgrounded(finance.securitySettings.autoLockMinutes)) setStatus("locked");
        return;
      }
      if (next === "active" && backgroundAt.current !== null) {
        const elapsed = Date.now() - backgroundAt.current;
        if (lockOnResume(finance.securitySettings.autoLockMinutes, elapsed)) setStatus("locked");
        backgroundAt.current = null;
      }
    });
    return () => subscription.remove();
  }, [finance.securitySettings.autoLockMinutes, pinEnabled]);

  async function recoverWithPassword(password: string): Promise<boolean> {
    if (!(await auth.verifyAccountPassword(password))) return false;
    await auth.clearPin();
    await finance.setSecuritySettings({ ...finance.securitySettings, pinEnabled: false });
    setStatus("open");
    return true;
  }

  async function unlockWithBiometric() {
    const unlocked = await auth.signInWithBiometric();
    if (unlocked) setStatus("open");
  }

  if (status === "loading" || !finance.isReady) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (status === "locked") {
    return (
      <>
        <PinEntry
          onUnlock={() => setStatus("open")}
          onVerify={auth.verifyPin}
          onRecovery={() => setRecoveryVisible(true)}
          showBiometric={biometricAvailable}
          biometricLabel={biometricLabel}
          onBiometricPress={unlockWithBiometric}
          privacyWarning={privacyWarning}
        />
        <PasswordRecovery
          visible={recoveryVisible}
          onCancel={() => setRecoveryVisible(false)}
          onRecover={recoverWithPassword}
        />
      </>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  lockIcon: { width: 68, height: 68, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subtitle: { fontSize: 15, marginBottom: 12, textAlign: "center" },
  dotsRow: { flexDirection: "row", gap: 18, marginTop: 24, marginBottom: 20 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  error: { textAlign: "center", marginBottom: 12, maxWidth: 320, fontSize: 13 },
  privacyWarning: { textAlign: "center", marginBottom: 10, maxWidth: 320, fontSize: 12 },
  numpad: { width: 280, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginBottom: 18 },
  numKey: { width: 82, height: 58, alignItems: "center", justifyContent: "center", margin: 4, borderRadius: 16 },
  numKeyText: { fontSize: 25, fontWeight: "500" },
  secondaryAction: { flexDirection: "row", gap: 9, alignItems: "center", paddingVertical: 12 },
  recoveryAction: { paddingVertical: 14 },
  modalShade: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(0,0,0,0.55)" },
  modalCard: { borderWidth: 1, borderRadius: 22, padding: 22 },
  modalTitle: { fontSize: 20, fontWeight: "700" },
  modalCopy: { fontSize: 14, lineHeight: 21, marginTop: 8 },
  passwordInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, marginTop: 18 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  modalAction: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center" },
});
