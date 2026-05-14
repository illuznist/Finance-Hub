import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SUPPORTED_CURRENCIES, useFinance } from "@/context/FinanceContext";

export const ONBOARDING_KEY = "@finance_onboarded_v1";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const BG_TOP = "#0B1529";
const BG_BOTTOM = "#070A12";
const ACCENT = "#60A5FA";
const ACCENT2 = "#34D399";
const ACCENT3 = "#A78BFA";
const TEXT = "#F0F6FF";
const MUTED = "#64748B";
const CARD = "#0D1420";
const BORDER = "#1A2A45";

const FEATURES = [
  {
    icon: "credit-card" as const,
    color: ACCENT,
    title: "Expense tracking",
    desc: "Log recurring bills and monthly expenses with due-date reminders.",
  },
  {
    icon: "repeat" as const,
    color: ACCENT2,
    title: "EMI management",
    desc: "Track installment plans with a live progress ring and payoff timeline.",
  },
  {
    icon: "bar-chart-2" as const,
    color: ACCENT3,
    title: "Smart analytics",
    desc: "Visual breakdowns of where your money goes, every month.",
  },
];

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const finance = useFinance();

  const scrollRef = useRef<ScrollView>(null);
  const dotAnim = useRef(new Animated.Value(0)).current;
  const [page, setPage] = useState(0);
  const TOTAL_PAGES = 3;

  // Page 2 state
  const [name, setName] = useState("Manzoor");
  const [currency, setCurrency] = useState("SAR");

  // Page 3 state
  const [budget, setBudget] = useState("7500");

  function goTo(next: number) {
    setPage(next);
    scrollRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
    Animated.spring(dotAnim, {
      toValue: next,
      useNativeDriver: false,
    }).start();
  }

  async function finish() {
    const finalName = name.trim() || "Manzoor";
    const finalBudget = parseFloat(budget) || 7500;

    finance.setUserName(finalName);
    finance.setCurrency(currency);
    finance.setMonthlyBudget(finalBudget);

    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    onComplete();
  }

  async function skip() {
    await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    onComplete();
  }

  return (
    <LinearGradient colors={[BG_TOP, BG_BOTTOM]} style={styles.root}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header row */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Feather name="trending-up" size={18} color={ACCENT} />
            </View>
            <Text style={styles.logoText}>FinanceApp</Text>
          </View>
          {page < 2 && (
            <Pressable onPress={skip} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          )}
        </View>

        {/* Page dots */}
        <View style={styles.dotsRow}>
          {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === page ? ACCENT : BORDER,
                  width: i === page ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Scrollable pages */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          style={styles.pageScroll}
        >
          {/* ── Page 0: Welcome ── */}
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            <View style={styles.heroRing}>
              <View style={styles.heroInner}>
                <Feather name="trending-up" size={44} color={ACCENT} />
              </View>
            </View>

            <Text style={styles.headline}>Your finances,{"\n"}beautifully organized</Text>
            <Text style={styles.sub}>
              A premium personal finance tracker built for clarity and control.
            </Text>

            <View style={styles.featureList}>
              {FEATURES.map((f) => (
                <View key={f.title} style={styles.featureRow}>
                  <View style={[styles.featureIcon, { backgroundColor: f.color + "22" }]}>
                    <Feather name={f.icon} size={16} color={f.color} />
                  </View>
                  <View style={styles.featureText}>
                    <Text style={styles.featureTitle}>{f.title}</Text>
                    <Text style={styles.featureDesc}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* ── Page 1: Personalize ── */}
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            <View style={styles.pageIconWrap}>
              <Feather name="user" size={32} color={ACCENT} />
            </View>
            <Text style={styles.headline}>Personalize{"\n"}your experience</Text>
            <Text style={styles.sub}>We'll set up the app to match your preferences.</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Your name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                placeholderTextColor={MUTED}
                style={styles.input}
                autoCapitalize="words"
                returnKeyType="done"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Default currency</Text>
              <View style={styles.currencyGrid}>
                {SUPPORTED_CURRENCIES.map((c) => (
                  <Pressable
                    key={c.code}
                    onPress={() => setCurrency(c.code)}
                    style={[
                      styles.currencyChip,
                      currency === c.code && styles.currencyChipActive,
                    ]}
                  >
                    <Text style={[
                      styles.currencyCode,
                      currency === c.code && { color: "#0B1529" },
                    ]}>
                      {c.code}
                    </Text>
                    <Text style={[
                      styles.currencySymbol,
                      currency === c.code && { color: "#0B1529" },
                    ]}>
                      {c.symbol}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          {/* ── Page 2: Budget ── */}
          <View style={[styles.page, { width: SCREEN_WIDTH }]}>
            <View style={styles.pageIconWrap}>
              <Feather name="target" size={32} color={ACCENT2} />
            </View>
            <Text style={styles.headline}>Set your{"\n"}monthly budget</Text>
            <Text style={styles.sub}>
              Define how much you plan to spend each month. You can always adjust this later in Settings.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Monthly budget ({currency})</Text>
              <View style={styles.budgetInputRow}>
                <Text style={styles.budgetCurrencyPrefix}>
                  {SUPPORTED_CURRENCIES.find((c) => c.code === currency)?.symbol ?? currency}
                </Text>
                <TextInput
                  value={budget}
                  onChangeText={(v) => setBudget(v.replace(/[^0-9.]/g, ""))}
                  placeholder="0"
                  placeholderTextColor={MUTED}
                  keyboardType="numeric"
                  style={styles.budgetInput}
                  returnKeyType="done"
                />
              </View>
            </View>

            <View style={styles.budgetHints}>
              {["3000", "5000", "7500", "10000"].map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setBudget(v)}
                  style={[
                    styles.hintChip,
                    budget === v && styles.hintChipActive,
                  ]}
                >
                  <Text style={[styles.hintText, budget === v && { color: "#0B1529" }]}>
                    {parseInt(v).toLocaleString()}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
          {page > 0 && (
            <Pressable onPress={() => goTo(page - 1)} style={styles.backBtn}>
              <Feather name="arrow-left" size={18} color={MUTED} />
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          )}

          <Pressable
            onPress={page < TOTAL_PAGES - 1 ? () => goTo(page + 1) : finish}
            style={styles.nextBtn}
          >
            <LinearGradient
              colors={["#3B82F6", "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.nextBtnInner}
            >
              <Text style={styles.nextText}>
                {page < TOTAL_PAGES - 1 ? "Continue" : "Get Started"}
              </Text>
              <Feather
                name={page < TOTAL_PAGES - 1 ? "arrow-right" : "check"}
                size={18}
                color="#fff"
              />
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: ACCENT + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontFamily: "Inter_700Bold",
    fontSize: 17,
    color: TEXT,
    letterSpacing: 0.2,
  },
  skipBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  skipText: { fontFamily: "Inter_500Medium", fontSize: 14, color: MUTED },

  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
  },
  dot: { height: 6, borderRadius: 3 },

  pageScroll: { flex: 1 },

  page: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 8,
  },

  heroRing: {
    alignSelf: "center",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: ACCENT + "44",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    backgroundColor: ACCENT + "11",
  },
  heroInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ACCENT + "22",
    alignItems: "center",
    justifyContent: "center",
  },

  pageIconWrap: {
    alignSelf: "flex-start",
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: ACCENT + "18",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },

  headline: {
    fontFamily: "Inter_700Bold",
    fontSize: 30,
    color: TEXT,
    lineHeight: 38,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  sub: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: MUTED,
    lineHeight: 22,
    marginBottom: 28,
  },

  featureList: { gap: 14 },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureText: { flex: 1 },
  featureTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: TEXT,
    marginBottom: 3,
  },
  featureDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
  },

  formGroup: { marginBottom: 24 },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: MUTED,
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  input: {
    height: 52,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    color: TEXT,
    fontFamily: "Inter_500Medium",
    fontSize: 16,
  },

  currencyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  currencyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    minWidth: 80,
  },
  currencyChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  currencyCode: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: TEXT,
  },
  currencySymbol: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: MUTED,
  },

  budgetInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    height: 60,
  },
  budgetCurrencyPrefix: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 20,
    color: ACCENT,
    marginRight: 8,
  },
  budgetInput: {
    flex: 1,
    color: TEXT,
    fontFamily: "Inter_600SemiBold",
    fontSize: 24,
  },
  budgetHints: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  hintChip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  hintChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  hintText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: TEXT,
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 12,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    color: MUTED,
  },
  nextBtn: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  nextBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  nextText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#fff",
    letterSpacing: 0.2,
  },
});
