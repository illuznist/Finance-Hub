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

import { useColors } from "@/hooks/useColors";

const LAST_UPDATED = "May 2025";

const PRIVACY_SECTIONS = [
  {
    title: "Data Storage",
    body: "FinanceApp stores all your financial data exclusively on your device using encrypted local storage. No data is transmitted to any server, third party, or cloud service. We have no access to your financial information.",
  },
  {
    title: "Data We Do Not Collect",
    body: "We do not collect personal information, analytics, usage telemetry, or any identifiable data. There are no user accounts on our servers. Your name, email (used only for local login), and all financial records remain solely on your device.",
  },
  {
    title: "Authentication",
    body: "Your login credentials are hashed using SHA-256 and stored in your device's secure enclave (iOS Keychain / Android Keystore). Biometric authentication is handled entirely by your device's operating system. We never see your password or biometric data.",
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
    body: "All your data can be deleted by uninstalling the app. Since everything is stored locally, uninstalling permanently removes all data. We have no copy of your data to delete on your behalf.",
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
    body: "Since all data is stored locally on your device, you are solely responsible for maintaining backups. We are not liable for data loss resulting from device failure, app deletion, OS updates, or any other cause.",
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
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: string }>();

  const isPrivacy = type === "privacy";
  const title = isPrivacy ? "Privacy Policy" : "Terms & Conditions";
  const sections = isPrivacy ? PRIVACY_SECTIONS : TERMS_SECTIONS;
  const topPad = Platform.OS === "web" ? 20 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{title}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 60 + insets.bottom },
        ]}
      >
        {/* Meta */}
        <View style={[styles.metaRow, { borderColor: colors.border }]}>
          <Feather name="file-text" size={14} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            Last updated {LAST_UPDATED}
          </Text>
        </View>

        {/* Sections */}
        {sections.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {i + 1}. {s.title}
            </Text>
            <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>
              {s.body}
            </Text>
          </View>
        ))}

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            FinanceApp — Built with privacy by design
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 24,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  metaText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    lineHeight: 22,
  },
  sectionBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 20,
    alignItems: "center",
  },
  footerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
  },
});
