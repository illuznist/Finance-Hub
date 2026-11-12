import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { TYPOGRAPHY } from "@/constants/typography";
import { usePreferences } from "@/context/PreferencesContext";

const LAST_UPDATED = "November 2026";

const PRIVACY_SECTIONS = [
  {
    title: "Data Storage",
    body: "Your finance records are stored in the app's on-device database and are not uploaded to a FinanceApp server. The app does not encrypt that database at rest; on native devices it is protected by the operating system's app sandbox, while browser storage is accessible to the browser profile. Encrypted backups are created only when you export them.",
  },
  {
    title: "Data We Do Not Collect",
    body: "The app has no FinanceApp-hosted account service and does not send your finance records to a server. Your name, email, and local account verifier are stored on this device. Browser sign-in data uses browser local storage and is not protected by device secure hardware.",
  },
  {
    title: "Authentication",
    body: "Passwords are stored as salted PBKDF2-HMAC-SHA256 verifiers. On native devices, the verifier and optional PIN verifier are stored with the operating system's Keychain or Keystore through SecureStore; they are not kept in the secure enclave. Browser builds use local storage instead. Biometrics are opt-in and verified by the operating system; the app does not receive biometric samples.",
  },
  {
    title: "Notifications",
    body: "If you enable notifications, they are scheduled locally on your device. No notification content is sent to external servers. You can disable notifications at any time in Settings.",
  },
  {
    title: "Third-Party Services",
    body: "FinanceApp does not integrate with any third-party analytics, advertising, or tracking services. The app uses no external APIs that receive your personal or financial data.",
  },
  {
    title: "Data Deletion",
    body: "Finance records are local to the app. Removing app data or uninstalling may permanently remove those records; exported backup files remain wherever you saved them. Some operating systems may retain Keychain credentials after an app is removed. FinanceApp does not hold a server-side copy to delete.",
  },
  {
    title: "Contact",
    body: "For privacy-related questions, contact us at support@financeapp.com. We typically respond within 1–2 business days.",
  },
];

const TERMS_SECTIONS = [
  {
    title: "Acceptance of Terms",
    body: "By using FinanceApp, you agree to these Terms and Conditions. If you do not agree, please do not use the app. These terms may be updated periodically — continued use constitutes acceptance of any changes.",
  },
  {
    title: "Description of Service",
    body: "FinanceApp is a personal finance tracking tool that operates entirely on your device. It is intended for personal, non-commercial use to help you manage expenses, EMIs, income, and budgets.",
  },
  {
    title: "No Financial Advice",
    body: "FinanceApp is a tracking and organisational tool only. Nothing in the app constitutes financial, investment, tax, or legal advice. Always consult a qualified professional before making financial decisions.",
  },
  {
    title: "Data Responsibility",
    body: "Records are stored locally on your device. You are responsible for creating and keeping encrypted backups in a location you control. A backup password cannot be recovered by the app. We are not liable for data loss resulting from device failure, app deletion, OS updates, or other causes.",
  },
  {
    title: "Accuracy of Information",
    body: "Currency conversion rates shown in the app are indicative only and may not reflect real-time market rates. Do not rely on them for actual currency exchange transactions.",
  },
  {
    title: "Intellectual Property",
    body: "All content, designs, and code within FinanceApp are the property of the developer. You may not copy, modify, distribute, or reverse-engineer any part of the app without written permission.",
  },
  {
    title: "Limitation of Liability",
    body: "FinanceApp is provided 'as is' without warranty of any kind. We are not liable for any direct, indirect, incidental, or consequential damages arising from your use of, or inability to use, the app.",
  },
  {
    title: "Governing Law",
    body: "These terms are governed by applicable law. Any disputes shall be resolved in the jurisdiction where the developer is based.",
  },
  {
    title: "Contact",
    body: "For questions about these terms, contact us at support@financeapp.com.",
  },
];

export default function LegalScreen() {
  const colors = useColors();
  const { t, isRTL, language } = usePreferences();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: string }>();

  const isPrivacy = type === "privacy";
  const title = isPrivacy ? "Privacy Policy" : "Terms & Conditions";
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={title}
        topInset={topPad}
        colors={colors}
        centered
        leading={
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
            <Feather name={isRTL ? "arrow-right" : "arrow-left"} size={22} color={colors.foreground} />
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 60 + insets.bottom },
        ]}
      >
        {language === "ar" ? (
          <Text style={[styles.metaText, { color: colors.warning, marginBottom: 12 }]}>
            {t("Legal content is shown in English until an Arabic translation is reviewed.")}
          </Text>
        ) : null}
        {/* Meta */}
        <View style={[styles.metaRow, { borderColor: colors.border }]}>
          <Feather name="file-text" size={14} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            {t("Last updated")} {t(LAST_UPDATED)}
          </Text>
        </View>

        {/* Sections */}
        {sections.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {i + 1}. {t(s.title)}
            </Text>
            <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>
              {s.body}
            </Text>
          </View>
        ))}

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            {t("FinanceApp — Built with privacy by design")}
          </Text>
        </View>
      </ScrollView>
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 24,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metaText: {
    fontFamily: "Inter_400Regular",
    fontSize: TYPOGRAPHY.body,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: TYPOGRAPHY.sectionHeading,
    lineHeight: 24,
  },
  sectionBody: {
    fontFamily: "Inter_400Regular",
    fontSize: TYPOGRAPHY.body,
    lineHeight: 22,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 20,
    alignItems: "center",
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: TYPOGRAPHY.supporting,
  },
});
