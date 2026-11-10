import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import React, { useRef, useState } from "react";
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { useColors } from "@/hooks/useColors";
import { TYPOGRAPHY } from "@/constants/typography";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SUPPORT_EMAIL = "support@financeapp.com";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is my data safe and private?",
    a: "All your financial data is stored locally on your device using encrypted storage. Nothing is sent to any server. Only you can access it.",
  },
  {
    q: "I forgot my PIN — what do I do?",
    a: "If you enabled Face ID or fingerprint, use that to unlock the app. If biometrics are not available, you will need to reinstall the app. Your PIN cannot be recovered for security reasons.",
  },
  {
    q: "How do I enable Face ID or Fingerprint?",
    a: "Go to Settings, then Security. Toggle on the Face ID or Fingerprint option. Your device must have biometrics set up in system settings.",
  },
  {
    q: "Which currencies are supported?",
    a: "FinanceApp supports SAR, USD, EUR, GBP, AED, INR, and more. Change your display currency any time in Settings under Currency & Budget.",
  },
  {
    q: "How does the monthly reset work?",
    a: "At the start of each month, all recurring expenses are automatically marked as unpaid so you can track the new month. Your history remains intact.",
  },
  {
    q: "Can I export or backup my data?",
    a: "Export and cloud backup features are on our roadmap. Currently, all data lives on your device. Be careful not to delete the app without a backup.",
  },
  {
    q: "How do EMIs work?",
    a: "Add any loan or installment plan with the total amount, number of installments, and start date. The app tracks how many are paid and shows the remaining balance.",
  },
];

function FaqItem({ item }: { item: { q: string; a: string } }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const rotAnim = useRef(new Animated.Value(0)).current;

  function toggle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotAnim, {
      toValue: open ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
    setOpen((v) => !v);
  }

  const rotate = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "90deg"] });

  return (
    <View>
      <Pressable onPress={toggle} style={styles.faqRow}>
        <Text style={[styles.faqQ, { color: colors.foreground, flex: 1 }]}>{item.q}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Animated.View>
      </Pressable>
      {open && (
        <Text style={[styles.faqA, { color: colors.mutedForeground, borderTopColor: colors.border }]}>
          {item.a}
        </Text>
      )}
    </View>
  );
}

function ActionRow({
  icon,
  iconColor,
  label,
  sublabel,
  onPress,
}: {
  icon: string;
  iconColor: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.actionIcon, { backgroundColor: iconColor + "20" }]}>
        <Feather name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLabel, { color: colors.foreground }]}>{label}</Text>
        {sublabel && (
          <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>{sublabel}</Text>
        )}
      </View>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function SupportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 20 : insets.top;

  function openEmail(subject: string, body?: string) {
    const params = [`subject=${encodeURIComponent(subject)}`];
    if (body) params.push(`body=${encodeURIComponent(body)}`);
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?${params.join("&")}`);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Help & Support"
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 60 + insets.bottom },
        ]}
      >
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="life-buoy" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            We are here to help
          </Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Browse the FAQ below or reach out and we will get back to you as soon as possible.
          </Text>
        </View>

        {/* Contact options */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CONTACT</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ActionRow
            icon="mail"
            iconColor={colors.primary}
            label="Email Support"
            sublabel={SUPPORT_EMAIL}
            onPress={() =>
              openEmail("FinanceApp Support Request", "Hi,\n\nI need help with...\n")
            }
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <ActionRow
            icon="alert-circle"
            iconColor="#F59E0B"
            label="Report a Bug"
            sublabel="Help us improve by reporting issues"
            onPress={() =>
              openEmail(
                "Bug Report — FinanceApp",
                "Hi,\n\nI found a bug:\n\nSteps to reproduce:\n1. \n2. \n\nExpected behaviour:\n\nActual behaviour:\n\nDevice & OS version:\n"
              )
            }
          />
        </View>

        {/* FAQ */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          FREQUENTLY ASKED
        </Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {FAQ.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <FaqItem item={item} />
            </React.Fragment>
          ))}
        </View>

        {/* Footer note */}
        <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
          Average response time: 1–2 business days
        </Text>
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
    gap: 6,
  },
  hero: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    marginBottom: 8,
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: TYPOGRAPHY.sectionHeading,
    marginBottom: 6,
    textAlign: "center",
  },
  heroSub: {
    fontFamily: "Inter_400Regular",
    fontSize: TYPOGRAPHY.body,
    lineHeight: 20,
    textAlign: "center",
  },
  sectionLabel: {
    fontSize: TYPOGRAPHY.supporting,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginTop: 12,
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: TYPOGRAPHY.body,
  },
  actionSub: {
    fontFamily: "Inter_400Regular",
    fontSize: TYPOGRAPHY.supporting,
    marginTop: 2,
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
  faqRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
  },
  faqQ: {
    fontFamily: "Inter_500Medium",
    fontSize: TYPOGRAPHY.body,
    lineHeight: 20,
  },
  faqA: {
    fontFamily: "Inter_400Regular",
    fontSize: TYPOGRAPHY.body,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerNote: {
    fontFamily: "Inter_400Regular",
    fontSize: TYPOGRAPHY.supporting,
    textAlign: "center",
    marginTop: 12,
  },
});
