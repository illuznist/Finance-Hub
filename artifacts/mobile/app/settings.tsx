import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as SecureStore from "expo-secure-store";

import { ScreenHeader } from "@/components/ScreenHeader";
import {
  type NotificationSettings,
  type SecuritySettings,
  SUPPORTED_CURRENCIES,
  PIN_STORAGE_KEY,
  useFinance,
} from "@/context/FinanceContext";
import { useAuth, PIN_SECURE_KEY } from "@/context/AuthContext";
import { useTheme, type ThemeMode } from "@/context/ThemeContext";
import { requestNotificationPermissions } from "@/utils/notifications";
import { useColors } from "@/hooks/useColors";
import { TYPOGRAPHY } from "@/constants/typography";

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>
      {title}
    </Text>
  );
}

function SettingRow({
  icon,
  label,
  right,
  onPress,
  iconColor,
  destructive,
}: {
  icon: string;
  label: string;
  right?: React.ReactNode;
  onPress?: () => void;
  iconColor?: string;
  destructive?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        { backgroundColor: colors.card, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View style={[styles.settingIconWrap, { backgroundColor: (iconColor ?? colors.primary) + "20" }]}>
        <Feather name={icon as any} size={17} color={iconColor ?? colors.primary} />
      </View>
      <Text style={[styles.settingLabel, { color: destructive ? colors.destructive : colors.foreground }]}>
        {label}
      </Text>
      <View style={{ flex: 1 }} />
      {right}
    </Pressable>
  );
}

function PinSetupModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (pin: string) => void;
}) {
  const colors = useColors();
  const [step, setStep] = useState<"enter" | "confirm">("enter");
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [error, setError] = useState(false);

  function reset() {
    setStep("enter");
    setFirst("");
    setSecond("");
    setError(false);
  }

  function handlePress(digit: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === "enter") {
      const next = first + digit;
      setFirst(next);
      if (next.length === 4) setStep("confirm");
    } else {
      const next = second + digit;
      setSecond(next);
      if (next.length === 4) {
        if (next === first) {
          onSave(next);
          reset();
        } else {
          setError(true);
          setSecond("");
          setTimeout(() => setError(false), 800);
        }
      }
    }
  }

  function handleBack() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step === "enter") setFirst(first.slice(0, -1));
    else setSecond(second.slice(0, -1));
  }

  const current = step === "enter" ? first : second;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onClose(); }}>
      <View style={styles.pinModalOverlay}>
        <View style={[styles.pinModalSheet, { backgroundColor: colors.card }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.pinTitle, { color: colors.foreground }]}>
            {step === "enter" ? "Set your PIN" : "Confirm your PIN"}
          </Text>
          <Text style={[styles.pinSubtitle, { color: colors.mutedForeground }]}>
            {step === "enter" ? "Enter a 4-digit PIN" : "Enter the PIN again to confirm"}
          </Text>

          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i < current.length
                        ? error ? colors.destructive : colors.primary
                        : colors.muted,
                    borderColor:
                      i < current.length
                        ? error ? colors.destructive : colors.primary
                        : colors.border,
                  },
                ]}
              />
            ))}
          </View>

          {error && (
            <Text style={[styles.pinError, { color: colors.destructive }]}>PINs don't match — try again</Text>
          )}

          <NumPad onPress={handlePress} onBackspace={handleBack} colors={colors} />

          <Pressable onPress={() => { reset(); onClose(); }} style={styles.cancelLink}>
            <Text style={[styles.cancelLinkText, { color: colors.mutedForeground }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function NumPad({
  onPress,
  onBackspace,
  colors,
}: {
  onPress: (d: string) => void;
  onBackspace: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  return (
    <View style={styles.numpad}>
      {keys.map((k, i) => (
        <Pressable
          key={i}
          onPress={() => k === "⌫" ? onBackspace() : k ? onPress(k) : undefined}
          style={({ pressed }) => [
            styles.numKey,
            {
              backgroundColor: k ? (pressed ? colors.primary + "30" : colors.muted) : "transparent",
              opacity: k === "" ? 0 : 1,
            },
          ]}
        >
          <Text style={[styles.numKeyText, { color: k === "⌫" ? colors.mutedForeground : colors.foreground }]}>
            {k}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const finance = useFinance();
  const auth = useAuth();
  const theme = useTheme();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(finance.userName);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetValue, setBudgetValue] = useState(finance.monthlyBudget.toString());
  const [showPinSetup, setShowPinSetup] = useState(false);

  const notif = finance.notificationSettings;
  const security = finance.securitySettings;

  async function updateNotif(updates: Partial<NotificationSettings>) {
    const next = { ...notif, ...updates };
    if (updates.enabled === true) {
      await requestNotificationPermissions();
    }
    finance.setNotificationSettings(next);
  }

  function updateSecurity(updates: Partial<SecuritySettings>) {
    finance.setSecuritySettings({ ...security, ...updates });
  }

  function handlePinToggle(value: boolean) {
    if (value) {
      setShowPinSetup(true);
    } else {
      Alert.alert("Disable PIN", "Are you sure you want to disable PIN lock?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disable",
          style: "destructive",
          onPress: () => {
            updateSecurity({ pinEnabled: false, pin: "" });
            AsyncStorage.setItem(PIN_STORAGE_KEY, JSON.stringify({ pinEnabled: false, pin: "" })).catch(() => {});
          },
        },
      ]);
    }
  }

  async function handlePinSaved(pin: string) {
    setShowPinSetup(false);
    updateSecurity({ pinEnabled: true, pin });
    const pinData = JSON.stringify({ pinEnabled: true, pin });
    if (Platform.OS !== "web") {
      await SecureStore.setItemAsync(PIN_SECURE_KEY, pinData).catch(() => {});
    } else {
      localStorage.setItem(PIN_SECURE_KEY, pinData);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleSignOut() {
    Alert.alert(
      "Sign Out",
      "You will need to sign in again to access your data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: () => auth.signOut(),
        },
      ]
    );
  }

  const timingLabels: Record<string, string> = {
    same: "Same day",
    "1day": "1 day before",
    "3days": "3 days before",
    "7days": "7 days before",
  };

  function cycleTimimg() {
    const options: NotificationSettings["timing"][] = ["same", "1day", "3days", "7days"];
    const next = options[(options.indexOf(notif.timing) + 1) % options.length];
    updateNotif({ timing: next });
  }

  const autoLockLabels: Record<number, string> = { 1: "1 min", 5: "5 min", 10: "10 min", 30: "30 min", 0: "Never" };
  function cycleAutoLock() {
    const options = [1, 5, 10, 30, 0];
    const next = options[(options.indexOf(security.autoLockMinutes) + 1) % options.length];
    updateSecurity({ autoLockMinutes: next });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Settings"
        topInset={topPad}
        colors={colors}
        centered
        leading={
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 60 + insets.bottom,
          paddingTop: 16,
          gap: 4,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Appearance */}
        <SectionHeader title="APPEARANCE" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 14 }]}>
          <Text style={[styles.settingSubLabel, { color: colors.mutedForeground, marginBottom: 12 }]}>
            Theme
          </Text>
          <View style={styles.themeToggle}>
            {(["system", "light", "dark"] as ThemeMode[]).map((m) => {
              const active = theme.mode === m;
              const icon = m === "system" ? "monitor" : m === "light" ? "sun" : "moon";
              const label = m === "system" ? "System" : m === "light" ? "Light" : "Dark";
              return (
                <Pressable
                  key={m}
                  onPress={() => { Haptics.selectionAsync(); theme.setMode(m); }}
                  style={[
                    styles.themeTab,
                    active
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: colors.muted, borderColor: colors.border },
                  ]}
                >
                  <Feather name={icon as any} size={15} color={active ? colors.primaryForeground : colors.mutedForeground} />
                  <Text
                    style={[
                      styles.themeTabText,
                      { color: active ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Profile */}
        <SectionHeader title="PROFILE" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.profileRow}>
            <View style={[styles.profileAvatar, { backgroundColor: colors.primary + "25" }]}>
              <Text style={[styles.profileInitial, { color: colors.primary }]}>
                {finance.userName.charAt(0).toUpperCase()}
              </Text>
            </View>
            {editingName ? (
              <TextInput
                autoFocus
                style={[styles.nameInput, { color: colors.foreground, backgroundColor: colors.muted }]}
                value={nameValue}
                onChangeText={setNameValue}
                onBlur={() => {
                  if (nameValue.trim()) finance.setUserName(nameValue.trim());
                  setEditingName(false);
                }}
                onSubmitEditing={() => {
                  if (nameValue.trim()) finance.setUserName(nameValue.trim());
                  setEditingName(false);
                }}
              />
            ) : (
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileName, { color: colors.foreground }]}>{finance.userName}</Text>
                <Text style={[styles.profileSub, { color: colors.mutedForeground }]}>Tap to edit name</Text>
              </View>
            )}
            <Pressable onPress={() => { setEditingName(true); setNameValue(finance.userName); }} hitSlop={8}>
              <Feather name="edit-2" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        {/* Currency & Budget */}
        <SectionHeader title="CURRENCY & BUDGET" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 0 }]}>
          {/* Currency picker */}
          <View style={styles.currencySection}>
            <Text style={[styles.currencyLabel, { color: colors.mutedForeground }]}>Display Currency</Text>
            <View style={styles.currencyChips}>
              {SUPPORTED_CURRENCIES.map((c) => {
                const active = finance.currency === c.code;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => {
                      Haptics.selectionAsync();
                      finance.setCurrency(c.code);
                    }}
                    style={[
                      styles.currencyChip,
                      {
                        backgroundColor: active ? colors.primary : colors.muted,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.currencyChipCode, { color: active ? colors.primaryForeground : colors.foreground }]}>
                      {c.code}
                    </Text>
                    <Text style={[styles.currencyChipRate, { color: active ? colors.primaryForeground + "AA" : colors.mutedForeground }]}>
                      {c.code === "SAR" ? "base" : `×${c.code === "INR" ? "22.3" : (1 / (1 / (c.code === "USD" ? 0.2666 : c.code === "AED" ? 0.9788 : c.code === "EUR" ? 0.2451 : c.code === "GBP" ? 0.2108 : 1))).toFixed(2)}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {finance.currency !== "SAR" && (
              <Text style={[styles.currencyNote, { color: colors.mutedForeground }]}>
                Totals include only records in {finance.currency}. Different currencies are never combined without conversion.
              </Text>
            )}
          </View>
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          {/* Monthly budget */}
          <View style={styles.budgetRow}>
            <View style={[styles.settingIconWrap, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="target" size={17} color={colors.primary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Monthly Budget</Text>
            <View style={{ flex: 1 }} />
            {editingBudget ? (
              <TextInput
                autoFocus
                keyboardType="numeric"
                style={[styles.budgetInput, { color: colors.foreground, backgroundColor: colors.muted }]}
                value={budgetValue}
                onChangeText={setBudgetValue}
                onBlur={() => {
                  const n = parseFloat(budgetValue);
                  if (!isNaN(n) && n > 0) finance.setMonthlyBudget(n);
                  setEditingBudget(false);
                }}
                onSubmitEditing={() => {
                  const n = parseFloat(budgetValue);
                  if (!isNaN(n) && n > 0) finance.setMonthlyBudget(n);
                  setEditingBudget(false);
                }}
              />
            ) : (
              <Pressable onPress={() => { setEditingBudget(true); setBudgetValue(finance.monthlyBudget.toString()); }}>
                <Text style={[styles.budgetValue, { color: colors.primary }]}>
                  {finance.currency} {finance.monthlyBudget.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Notifications */}
        <SectionHeader title="NOTIFICATIONS" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 0 }]}>
          <View style={styles.settingRow}>
            <View style={[styles.settingIconWrap, { backgroundColor: "#F59E0B20" }]}>
              <Feather name="bell" size={17} color="#F59E0B" />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Enable Reminders</Text>
            <View style={{ flex: 1 }} />
            <Switch
              value={notif.enabled}
              onValueChange={(v) => updateNotif({ enabled: v })}
              trackColor={{ true: colors.primary, false: colors.muted }}
              thumbColor="#fff"
            />
          </View>
          {notif.enabled && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              <Pressable style={styles.settingRow} onPress={cycleTimimg}>
                <View style={[styles.settingIconWrap, { backgroundColor: colors.primary + "20" }]}>
                  <Feather name="clock" size={17} color={colors.primary} />
                </View>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>Remind me</Text>
                <View style={{ flex: 1 }} />
                <Text style={[styles.settingValue, { color: colors.primary }]}>{timingLabels[notif.timing]}</Text>
                <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
              </Pressable>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              <View style={styles.settingRow}>
                <View style={[styles.settingIconWrap, { backgroundColor: "#10B98120" }]}>
                  <Feather name="refresh-cw" size={17} color="#10B981" />
                </View>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>EMI reminders</Text>
                <View style={{ flex: 1 }} />
                <Switch
                  value={notif.emiEnabled}
                  onValueChange={(v) => updateNotif({ emiEnabled: v })}
                  trackColor={{ true: colors.primary, false: colors.muted }}
                  thumbColor="#fff"
                />
              </View>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              <View style={styles.settingRow}>
                <View style={[styles.settingIconWrap, { backgroundColor: "#EF444420" }]}>
                  <Feather name="list" size={17} color="#EF4444" />
                </View>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>Expense reminders</Text>
                <View style={{ flex: 1 }} />
                <Switch
                  value={notif.expenseEnabled}
                  onValueChange={(v) => updateNotif({ expenseEnabled: v })}
                  trackColor={{ true: colors.primary, false: colors.muted }}
                  thumbColor="#fff"
                />
              </View>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              <View style={styles.settingRow}>
                <View style={[styles.settingIconWrap, { backgroundColor: "#F59E0B20" }]}>
                  <Feather name="alert-triangle" size={17} color="#F59E0B" />
                </View>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>Budget alerts</Text>
                <View style={{ flex: 1 }} />
                <Switch
                  value={notif.budgetEnabled}
                  onValueChange={(v) => updateNotif({ budgetEnabled: v })}
                  trackColor={{ true: colors.primary, false: colors.muted }}
                  thumbColor="#fff"
                />
              </View>
            </>
          )}
        </View>

        {notif.enabled && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {(["balloonEnabled", "loanEnabled"] as const).map(key => (
              <View key={key} style={styles.settingRow}>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>{key === "balloonEnabled" ? "Balloon reminders" : "Loan reminders"}</Text>
                <View style={{ flex: 1 }} />
                <Switch testID={`notification-${key}`} value={notif[key] ?? true}
                  onValueChange={value => updateNotif({ [key]: value })}
                  trackColor={{ true: colors.primary, false: colors.muted }} />
              </View>
            ))}
            <Text style={{ color: colors.mutedForeground, fontSize: TYPOGRAPHY.supporting }}>Local reminders require device permission. Web previews do not send notifications. Category thresholds are configured in Budget.</Text>
          </View>
        )}
        {/* Security */}
        <SectionHeader title="SECURITY" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 0 }]}>
          {/* Biometric */}
          {auth.biometricAvailable && (
            <>
              <View style={styles.settingRow}>
                <View style={[styles.settingIconWrap, { backgroundColor: "#10B98120" }]}>
                  <Feather name={auth.biometricType === "face" ? "smile" : "aperture"} size={17} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: colors.foreground }]}>
                    {auth.biometricType === "face" ? "Face ID" : "Fingerprint"}
                  </Text>
                  <Text style={[styles.settingSubLabel, { color: colors.mutedForeground }]}>
                    {auth.biometricEnabled ? "Biometric unlock is on" : "Use biometrics to unlock app"}
                  </Text>
                </View>
                <Switch
                  value={auth.biometricEnabled}
                  onValueChange={(v) => auth.setBiometricEnabled(v)}
                  trackColor={{ true: "#10B981", false: colors.muted }}
                  thumbColor="#fff"
                />
              </View>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
            </>
          )}
          <View style={styles.settingRow}>
            <View style={[styles.settingIconWrap, { backgroundColor: "#8B5CF620" }]}>
              <Feather name="lock" size={17} color="#8B5CF6" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingLabel, { color: colors.foreground }]}>PIN Lock</Text>
              <Text style={[styles.settingSubLabel, { color: colors.mutedForeground }]}>
                {security.pinEnabled ? "PIN is set — app locks on close" : "Protect your data with a PIN"}
              </Text>
            </View>
            <Switch
              value={security.pinEnabled}
              onValueChange={handlePinToggle}
              trackColor={{ true: colors.primary, false: colors.muted }}
              thumbColor="#fff"
            />
          </View>
          {security.pinEnabled && (
            <>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              <Pressable style={styles.settingRow} onPress={cycleAutoLock}>
                <View style={[styles.settingIconWrap, { backgroundColor: "#8B5CF620" }]}>
                  <Feather name="clock" size={17} color="#8B5CF6" />
                </View>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>Auto-lock</Text>
                <View style={{ flex: 1 }} />
                <Text style={[styles.settingValue, { color: colors.primary }]}>
                  {autoLockLabels[security.autoLockMinutes]}
                </Text>
                <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
              </Pressable>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
              <Pressable style={styles.settingRow} onPress={() => setShowPinSetup(true)}>
                <View style={[styles.settingIconWrap, { backgroundColor: "#8B5CF620" }]}>
                  <Feather name="edit-3" size={17} color="#8B5CF6" />
                </View>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>Change PIN</Text>
                <View style={{ flex: 1 }} />
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            </>
          )}
        </View>

        {/* Account */}
        <SectionHeader title="ACCOUNT" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 0 }]}>
          {auth.userEmail && (
            <>
              <View style={styles.settingRow}>
                <View style={[styles.settingIconWrap, { backgroundColor: colors.primary + "20" }]}>
                  <Feather name="user" size={17} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingLabel, { color: colors.foreground }]}>Signed in as</Text>
                  <Text style={[styles.settingSubLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {auth.userEmail}
                  </Text>
                </View>
              </View>
              <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
            </>
          )}
          <Pressable style={styles.settingRow} onPress={handleSignOut}>
            <View style={[styles.settingIconWrap, { backgroundColor: "#EF444420" }]}>
              <Feather name="log-out" size={17} color="#EF4444" />
            </View>
            <Text style={[styles.settingLabel, { color: "#EF4444" }]}>Sign Out</Text>
            <View style={{ flex: 1 }} />
            <Feather name="chevron-right" size={16} color="#EF444480" />
          </Pressable>
        </View>

        {/* Support */}
        <SectionHeader title="SUPPORT" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, gap: 0 }]}>
          <Pressable
            style={({ pressed }) => [styles.settingRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => router.push("/support")}
          >
            <View style={[styles.settingIconWrap, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="life-buoy" size={17} color={colors.primary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Help & Support</Text>
            <View style={{ flex: 1 }} />
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </Pressable>
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <Pressable
            style={({ pressed }) => [styles.settingRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => router.push({ pathname: "/legal", params: { type: "privacy" } })}
          >
            <View style={[styles.settingIconWrap, { backgroundColor: "#10B98120" }]}>
              <Feather name="shield" size={17} color="#10B981" />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Privacy Policy</Text>
            <View style={{ flex: 1 }} />
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </Pressable>
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <Pressable
            style={({ pressed }) => [styles.settingRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => router.push({ pathname: "/legal", params: { type: "terms" } })}
          >
            <View style={[styles.settingIconWrap, { backgroundColor: "#F59E0B20" }]}>
              <Feather name="file-text" size={17} color="#F59E0B" />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Terms & Conditions</Text>
            <View style={{ flex: 1 }} />
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* About */}
        <SectionHeader title="ABOUT" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.settingRow}>
            <View style={[styles.settingIconWrap, { backgroundColor: colors.primary + "20" }]}>
              <Feather name="info" size={17} color={colors.primary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.foreground }]}>Version</Text>
            <View style={{ flex: 1 }} />
            <Text style={[styles.settingValue, { color: colors.mutedForeground }]}>1.0.0</Text>
          </View>
        </View>

      </ScrollView>

      <PinSetupModal
        visible={showPinSetup}
        onClose={() => setShowPinSetup(false)}
        onSave={handlePinSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    fontSize: TYPOGRAPHY.supporting,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    borderRadius: 18,
        overflow: "hidden",
    marginBottom: 2,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInitial: { fontSize: 22, fontFamily: "Inter_700Bold" },
  profileName: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_600SemiBold" },
  profileSub: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", marginTop: 2 },
  nameInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    minHeight: 56,
  },
  settingIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  settingLabel: { fontSize: TYPOGRAPHY.cardTitle, fontFamily: "Inter_500Medium" },
  settingSubLabel: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", marginTop: 2 },
  settingValue: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_500Medium" },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
  currencySection: { padding: 14 },
  currencyLabel: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_500Medium", marginBottom: 10, letterSpacing: 0.4 },
  currencyChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  currencyChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 62,
  },
  currencyChipCode: { fontSize: 13, fontFamily: "Inter_700Bold" },
  currencyChipRate: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", marginTop: 2 },
  currencyNote: { fontSize: TYPOGRAPHY.supporting, fontFamily: "Inter_400Regular", marginTop: 10, lineHeight: 18 },
  budgetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    minHeight: 56,
  },
  budgetValue: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_600SemiBold", fontVariant: ["tabular-nums"] },
  budgetInput: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    fontVariant: ["tabular-nums"],
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 96,
    textAlign: "right",
  },
  pinModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  pinModalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    alignItems: "center",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 24,
  },
  pinTitle: { fontSize: TYPOGRAPHY.dialogTitle, fontFamily: "Inter_700Bold", marginBottom: 6 },
  pinSubtitle: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_400Regular", marginBottom: 32 },
  dotsRow: { flexDirection: "row", gap: 16, marginBottom: 8 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  pinError: { fontSize: TYPOGRAPHY.bodySmall, fontFamily: "Inter_500Medium", marginBottom: 8 },
  numpad: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 264,
    gap: 12,
    marginTop: 24,
    justifyContent: "center",
  },
  numKey: {
    width: 80,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  numKeyText: { fontSize: 22, fontFamily: "Inter_600SemiBold" },
  cancelLink: { marginTop: 20, padding: 8 },
  cancelLinkText: { fontSize: TYPOGRAPHY.body, fontFamily: "Inter_500Medium" },
  themeToggle: {
    flexDirection: "row",
    gap: 8,
  },
  themeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  themeTabText: {
    fontSize: TYPOGRAPHY.bodySmall,
    fontFamily: "Inter_600SemiBold",
  },
});
