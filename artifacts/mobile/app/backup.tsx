import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Stack, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { ScreenHeader } from "@/components/ScreenHeader";
import { useFinance } from "@/context/FinanceContext";
import { useTheme } from "@/context/ThemeContext";
import { usePreferences } from "@/context/PreferencesContext";
import { useColors } from "@/hooks/useColors";
import { formatAppDate, formatAppNumber } from "@/i18n/localization";
import { randomBytes } from "@/security/deviceSecurity";
import {
  MAX_BACKUP_FILE_BYTES,
  MIN_BACKUP_PASSWORD_LENGTH,
  createFinanceBackup,
  openFinanceBackup,
  type OpenedFinanceBackup,
} from "@/security/backup";
import { utf8 } from "@/security/crypto";
import { getApplicationVersion } from "@/utils/appVersion";

const LAST_BACKUP_KEY = "@finance_last_backup_v1";

const COUNT_LABELS: Record<string, string> = {
  accounts: "Accounts",
  transactions: "Ledger entries",
  incomes: "Income records",
  expenses: "Expenses",
  emiSchedules: "EMI schedules",
  emiPayments: "EMI payments",
  loans: "Loans",
  loanPayments: "Loan payments",
  budgetPlans: "Budget plans",
  budgetPeriods: "Budget periods",
  recurringDefinitions: "Recurring rules",
  recurringOccurrences: "Scheduled items",
  savingsGoals: "Savings goals",
  netWorthSnapshots: "Net-worth snapshots",
};

export default function BackupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const finance = useFinance();
  const theme = useTheme();
  const { t, isRTL } = usePreferences();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [backup, setBackup] = useState<OpenedFinanceBackup | null>(null);
  const [selectedBackupText, setSelectedBackupText] = useState<string | null>(null);
  const [selectedBackupName, setSelectedBackupName] = useState("");
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmRestore, setConfirmRestore] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LAST_BACKUP_KEY).then(setLastBackup).catch(() => {
      setError("The previous backup date could not be read. Existing backups are not affected.");
    });
  }, []);

  useEffect(() => {
    if (finance.storageRecoveryNotice) setNotice(finance.storageRecoveryNotice);
  }, [finance.storageRecoveryNotice]);

  const previewCounts = useMemo(() => {
    if (!backup) return [];
    return Object.entries(backup.metadata.recordCounts)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => [COUNT_LABELS[key] ?? key, count] as const);
  }, [backup]);

  async function exportBackup() {
    setError("");
    setNotice("");
    if (password.length < MIN_BACKUP_PASSWORD_LENGTH) {
      setError(t("Use a backup password with at least {count} characters.", { count: MIN_BACKUP_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirmation) {
      setError("The two backup passwords do not match.");
      return;
    }
    setWorking(true);
    try {
      const serialized = await createFinanceBackup(
        finance.getFinanceStateSnapshot(),
        theme.mode,
        password,
        randomBytes,
        getApplicationVersion(),
      );
      if (Platform.OS === "web") {
        const blob = new Blob([serialized], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `finance-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const uri = `${FileSystem.cacheDirectory}finance-hub-backup-${Date.now()}.json`;
        try {
          await FileSystem.writeAsStringAsync(uri, serialized, { encoding: FileSystem.EncodingType.UTF8 });
          if (!(await Sharing.isAvailableAsync())) throw new Error("File sharing is unavailable on this device.");
          await Sharing.shareAsync(uri, {
            mimeType: "application/json",
            dialogTitle: "Save encrypted Finance Hub backup",
            UTI: "public.json",
          });
        } finally {
          await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        }
      }
      const createdAt = new Date().toISOString();
      let lastDateSaved = true;
      try {
        await AsyncStorage.setItem(LAST_BACKUP_KEY, createdAt);
        setLastBackup(createdAt);
      } catch {
        lastDateSaved = false;
      }
      setPassword("");
      setConfirmation("");
      setNotice(lastDateSaved
        ? "Encrypted backup created. Keep its password separate from the file."
        : "Encrypted backup exported, but its last-created date could not be saved on this device.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The backup could not be created.");
    } finally {
      setWorking(false);
    }
  }

  async function chooseBackup() {
    setError("");
    setNotice("");
    setBackup(null);
    setSelectedBackupText(null);
    setSelectedBackupName("");
    setRestorePassword("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) throw new Error("No backup file was selected.");
      if (typeof asset.size === "number" && asset.size > MAX_BACKUP_FILE_BYTES) {
        throw new Error("This file is larger than the 64 MB backup limit.");
      }
      if (Platform.OS !== "web") {
        const info = await FileSystem.getInfoAsync(asset.uri);
        if (info.exists && typeof info.size === "number" && info.size > MAX_BACKUP_FILE_BYTES) {
          throw new Error("This file is larger than the 64 MB backup limit.");
        }
      }
      let serialized: string;
      if (Platform.OS === "web") {
        const response = await fetch(asset.uri);
        if (!response.ok) throw new Error("The selected file could not be read.");
        serialized = await response.text();
      } else {
        serialized = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
      }
      if (utf8(serialized).byteLength > MAX_BACKUP_FILE_BYTES) {
        throw new Error("This file is larger than the 64 MB backup limit.");
      }
      setNotice(`${t("Selected")}: ${asset.name}`);
      setSelectedBackupName(asset.name);
      setSelectedBackupText(serialized);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The selected backup could not be read.");
    }
  }

  async function openSelectedBackup() {
    setError("");
    if (!restorePassword) {
      setError("Enter the password used to encrypt this backup.");
      return;
    }
    const serialized = selectedBackupText;
    if (!serialized) {
      setError("Choose an encrypted backup file first.");
      return;
    }
    setWorking(true);
    try {
      const opened = await openFinanceBackup(serialized, restorePassword);
      const validated = finance.validateFinanceRestore(opened.payload.financeState);
      // Validation runs before any write and the result stays in memory only.
      setBackup({
        ...opened,
        payload: { ...opened.payload, financeState: validated as unknown as Record<string, unknown> },
      });
      setNotice("Backup verified. Review the records before replacing this device's data.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The backup could not be opened.");
      setBackup(null);
    } finally {
      setWorking(false);
    }
  }

  async function applyRestore() {
    if (!backup || working) return;
    setWorking(true);
    setError("");
    try {
      await finance.restoreFinanceState(
        backup.payload.financeState,
        backup.payload.userPreferences.themeMode,
      );
      if (backup.payload.userPreferences.themeMode) {
        await theme.setMode(backup.payload.userPreferences.themeMode);
      }
      setSelectedBackupText(null);
      setSelectedBackupName("");
      setBackup(null);
      setRestorePassword("");
      setConfirmRestore(false);
      setNotice("Backup restored. Your current PIN, biometrics, and account lock remained on this device.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Restore could not be completed.");
    } finally {
      setWorking(false);
    }
  }

  const hasVerifiedBackup = backup?.metadata.createdAt !== undefined;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader
        title="Backup & Restore"
        topInset={Platform.OS === "web" ? 67 : insets.top}
        colors={colors}
        centered
        leading={
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
            <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={22} color={colors.foreground} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 + insets.bottom, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.noticeCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "35" }]}>
          <Feather name="shield" size={19} color={colors.primary} />
          <Text style={[styles.noticeText, { color: colors.foreground }]}>
            {t("Backups are encrypted on this device with AES-256-GCM and exported only to a location you choose. Finance records are not uploaded. Keep a copy outside this app; uninstalling the app or losing the device can otherwise erase local records. The backup password cannot be recovered if lost.")}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t("Create encrypted backup")}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {t("Includes your accounts, ledger, income, expenses, EMIs, loans, budgets, recurring items, savings and snapshots. Theme is included; language and calendar stay on this device. Device PIN and account credentials are excluded.")}
          </Text>
          {Platform.OS === "web" && (
            <Text style={[styles.small, { color: colors.mutedForeground }]}>
              {t("Browser storage is not hardware-backed. Use a trusted device profile and keep exported backups protected.")}
            </Text>
          )}
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={`${t("Backup password")} (${formatAppNumber(MIN_BACKUP_PASSWORD_LENGTH)}+ ${t("characters")})`}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
          />
          <TextInput
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t("Confirm backup password")}
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
          />
          <Pressable disabled={working} onPress={exportBackup} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: working ? 0.6 : 1 }]}>
            {working ? <ActivityIndicator color={colors.primaryForeground} /> : <Feather name="download" size={17} color={colors.primaryForeground} />}
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{t("Create and export backup")}</Text>
          </Pressable>
          <Text style={[styles.small, { color: colors.mutedForeground }]}>
            {t("Last backup created")}: {lastBackup ? formatAppDate(new Date(lastBackup), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : t("Not yet")}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t("Restore from backup")}</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            {t("The file and password are checked and the contents are validated before any saved records change.")}
          </Text>
          <Pressable disabled={working} onPress={chooseBackup} style={[styles.secondaryButton, { borderColor: colors.border }]}>
            <Feather name="folder" size={17} color={colors.primary} />
            <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>{t("Choose backup file")}</Text>
          </Pressable>
          {!!selectedBackupText && (
            <>
              <Text style={[styles.small, { color: colors.mutedForeground }]}>{selectedBackupName}</Text>
              <TextInput
                value={restorePassword}
                onChangeText={setRestorePassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t("Backup password")}
                placeholderTextColor={colors.mutedForeground}
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              />
              {!hasVerifiedBackup && (
                <Pressable disabled={working} onPress={openSelectedBackup} style={[styles.secondaryButton, { borderColor: colors.primary + "60" }]}>
                  {working ? <ActivityIndicator color={colors.primary} /> : <Feather name="unlock" size={17} color={colors.primary} />}
                  <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>{t("Verify backup and preview")}</Text>
                </Pressable>
              )}
            </>
          )}
          {hasVerifiedBackup && backup && (
            <View style={[styles.preview, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.previewTitle, { color: colors.foreground }]}>{t("Backup preview")}</Text>
              <Text style={[styles.small, { color: colors.mutedForeground }]}>
                {t("Created")} {formatAppDate(new Date(backup.metadata.createdAt), { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })} · {t("app")} {backup.metadata.appVersion} · {t("format")} v1
              </Text>
              {previewCounts.map(([label, count]) => (
                <View key={label} style={styles.countRow}>
                  <Text style={[styles.body, { color: colors.mutedForeground }]}>{t(label)}</Text>
                  <Text style={[styles.body, { color: colors.foreground, fontWeight: "600" }]}>{formatAppNumber(count)}</Text>
                </View>
              ))}
              <Pressable onPress={() => setConfirmRestore(true)} style={[styles.dangerButton, { backgroundColor: colors.destructive }]}>
                <Feather name="refresh-ccw" size={17} color="#fff" />
                <Text style={styles.primaryButtonText}>{t("Replace local records")}</Text>
              </Pressable>
            </View>
          )}
        </View>

        <Text style={[styles.small, { color: colors.mutedForeground }]}>
          {t("Store the exported file somewhere you control and keep its password separately. Uninstalling the app or losing this device does not transfer its local records.")}
        </Text>

        {!!notice && <Text style={[styles.statusText, { color: colors.primary }]}>{t(notice)}</Text>}
        {!!error && <Text style={[styles.statusText, { color: colors.destructive }]}>{t(error)}</Text>}
      </ScrollView>

      <Modal visible={confirmRestore} transparent animationType="fade" onRequestClose={() => setConfirmRestore(false)}>
        <View style={styles.modalShade}>
          <View style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t("Replace this device’s records?")}</Text>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>
              {t("The current finance data and appearance setting will be saved in a protected recovery copy first. Your device PIN and account lock will stay as they are. Do not clear app storage during restore.")}
            </Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setConfirmRestore(false)} style={styles.modalButton}>
                <Text style={{ color: colors.mutedForeground, fontWeight: "600" }}>{t("Cancel")}</Text>
              </Pressable>
              <Pressable disabled={working} onPress={applyRestore} style={[styles.modalButton, { backgroundColor: colors.destructive, borderRadius: 12 }]}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>{t(working ? "Restoring…" : "Replace records")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  backButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  noticeCard: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 19 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: "700" },
  body: { fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  primaryButton: { minHeight: 48, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  primaryButtonText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  secondaryButton: { minHeight: 46, borderWidth: 1, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  secondaryButtonText: { fontSize: 14, fontWeight: "600" },
  small: { fontSize: 12, lineHeight: 18 },
  preview: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  previewTitle: { fontSize: 16, fontWeight: "700" },
  countRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  dangerButton: { minHeight: 46, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 },
  statusText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  modalShade: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(0,0,0,0.56)" },
  confirmCard: { borderWidth: 1, borderRadius: 20, padding: 20, gap: 12 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalButton: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center" },
});
